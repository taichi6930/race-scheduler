import { DI_TOKENS, EnvStore, LogAllMethods } from '@race-schedule/core';
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { inject, injectable } from 'tsyringe';
import type {
    CredentialRecord,
    IAuthRepository,
} from '../../repository/interface/IAuthRepository';
import { buildSuggestedDeviceLabel } from '../../utility/aaguidLabels';
import { generateOpaqueToken } from '../../utility/opaqueToken';
import {
    buildAuthenticationOptions,
    buildRegistrationOptions,
    resolveWebauthnRpConfig,
    type VerifiedRegistration,
    verifyAuthentication,
    verifyRegistration,
} from '../../utility/webauthn';
import type {
    AuthResult,
    IAuthUsecase,
    InviteVerifyResult,
    LoginOptionsResult,
    LoginVerifyInput,
    RegistrationOptionsResult,
    RegistrationVerifyInput,
} from '../interface/IAuthUsecase';

/** 招待の有効期限（発行から1日）。 */
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
/** セッションの有効期限（スライディングウィンドウ、使うたび7日後へ延長）。 */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** WebAuthn challengeの有効期限（登録/ログイン儀式を完了するまでの猶予）。 */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@LogAllMethods
@injectable()
export class AuthUsecase implements IAuthUsecase {
    public constructor(
        @inject(DI_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository,
    ) {}

    public async issueInvite(memo: string | null): Promise<{ token: string }> {
        const token = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
        await this.authRepository.createInvite(token, memo, expiresAt);
        return { token };
    }

    public async verifyInvite(token: string): Promise<InviteVerifyResult> {
        const invite = await this.authRepository.findValidInvite(token);
        return { valid: invite !== null };
    }

    public async getRegistrationOptions(
        inviteToken: string,
    ): Promise<RegistrationOptionsResult | null> {
        const config = resolveWebauthnRpConfig(EnvStore.env);
        if (!config) return null;

        const invite = await this.authRepository.findValidInvite(inviteToken);
        if (!invite) return null;

        // userIDはこの時点ではWebAuthnのuserHandle欄を埋めるためだけに使う値で、
        // 実際にDBへ保存するuser.idはverifyRegistration側で別途新規発行する
        // （両者を一致させる必要は無い。userHandleは同一RP内でのクレデンシャル
        // 識別に使われるだけで、アプリ側のuser.idと結びつける必要は無い設計）。
        // userName/userDisplayNameには招待のmemo（管理者専用・本人非公開の
        // メモ）を使わない。ブラウザのパスキー保存ダイアログに表示されうる値
        // のため、本人がまだ入力していないニックネームの代わりに、この時点では
        // 中立な固定文言を渡す（ニックネーム自体はverifyRegistration側で受け取り、
        // credential.deviceLabelやuser.nicknameに反映する）。
        const options = await buildRegistrationOptions(
            config,
            crypto.randomUUID(),
            '新しい参加者',
        );

        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
        await this.authRepository.createChallenge(
            challengeId,
            options.challenge,
            'register',
            inviteToken,
            expiresAt,
        );

        return { challengeId, options };
    }

    public async verifyRegistration(
        input: RegistrationVerifyInput,
    ): Promise<AuthResult | null> {
        const config = resolveWebauthnRpConfig(EnvStore.env);
        if (!config) return null;

        const challenge = await this.authRepository.consumeChallenge(
            input.challengeId,
        );
        if (!challenge) return null;
        if (challenge.purpose !== 'register') return null;
        if (!challenge.inviteToken) return null;

        // verify直前に招待の有効性を再チェックする（options生成〜verifyの間に
        // 期限切れ・他デバイスで先に消費された可能性があるため、TOCTOUを避ける）。
        const invite = await this.authRepository.findValidInvite(
            challenge.inviteToken,
        );
        if (!invite) return null;

        const verified = await verifyRegistration(
            config,
            input.credentialResponse as RegistrationResponseJSON,
            challenge.challenge,
        );
        if (!verified) return null;

        const userId = await this.persistNewAccount(
            verified,
            input.nickname,
            input.userAgent,
            challenge.inviteToken,
        );
        const sessionToken = await this.issueSession(
            userId,
            verified.credentialId,
        );
        return { sessionToken, nickname: input.nickname };
    }

    /**
     * 登録検証成功後の永続化（user作成・credential保存・招待の使用済み化）を
     * まとめる。verifyRegistrationの行数制限（30行）を超えないための分離。
     * @param verified
     * @param nickname
     * @param userAgent
     * @param inviteToken
     * @returns 新規発行したuser.id
     */
    private async persistNewAccount(
        verified: VerifiedRegistration,
        nickname: string,
        userAgent: string | null,
        inviteToken: string,
    ): Promise<string> {
        const userId = crypto.randomUUID();
        await this.authRepository.createUser(userId, nickname);
        await this.authRepository.createCredential({
            id: verified.credentialId,
            userId,
            publicKey: verified.publicKey,
            signCount: verified.signCount,
            aaguid: verified.aaguid,
            userAgent,
            deviceLabel: buildSuggestedDeviceLabel(verified.aaguid, userAgent),
        });
        await this.authRepository.markInviteUsed(inviteToken, userId);
        return userId;
    }

    public async getLoginOptions(): Promise<LoginOptionsResult> {
        const config = resolveWebauthnRpConfig(EnvStore.env);
        if (!config) {
            throw new Error('WEBAUTHN_RP_ID is not configured');
        }

        const options = await buildAuthenticationOptions(config);
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
        await this.authRepository.createChallenge(
            challengeId,
            options.challenge,
            'login',
            null,
            expiresAt,
        );
        return { challengeId, options };
    }

    public async verifyLogin(
        input: LoginVerifyInput,
    ): Promise<AuthResult | null> {
        const config = resolveWebauthnRpConfig(EnvStore.env);
        if (!config) return null;

        const challenge = await this.authRepository.consumeChallenge(
            input.challengeId,
        );
        if (!challenge) return null;
        if (challenge.purpose !== 'login') return null;

        const response = input.credentialResponse as AuthenticationResponseJSON;
        const storedCredential = await this.authRepository.findCredentialById(
            response.id,
        );
        if (!storedCredential) return null;

        const newSignCount = await verifyAuthentication(
            config,
            response,
            challenge.challenge,
            storedCredential,
        );
        if (newSignCount === null) return null;

        return this.finishLogin(storedCredential, newSignCount);
    }

    /**
     * ログイン検証成功後の後処理（signCount更新・セッション発行・nickname取得）を
     * まとめる。verifyLoginの行数制限（30行）を超えないための分離。
     * @param storedCredential
     * @param newSignCount
     */
    private async finishLogin(
        storedCredential: CredentialRecord,
        newSignCount: number,
    ): Promise<AuthResult> {
        await this.authRepository.touchCredential(
            storedCredential.id,
            newSignCount,
        );
        const sessionToken = await this.issueSession(
            storedCredential.userId,
            storedCredential.id,
        );
        const nickname =
            (await this.authRepository.findUserNickname(
                storedCredential.userId,
            )) ?? '';
        return { sessionToken, nickname };
    }

    public async logout(sessionToken: string): Promise<void> {
        await this.authRepository.deleteSession(sessionToken);
    }

    public listParticipants() {
        return this.authRepository.listParticipants();
    }

    public renameCredential(
        userId: string,
        credentialId: string,
        deviceLabel: string,
    ): Promise<boolean> {
        return this.authRepository.renameCredential(
            credentialId,
            userId,
            deviceLabel,
        );
    }

    private async issueSession(
        userId: string,
        credentialId: string,
    ): Promise<string> {
        const token = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await this.authRepository.createSession(
            token,
            userId,
            credentialId,
            expiresAt,
        );
        return token;
    }
}
