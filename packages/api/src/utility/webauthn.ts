/**
 * パスキー(WebAuthn)の登録・認証チャレンジ生成/検証をラップするユーティリティ。
 * @remarks
 * 署名検証・COSE公開鍵のパース等の暗号処理は自前実装せず、
 * 実績のあるライブラリ（`@simplewebauthn/server`）にすべて委譲する
 * （SECURITY-11: セキュリティクリティカルなロジックの自前実装は避ける）。
 * このファイルは「リポジトリ固有の設定値（RP ID等）をどこから読むか」
 * 「DBに保存する形へどう変換するか」という薄いラッパーに徹する。
 */
import type { CloudFlareEnv } from '@race-schedule/core';
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';

/** WEBAUTHN_RP_NAME未設定時に認証器のUIへ表示するサービス名の既定値。 */
const DEFAULT_RP_NAME = 'race-schedule';

export interface WebauthnRpConfig {
    /** Relying Party ID（frontのホスト名。例: race-schedule-front.pages.dev） */
    readonly rpId: string;
    /** 認証器のUIに表示されるサービス名 */
    readonly rpName: string;
    /** 期待するオリジン（rpIdから導出。本番/testは常にhttps） */
    readonly origin: string;
}

/**
 * WebAuthnのRP設定を環境変数から解決する。
 * `WEBAUTHN_RP_ID` 未設定時はnullを返し、呼び出し側はフェイルクローズ
 * （パスキー登録・ログインを一切受け付けない）する（SECURITY-15）。
 * @param env - Cloudflare Workersの環境変数
 * @returns RP設定。未設定ならnull
 */
export const resolveWebauthnRpConfig = (
    env: CloudFlareEnv,
): WebauthnRpConfig | null => {
    const rpId = env.WEBAUTHN_RP_ID;
    if (!rpId) return null;
    return {
        rpId,
        rpName: env.WEBAUTHN_RP_NAME ?? DEFAULT_RP_NAME,
        origin: `https://${rpId}`,
    };
};

/**
 * パスキー登録（`navigator.credentials.create()`）用のオプションを生成する。
 * @param config - RP設定
 * @param userId - 新規発行したuser.id
 * @param nickname - 本人が入力した表示名
 */
export const buildRegistrationOptions = (
    config: WebauthnRpConfig,
    userId: string,
    nickname: string,
) =>
    generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        userName: nickname,
        userID: new TextEncoder().encode(userId),
        userDisplayName: nickname,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    });

/**
 * パスキーログイン（`navigator.credentials.get()`）用のオプションを生成する。
 * `allowCredentials` を指定しないdiscoverable credentials方式のため、
 * どのユーザーがログインしようとしているかを事前に知る必要が無い
 * （ユーザー名入力欄を持たないUIにできる）。
 * @param config - RP設定
 */
export const buildAuthenticationOptions = (config: WebauthnRpConfig) =>
    generateAuthenticationOptions({
        rpID: config.rpId,
        userVerification: 'preferred',
    });

/** 登録検証の成功結果（DBへ保存する形に整えたもの）。 */
export interface VerifiedRegistration {
    readonly credentialId: string;
    readonly publicKey: Uint8Array<ArrayBuffer>;
    readonly signCount: number;
    readonly aaguid: string;
}

/**
 * 登録レスポンスを検証する。
 * @param config - RP設定
 * @param response - ブラウザから受け取った登録レスポンス
 * @param expectedChallenge - options生成時に発行したchallenge
 * @returns 検証成功時は保存すべき値。失敗時はnull
 */
export const verifyRegistration = async (
    config: WebauthnRpConfig,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
): Promise<VerifiedRegistration | null> => {
    // クライアントが送ってきた任意のJSONを渡すため、`@simplewebauthn/server`が
    // 構造的に不正な入力（壊れたbase64url・不足フィールド等）を検知して例外を
    // 投げるケースがある。ここで吸収し、呼び出し元（controller）へは
    // `verified: false` と同じ「検証失敗」として一様にnullで通知する
    // （フェイルクローズ、SECURITY-15: 例外を握り潰さず安全側の結果に正規化する）。
    try {
        const result = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpId,
        });
        if (!result.verified) return null;
        return {
            credentialId: result.registrationInfo.credential.id,
            publicKey: result.registrationInfo.credential.publicKey,
            signCount: result.registrationInfo.credential.counter,
            aaguid: result.registrationInfo.aaguid,
        };
    } catch {
        return null;
    }
};

/** DBに保存済みのクレデンシャル（認証検証の入力として渡す最小限の値）。 */
export interface StoredCredential {
    readonly id: string;
    readonly publicKey: Uint8Array<ArrayBuffer>;
    readonly signCount: number;
}

/**
 * 認証（ログイン）レスポンスを検証する。
 * @param config - RP設定
 * @param response - ブラウザから受け取った認証レスポンス
 * @param expectedChallenge - options生成時に発行したchallenge
 * @param storedCredential - レスポンスのcredential idに対応するDB保存済みクレデンシャル
 * @returns 検証成功時は新しいsignCount（クローン検知用にDBへ書き戻す）。失敗時はnull
 */
export const verifyAuthentication = async (
    config: WebauthnRpConfig,
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    storedCredential: StoredCredential,
): Promise<number | null> => {
    // verifyRegistration と同じ理由で例外を吸収する（フェイルクローズ）。
    try {
        const result = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpId,
            credential: {
                id: storedCredential.id,
                publicKey: storedCredential.publicKey,
                counter: storedCredential.signCount,
            },
        });
        if (!result.verified) return null;
        return result.authenticationInfo.newCounter;
    } catch {
        return null;
    }
};
