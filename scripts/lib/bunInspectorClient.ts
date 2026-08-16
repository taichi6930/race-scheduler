/**
 * @file bun の Inspector Protocol（`--inspect-wait`）に接続し、テスト実行イベントを収集する。
 *
 * `bun test --reporter=junit` は失敗の詳細メッセージ・テストケース単位の実時刻を出力しない
 * （実機検証済み）。bun は WebKit Inspector Protocol を拡張した `TestReporter`/`LifecycleReporter`
 * ドメインでこれらの情報をイベントとして公開しており、本モジュールはそれに接続してイベントを
 * 収集する。プロトコル仕様・実機検証で確定した挙動は
 * `aidlc-docs/inception/application-design/allure-inspector-reporter-design.md` §2 を正とする
 * （公式ドキュメントはイベント名の列挙のみでペイロード・ハンドシェイクの記載が無いため）。
 *
 * ハンドシェイク（設計書 §2.1）: `Console.enable` → `TestReporter.enable` →
 * `LifecycleReporter.enable` → `Inspector.enable` → `Inspector.initialized` の順に送るまで
 * `--inspect-wait` は解除されない。`Runtime.runIfWaitingForDebugger` は存在せず、
 * `Debugger.resume` はエラーになる（どちらも不要）。
 *
 * tail flush の罠（設計書 §2.5）: `proc.exited` 直後に読み取りを打ち切ると末尾イベントを
 * 取りこぼす。本モジュールは WebSocket の `close` イベントを待ってから収集を終える。
 */

/** 収集対象のイベント（受信時刻付き）。JSONL の1行に対応する。 */
export interface InspectorEvent {
    /** イベントをこのプロセスが受信した時刻（epoch ms）。CICD-66 の実時刻はこれに基づく */
    t: number;
    /** Inspector Protocol のメソッド名（例: `TestReporter.found`） */
    m: string;
    p: unknown;
}

/**
 * 収集対象のイベント種別。`Debugger.scriptParsed` 等の無関係なイベントや、
 * 自分が送ったコマンドへのレスポンス（`method` を持たない）は除外する。
 */
const RELEVANT_METHODS = new Set([
    'TestReporter.found',
    'TestReporter.start',
    'TestReporter.end',
    'LifecycleReporter.error',
    'Console.messageAdded',
]);

export const isRelevantInspectorMethod = (method: string): boolean =>
    RELEVANT_METHODS.has(method);

export const toInspectorEvent = (
    t: number,
    method: string,
    params: unknown,
): InspectorEvent => ({ t, m: method, p: params });

/** JSONL の1行を組み立てる（末尾改行は含まない）。 */
export const formatInspectorEventLine = (event: InspectorEvent): string =>
    JSON.stringify(event);

const HANDSHAKE_METHODS = [
    'Console.enable',
    'TestReporter.enable',
    'LifecycleReporter.enable',
    'Inspector.enable',
    'Inspector.initialized',
] as const;

interface RawInspectorMessage {
    method?: string;
    params?: unknown;
}

/** 1回だけ接続を試みる。`timeoutMs` 以内に open しなければ null を返す。 */
const tryConnectOnce = (
    url: string,
    timeoutMs: number,
): Promise<WebSocket | null> =>
    new Promise((resolve) => {
        let settled = false;
        const finish = (value: WebSocket | null): void => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const socket = new WebSocket(url);
        socket.addEventListener('open', () => finish(socket), { once: true });
        socket.addEventListener('error', () => finish(null), { once: true });
        socket.addEventListener('close', () => finish(null), { once: true });
        setTimeout(() => finish(null), timeoutMs);
    });

/**
 * `totalTimeoutMs` の予算内で接続をリトライする（bun プロセスの起動・listen 開始を待つため）。
 * 予算を使い切っても接続できなければ null を返す（呼び出し側はフォールバックすること。
 * 設計書 §5-1: 放置すると `--inspect-wait` で子プロセスが永久にハングする）。
 */
const connectWithRetry = async (
    url: string,
    totalTimeoutMs: number,
): Promise<WebSocket | null> => {
    const deadline = Date.now() + totalTimeoutMs;
    while (Date.now() < deadline) {
        const ws = await tryConnectOnce(url, 1000);
        if (ws) return ws;
        await Bun.sleep(100);
    }
    return null;
};

export interface RunInspectorSessionOptions {
    url: string;
    /** 接続確立の総タイムアウト（既定30秒。設計書 §5 の watchdog） */
    connectTimeoutMs?: number;
    /** 関連イベントを受信するたびに呼ばれる（JSONL へのストリーミング書き込み用） */
    onEvent: (event: InspectorEvent) => void;
}

export interface InspectorSessionResult {
    /** false の場合、接続できなかった（フォールバックすべき） */
    connected: boolean;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Inspector に接続し、ハンドシェイクを行い、WebSocket が閉じるまでイベントを収集する。
 * 接続できなかった場合は `{connected: false}` を返す（呼び出し側での子プロセス kill は
 * 責務外——このモジュールはプロトコル層のみを扱う）。
 */
export const runInspectorSession = async (
    opts: RunInspectorSessionOptions,
): Promise<InspectorSessionResult> => {
    const ws = await connectWithRetry(
        opts.url,
        opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    );
    if (!ws) return { connected: false };

    const closed = new Promise<void>((resolve) => {
        ws.addEventListener('close', () => resolve(), { once: true });
    });
    ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data as string) as RawInspectorMessage;
        if (!msg.method || !isRelevantInspectorMethod(msg.method)) return;
        opts.onEvent(toInspectorEvent(Date.now(), msg.method, msg.params));
    });

    let id = 1;
    for (const method of HANDSHAKE_METHODS) {
        ws.send(JSON.stringify({ id: id++, method, params: {} }));
    }

    await closed;
    return { connected: true };
};
