/** AAGUID（認証器の機種ID）→表示名の対応表。未知のAAGUIDも引けるよう文字列キーで参照する。 */
interface AaguidLabelMap {
    readonly [aaguid: string]: string;
}

/**
 * よく使われるパスキー機構のAAGUID→表示名の対応表（一部のみ）。
 * @remarks
 * FIDO Allianceが公開する完全な対応表（数百件、
 * https://github.com/passkeydeveloper/passkey-authenticator-aaguids）を
 * まるごと取り込む価値は無い（招待した数人の友人が使う認証器は
 * iCloudキーチェーン・Googleパスワードマネージャー・Windows Hello・
 * 主要パスワードマネージャー程度に限られるため）。
 * ponytail: 未知のAAGUIDはgetSuggestedDeviceLabelが汎用ラベルへフォールバックする。
 * 対応表に無い認証器が増えてきたら、上記対応表からの追記を検討する
 * （上限=この一覧のみ、アップグレード経路=行追加）。
 */
const KNOWN_AAGUID_LABELS: AaguidLabelMap = {
    '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
    '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
    'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloudキーチェーン',
    'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4':
        'Chrome / Google パスワードマネージャー',
    'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
    'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
    'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloudキーチェーン (Safari)',
};

/** User-Agent の判定パターン1件（正規表現→表示ラベル）。 */
interface UserAgentPattern {
    readonly pattern: RegExp;
    readonly label: string;
}

/** OS 判定パターン。先頭から順に評価するため、より限定的なものを先に置く。 */
const OS_PATTERNS: readonly UserAgentPattern[] = [
    { pattern: /iPhone|iPad/, label: 'iOS' },
    { pattern: /Android/, label: 'Android' },
    { pattern: /Mac OS X/, label: 'macOS' },
    { pattern: /Windows/, label: 'Windows' },
    { pattern: /Linux/, label: 'Linux' },
];

/** ブラウザ判定パターン。Edge/Chrome は Safari のUAを含むため、この順序を保つこと。 */
const BROWSER_PATTERNS: readonly UserAgentPattern[] = [
    { pattern: /Edg\//, label: 'Edge' },
    { pattern: /Chrome\//, label: 'Chrome' },
    { pattern: /Firefox\//, label: 'Firefox' },
    { pattern: /Safari\//, label: 'Safari' },
];

/**
 * 判定パターン表を先頭から評価し、最初に一致したラベルを返す。
 * @param patterns - 判定パターン表
 * @param userAgent - リクエストのUser-Agentヘッダー値
 */
const matchUserAgentLabel = (
    patterns: readonly UserAgentPattern[],
    userAgent: string,
): string | null =>
    patterns.find((entry) => entry.pattern.test(userAgent))?.label ?? null;

/**
 * User-Agent文字列から「ブラウザ / OS」程度の短い要約を取り出す。
 * ponytail: 網羅的なUAパースは行わない（表示用の初期値サジェストが目的で、
 * 判定を誤っても本人がdeviceLabelを編集すれば済むため）。上限=上記の主要な
 * ブラウザ/OSのみ、アップグレード経路=判定パターンの追記。
 * @param userAgent - リクエストのUser-Agentヘッダー値
 */
const summarizeUserAgent = (userAgent: string): string | null => {
    const os = matchUserAgentLabel(OS_PATTERNS, userAgent);
    const browser = matchUserAgentLabel(BROWSER_PATTERNS, userAgent);

    const hasBothBrowserAndOs = browser !== null && os !== null;
    if (hasBothBrowserAndOs) return `${browser} / ${os}`;
    return browser ?? os;
};

/**
 * AAGUID・User-Agentから初期表示用の端末ラベルを組み立てる。
 * @param aaguid
 * @param userAgent
 */
export const buildSuggestedDeviceLabel = (
    aaguid: string | null,
    userAgent: string | null,
): string => {
    const provider = (aaguid && KNOWN_AAGUID_LABELS[aaguid]) || '不明な端末';
    const summary = userAgent ? summarizeUserAgent(userAgent) : null;
    return summary ? `${provider} (${summary})` : provider;
};
