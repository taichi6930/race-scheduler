export interface IFavoriteUsecase {
    fetch: (userId: string) => Promise<string[]>;
    add: (userId: string, raceId: string) => Promise<void>;
    remove: (userId: string, raceId: string) => Promise<void>;
}
