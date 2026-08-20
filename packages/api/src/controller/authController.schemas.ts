import { z } from 'zod';

/** ニックネーム・端末ラベルの最大長（表示用途のため妥当な上限を設ける、SECURITY-05）。 */
const NICKNAME_MAX_LENGTH = 50;
const DEVICE_LABEL_MAX_LENGTH = 256;
/** User-Agentヘッダーの最大長。クライアント自己申告値のため長さで頭打ちにする。 */
const USER_AGENT_MAX_LENGTH = 512;
/** 招待メモ(admin専用)の最大長。 */
const MEMO_MAX_LENGTH = 200;

/**
 * WebAuthnのレスポンス（`navigator.credentials.create()`/`get()`の戻り値をJSON化した形）の
 * 構造的な最小限の検証。深部の暗号学的な妥当性は`@simplewebauthn/server`側の検証に委ねる
 * （このスキーマは「そもそもWebAuthnレスポンスの形をしていない入力」を弾く境界防御）。
 */
const WebauthnResponseSchema = z
    .object({
        id: z.string().min(1),
        rawId: z.string().min(1),
        type: z.string().min(1),
        response: z.record(z.string(), z.unknown()),
    })
    .loose();

export const InviteIssueRequestSchema = z.object({
    memo: z.string().max(MEMO_MAX_LENGTH).nullable().optional(),
});

export const InviteVerifyRequestSchema = z.object({
    token: z.string().min(1),
});

export const RegistrationOptionsRequestSchema = z.object({
    inviteToken: z.string().min(1),
});

export const RegistrationVerifyRequestSchema = z.object({
    challengeId: z.string().min(1),
    nickname: z.string().min(1).max(NICKNAME_MAX_LENGTH),
    deviceLabel: z.string().min(1).max(DEVICE_LABEL_MAX_LENGTH),
    credentialResponse: WebauthnResponseSchema,
});

export const LoginVerifyRequestSchema = z.object({
    challengeId: z.string().min(1),
    credentialResponse: WebauthnResponseSchema,
});

export const RenameCredentialRequestSchema = z.object({
    deviceLabel: z.string().min(1).max(DEVICE_LABEL_MAX_LENGTH),
});

export { USER_AGENT_MAX_LENGTH };
