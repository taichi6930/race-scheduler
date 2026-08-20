/**
 * front（一般ユーザー向けFlutter Webアプリ）の招待URL組み立て
 *
 * front自体のベースURLは`@race-schedule/core`の`CloudFlareEnv`型定義にまだ
 * 存在せず、admin単独の招待発行機能のためだけにcore（他パッケージ横断の
 * 共有ファイル）へ変更を加えるのは避けたい。`isProductionAdmin.ts`と同じ理由で
 * `process.env`を直接読む（`EnvStore`/`CloudFlareEnv`経由にしない）。
 * `FRONT_BASE_URL`が未設定の環境でも招待発行機能自体は動作させたいため、
 * 未設定時は相対パスにフォールバックする。
 */

/**
 * 発行済みトークンから招待URLを組み立てる。
 * @param token - 発行された招待トークン
 * @returns `FRONT_BASE_URL`設定済みなら絶対URL、未設定なら相対パス `/invite/<token>`
 */
export const buildInviteUrl = (token: string): string => {
    const base = process.env.FRONT_BASE_URL;
    if (!base) return `/invite/${token}`;
    return new URL(`/invite/${token}`, base).toString();
};
