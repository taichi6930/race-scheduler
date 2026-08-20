import type { ParticipantSummary } from '../../dto/participant';

/**
 * 参加者一覧 Usecase インターフェース。
 */
export interface IParticipantsUsecase {
    /** 招待から登録済みの全参加者（クレデンシャル単位）の一覧を返す。 */
    list: () => Promise<ParticipantSummary[]>;
}
