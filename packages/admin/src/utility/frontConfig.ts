/**
 * front（一般ユーザー向けFlutter Webアプリ）の招待URL組み立て
 *
 * front自体のベースURLは`@race-schedule/core`の`CloudFlareEnv`型定義にまだ
 * 存在せず、admin単独の招待発行機能のためだけにcore（他パッケージ横断の
 * 共有ファイル）へ変更を加えるのは避けたい。`isProductionAdmin.ts`と同じ理由で
 * `process.env`を直接読む（`EnvStore`/`CloudFlareEnv`経由にしない）。
 * `FRONT_BASE_URL`が未設定の環境でも招待発行機能自体は動作させたいため、
 * 未設定時は相対パスにフォールバックする。
 *
 * frontはgo_routerのURL戦略を`usePathUrlStrategy()`で切り替えておらず、既定の
 * ハッシュベースルーティングのまま（`app_router.dart`）のため、招待URLは
 * `/invite/<token>`という通常のパスではなく`#/invite/<token>`という
 * ハッシュフラグメントで組み立てる必要がある。パス形式で発行すると、
 * 直接そのURLへアクセスした際にgo_routerが`/invite/:token`ルートを認識できず、
 * 未ログイン扱いで`/login`へリダイレクトされてしまい、招待登録が完了できない
 * （本番で発覚した不具合の修正）。
 */

/**
 * 発行済みトークンから招待URLを組み立てる。
 * @param token - 発行された招待トークン
 * @returns `FRONT_BASE_URL`設定済みなら絶対URL、未設定なら相対パス `/#/invite/<token>`
 */
export const buildInviteUrl = (token: string): string => {
    const base = process.env.FRONT_BASE_URL;
    if (!base) return `/#/invite/${token}`;
    const url = new URL(base);
    url.hash = `/invite/${token}`;
    return url.toString();
};
