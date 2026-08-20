import { z } from 'zod';

export const FavoriteAddRequestSchema = z.object({
    raceId: z.string(),
});

export const FavoriteRemoveRequestSchema = z.object({
    raceId: z.string(),
});
