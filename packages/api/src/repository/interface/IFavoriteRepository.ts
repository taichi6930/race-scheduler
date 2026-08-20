/** お気に入りレース(favorite)のRepository。user単位のデータ。 */
export interface IFavoriteRepository {
    fetch: (userId: string) => Promise<string[]>;
    add: (userId: string, raceId: string) => Promise<void>;
    remove: (userId: string, raceId: string) => Promise<void>;
}
