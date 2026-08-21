import type {
    JoinRequestRecord,
    ParticipantRow,
} from '../../repository/interface/IAuthRepository';

/** join-requestの現在状態（front側のポーリングに返す値）。 */
export interface JoinRequestStatusResult {
    readonly status: 'pending' | 'approved' | 'rejected';
    /** 承認済みなら、既存の招待登録フロー（getRegistrationOptions）にそのまま渡せる招待トークン。 */
    readonly inviteToken: string | null;
}

export interface InviteVerifyResult {
    readonly valid: boolean;
}

export interface RegistrationOptionsResult {
    readonly challengeId: string;
    /** `navigator.credentials.create()` にそのまま渡すオプション（JSON化済み）。 */
    readonly options: unknown;
}

export interface LoginOptionsResult {
    readonly challengeId: string;
    /** `navigator.credentials.get()` にそのまま渡すオプション（JSON化済み）。 */
    readonly options: unknown;
}

export interface AuthResult {
    readonly sessionToken: string;
    readonly nickname: string;
}

export interface RegistrationVerifyInput {
    readonly challengeId: string;
    readonly nickname: string;
    /** リクエストのUser-Agentヘッダー値（端末ラベルの自動サジェストに使う）。 */
    readonly userAgent: string | null;
    /** ブラウザの `navigator.credentials.create()` が返した値。 */
    readonly credentialResponse: unknown;
}

export interface LoginVerifyInput {
    readonly challengeId: string;
    /** ブラウザの `navigator.credentials.get()` が返した値。 */
    readonly credentialResponse: unknown;
}

/**
 * パスキー(WebAuthn)認証のUsecase。招待発行はadminから、それ以外はfrontから呼ばれる。
 */
export interface IAuthUsecase {
    issueInvite: (memo: string | null) => Promise<{ token: string }>;
    verifyInvite: (token: string) => Promise<InviteVerifyResult>;

    getRegistrationOptions: (
        inviteToken: string,
    ) => Promise<RegistrationOptionsResult | null>;
    verifyRegistration: (
        input: RegistrationVerifyInput,
    ) => Promise<AuthResult | null>;

    getLoginOptions: () => Promise<LoginOptionsResult>;
    verifyLogin: (input: LoginVerifyInput) => Promise<AuthResult | null>;

    logout: (sessionToken: string) => Promise<void>;

    listParticipants: () => Promise<ParticipantRow[]>;

    /** ログイン中の本人が、自分のクレデンシャルの端末ラベルを付け替える。 */
    renameCredential: (
        userId: string,
        credentialId: string,
        deviceLabel: string,
    ) => Promise<boolean>;

    /** 招待コードを持たないユーザーが参加リクエストを送る（front、未ログイン）。 */
    requestJoin: (nickname: string) => Promise<{ requestId: string }>;
    /** リクエストした端末が承認状況をポーリングする（front、未ログイン）。 */
    getJoinRequestStatus: (
        requestId: string,
    ) => Promise<JoinRequestStatusResult | null>;

    /** 承認待ちの参加リクエスト一覧（admin専用、サービス間認証）。 */
    listJoinRequests: () => Promise<JoinRequestRecord[]>;
    /** 参加リクエストを承認し、招待を発行して紐付ける（admin専用）。 */
    approveJoinRequest: (requestId: string) => Promise<boolean>;
    /** 参加リクエストを却下する（admin専用）。 */
    rejectJoinRequest: (requestId: string) => Promise<boolean>;
}
