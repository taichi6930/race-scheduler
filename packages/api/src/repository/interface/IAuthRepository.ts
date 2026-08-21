/** admin から発行された招待。 */
export interface InviteRecord {
    readonly token: string;
    readonly memo: string | null;
}

/** DBに保存済みのWebAuthnクレデンシャル。 */
export interface CredentialRecord {
    readonly id: string;
    readonly userId: string;
    readonly publicKey: Uint8Array<ArrayBuffer>;
    readonly signCount: number;
}

/** 新規登録するクレデンシャルの入力値。 */
export interface NewCredentialInput {
    readonly id: string;
    readonly userId: string;
    readonly publicKey: Uint8Array<ArrayBuffer>;
    readonly signCount: number;
    readonly aaguid: string | null;
    readonly userAgent: string | null;
    readonly deviceLabel: string;
}

/** WebAuthnのchallenge一時保存レコード。 */
export interface ChallengeRecord {
    readonly challenge: string;
    readonly purpose: 'register' | 'login';
    readonly inviteToken: string | null;
}

/** 有効なセッション。 */
export interface SessionRecord {
    readonly userId: string;
    readonly credentialId: string;
}

/** 招待コードを持たないユーザーが送る参加リクエスト。 */
export interface JoinRequestRecord {
    readonly id: string;
    readonly nickname: string;
    readonly status: 'pending' | 'approved' | 'rejected';
    readonly inviteToken: string | null;
}

/** admin の参加者一覧に表示する1行分。 */
export interface ParticipantRow {
    readonly userId: string;
    readonly nickname: string;
    readonly inviteMemo: string | null;
    readonly credentialId: string;
    readonly deviceLabel: string;
    readonly lastUsedAt: string | null;
    readonly userCreatedAt: string;
}

/**
 * パスキー認証(user/credential/invite/session/webauthn_challenge)のRepository。
 */
export interface IAuthRepository {
    createInvite: (
        token: string,
        memo: string | null,
        expiresAt: string,
    ) => Promise<void>;
    findValidInvite: (token: string) => Promise<InviteRecord | null>;
    markInviteUsed: (token: string, userId: string) => Promise<void>;

    createUser: (id: string, nickname: string) => Promise<void>;
    findUserNickname: (id: string) => Promise<string | null>;

    createCredential: (credential: NewCredentialInput) => Promise<void>;
    findCredentialById: (id: string) => Promise<CredentialRecord | null>;
    touchCredential: (id: string, signCount: number) => Promise<void>;
    /** 呼び出し元userIdが所有するクレデンシャルに限り、端末ラベルを更新する。 */
    renameCredential: (
        id: string,
        userId: string,
        deviceLabel: string,
    ) => Promise<boolean>;

    createChallenge: (
        id: string,
        challenge: string,
        purpose: 'register' | 'login',
        inviteToken: string | null,
        expiresAt: string,
    ) => Promise<void>;
    /** challengeを取得し、成否によらず消費（削除）する。期限切れ・不存在ならnull。 */
    consumeChallenge: (id: string) => Promise<ChallengeRecord | null>;

    createSession: (
        token: string,
        userId: string,
        credentialId: string,
        expiresAt: string,
    ) => Promise<void>;
    /** 有効なセッションを検証し、あわせて有効期限を延長する（スライディングウィンドウ）。 */
    validateAndRefreshSession: (
        token: string,
        newExpiresAt: string,
    ) => Promise<SessionRecord | null>;
    deleteSession: (token: string) => Promise<void>;

    listParticipants: () => Promise<ParticipantRow[]>;

    createJoinRequest: (id: string, nickname: string) => Promise<void>;
    findJoinRequestById: (id: string) => Promise<JoinRequestRecord | null>;
    listPendingJoinRequests: () => Promise<JoinRequestRecord[]>;
    /** pending状態のリクエストのみ承認し、招待トークンを紐付ける。対象が無い/pendingでなければfalse。 */
    approveJoinRequest: (id: string, inviteToken: string) => Promise<boolean>;
    /** pending状態のリクエストのみ却下する。対象が無い/pendingでなければfalse。 */
    rejectJoinRequest: (id: string) => Promise<boolean>;
}
