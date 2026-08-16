/**
 * YoutubeのライブURLを取得する
 * @param userId - YoutubeのユーザーアカウントのユーザーID
 * @returns 指定したYoutubeユーザーのライブ配信URL
 */
export const createYoutubeLiveUrl = (userId: string): string =>
    `https://www.youtube.com/@${userId}/stream`;
