import {
    badRequest,
    DI_TOKENS,
    getCurrentUserId,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IAuthUsecase } from '../usecase/interface/IAuthUsecase';
import {
    InviteIssueRequestSchema,
    InviteVerifyRequestSchema,
    LoginVerifyRequestSchema,
    RegistrationOptionsRequestSchema,
    RegistrationVerifyRequestSchema,
    RenameCredentialRequestSchema,
    USER_AGENT_MAX_LENGTH,
} from './authController.schemas';

const AUTHORIZATION_HEADER = 'Authorization';
const BEARER_PREFIX = 'Bearer ';

/**
 * `Authorization: Bearer <token>` からトークンを取り出す。
 * @param request - HTTPリクエスト
 */
const extractBearerToken = (request: Request): string | null => {
    const header = request.headers.get(AUTHORIZATION_HEADER);
    if (!header?.startsWith(BEARER_PREFIX)) return null;
    const token = header.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
};

/**
 * リクエストのUser-Agentヘッダーを、表示用途に安全な長さへ切り詰めて取り出す
 * （SECURITY-05: 外部入力の長さ上限）。
 * @param request - HTTPリクエスト
 */
const extractUserAgent = (request: Request): string | null => {
    const value = request.headers.get('User-Agent');
    if (!value) return null;
    return value.slice(0, USER_AGENT_MAX_LENGTH);
};

/**
 * Controller層：パスキー(WebAuthn)認証。招待発行・参加者一覧はadminから
 * サービス間認証で、それ以外はfrontから（一部は未ログインの状態で）呼ばれる。
 */
@LogAllMethods
@injectable()
export class AuthController {
    public constructor(
        @inject(DI_TOKENS.AuthUsecase)
        private readonly usecase: IAuthUsecase,
    ) {}

    /**
     * POST /auth/invite（admin専用、サービス間認証）
     * @param request
     */
    public async issueInvite(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                InviteIssueRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;
            const result = await this.usecase.issueInvite(
                parsed.value.memo ?? null,
            );
            return json(result, 201);
        } catch (error) {
            return handleControllerError(error, 'AuthController.issueInvite');
        }
    }

    /**
     * POST /auth/invite/verify
     * @param request
     */
    public async verifyInvite(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                InviteVerifyRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;
            const result = await this.usecase.verifyInvite(parsed.value.token);
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'AuthController.verifyInvite');
        }
    }

    /**
     * POST /auth/register/options
     * @param request
     */
    public async registrationOptions(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                RegistrationOptionsRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;
            const result = await this.usecase.getRegistrationOptions(
                parsed.value.inviteToken,
            );
            if (!result) return badRequest('招待が無効です', 400);
            return json(result);
        } catch (error) {
            return handleControllerError(
                error,
                'AuthController.registrationOptions',
            );
        }
    }

    /**
     * POST /auth/register/verify
     * @param request
     */
    public async registrationVerify(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                RegistrationVerifyRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;
            const result = await this.usecase.verifyRegistration({
                challengeId: parsed.value.challengeId,
                nickname: parsed.value.nickname,
                userAgent: extractUserAgent(request),
                credentialResponse: parsed.value.credentialResponse,
            });
            if (!result) return badRequest('登録に失敗しました', 400);
            return json(result, 201);
        } catch (error) {
            return handleControllerError(
                error,
                'AuthController.registrationVerify',
            );
        }
    }

    /** POST /auth/login/options */
    public async loginOptions(): Promise<Response> {
        try {
            const result = await this.usecase.getLoginOptions();
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'AuthController.loginOptions');
        }
    }

    /**
     * POST /auth/login/verify
     * @param request
     */
    public async loginVerify(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                LoginVerifyRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;
            const result = await this.usecase.verifyLogin({
                challengeId: parsed.value.challengeId,
                credentialResponse: parsed.value.credentialResponse,
            });
            if (!result) return badRequest('ログインに失敗しました', 401);
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'AuthController.loginVerify');
        }
    }

    /**
     * POST /auth/logout（トークンの有効性を問わず常に成功扱いにする冪等な操作）
     * @param request
     */
    public async logout(request: Request): Promise<Response> {
        try {
            const token = extractBearerToken(request);
            if (token) {
                await this.usecase.logout(token);
            }
            return json({ ok: true });
        } catch (error) {
            return handleControllerError(error, 'AuthController.logout');
        }
    }

    /** GET /auth/participants（admin専用、サービス間認証） */
    public async participants(): Promise<Response> {
        try {
            const result = await this.usecase.listParticipants();
            return json({ participants: result });
        } catch (error) {
            return handleControllerError(error, 'AuthController.participants');
        }
    }

    /**
     * PATCH /auth/credential/:id（セッション認証必須。本人所有のクレデンシャルのみ）
     * @param request - HTTPリクエスト（body: { deviceLabel: string }）
     * @param credentialId - パスパラメータのクレデンシャルID
     */
    public async renameCredential(
        request: Request,
        credentialId: string,
    ): Promise<Response> {
        try {
            const userId = getCurrentUserId();
            if (!userId) return badRequest('Unauthorized', 401);

            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                RenameCredentialRequestSchema,
                body,
            );
            if (!parsed.ok) return parsed.response;

            const renamed = await this.usecase.renameCredential(
                userId,
                credentialId,
                parsed.value.deviceLabel,
            );
            if (!renamed)
                return badRequest('クレデンシャルが見つかりません', 404);
            return json({ ok: true });
        } catch (error) {
            return handleControllerError(
                error,
                'AuthController.renameCredential',
            );
        }
    }
}
