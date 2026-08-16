import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { appLogger, runWithRequestId } from '@race-schedule/core';

/**
 * appLogger テスト
 *
 * ## デシジョンテーブル: appLogger methods
 *
 * | # | Method | Environment | Expected | Coverage |
 * |----|--------|-------------|----------|----------|
 * | 1  | debug | NODE_ENV=development | console.debug called | Line |
 * | 2  | debug | ENVIRONMENT=test | console.debug called | Branch |
 * | 3  | debug | NODE_ENV=production | console.debug not called | Branch |
 * | 4  | debug | ENVIRONMENT=production | console.debug not called | Branch |
 * | 5  | info | any | console.log called | Line |
 * | 6  | warn | any | console.warn called | Line |
 * | 7  | error | any with args | console.error called with args | Line |
 * | 8  | info | production | console.log called (info always logs) | Line |
 * | 9  | warn | production | console.warn called (warn always logs) | Line |
 * | 10 | error | production | console.error called (error always logs) | Line |
 * | 11 | debug | production + LOG_LEVEL=debug | console.debug called（OBS-002） | Branch |
 * | 12 | debug | production + LOG_LEVEL=info | console.debug not called（OBS-002） | Branch |
 * | 13 | info | WORKER_NAME設定時 | JSON1行（level/timestamp/worker/message/meta）（OBS-001） | Branch |
 * | 14 | error | WORKER_NAME設定時・引数無し | meta キーを含まないJSON | Branch |
 * | 15 | error | WORKER_NAME設定時・複数引数 | meta が配列になるJSON | Branch |
 * | 16 | info | WORKER_NAME設定時・runWithRequestIdスコープ内 | requestId フィールドを含む（OBS-004） | Branch |
 * | 17 | info | WORKER_NAME設定時・runWithRequestIdスコープ外 | requestId フィールドが無い | Branch |
 */

describe('appLogger', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalEnvironment = process.env.ENVIRONMENT;
    const originalLogLevel = process.env.LOG_LEVEL;
    const originalWorkerName = process.env.WORKER_NAME;

    beforeEach(() => {
        process.env.NODE_ENV = undefined;
        process.env.ENVIRONMENT = undefined;
        process.env.LOG_LEVEL = undefined;
        process.env.WORKER_NAME = undefined;
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.ENVIRONMENT = originalEnvironment;
        process.env.LOG_LEVEL = originalLogLevel;
        process.env.WORKER_NAME = originalWorkerName;
    });

    it('debug_development環境_console.debugが呼ばれる', () => {
        process.env.NODE_ENV = 'development';
        const debugSpy = spyOn(console, 'debug').mockImplementation(() => {});

        appLogger.debug('debug message', { id: 1 });

        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0]?.[0]).toContain('[DEBUG]');
        expect(debugSpy.mock.calls[0]?.[0]).toContain('debug message');
        expect(debugSpy.mock.calls[0]?.[1]).toEqual({ id: 1 });

        debugSpy.mockRestore();
    });

    it('debug_ENVIRONMENTがtest_console.debugが呼ばれる', () => {
        process.env.ENVIRONMENT = 'test';
        const debugSpy = spyOn(console, 'debug').mockImplementation(() => {});

        appLogger.debug('visible in test env');

        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0]?.[0]).toContain('visible in test env');

        debugSpy.mockRestore();
    });

    it('debug_production環境_console.debugが呼ばれない', () => {
        process.env.NODE_ENV = 'production';
        const debugSpy = spyOn(console, 'debug').mockImplementation(() => {});

        appLogger.debug('hidden in production');

        expect(debugSpy).toHaveBeenCalledTimes(0);

        debugSpy.mockRestore();
    });

    it('debug_ENVIRONMENTがproduction_console.debugが呼ばれない', () => {
        process.env.ENVIRONMENT = 'production';
        const debugSpy = spyOn(console, 'debug').mockImplementation(() => {});

        appLogger.debug('hidden by ENVIRONMENT');

        expect(debugSpy).toHaveBeenCalledTimes(0);

        debugSpy.mockRestore();
    });

    it('info_任意の環境_console.logがprefixとメッセージと追加引数付きで呼ばれる', () => {
        const logSpy = spyOn(console, 'log').mockImplementation(() => {});

        appLogger.info('info message', { id: 2 });

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0]?.[0]).toContain('[INFO]');
        expect(logSpy.mock.calls[0]?.[0]).toContain('info message');
        expect(logSpy.mock.calls[0]?.[1]).toEqual({ id: 2 });

        logSpy.mockRestore();
    });

    it('info_production環境下_console.logが呼ばれ続ける', () => {
        process.env.NODE_ENV = 'production';
        const logSpy = spyOn(console, 'log').mockImplementation(() => {});

        appLogger.info('visible in production');

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0]?.[0]).toContain('[INFO]');
        expect(logSpy.mock.calls[0]?.[0]).toContain('visible in production');

        logSpy.mockRestore();
    });

    it('warn_任意の環境_console.warnがprefixとメッセージと追加引数付きで呼ばれる', () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

        appLogger.warn('warn message', { code: 'W1' });

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('[WARN]');
        expect(warnSpy.mock.calls[0]?.[0]).toContain('warn message');
        expect(warnSpy.mock.calls[0]?.[1]).toEqual({ code: 'W1' });

        warnSpy.mockRestore();
    });

    it('warn_production環境下_console.warnが呼ばれ続ける', () => {
        process.env.NODE_ENV = 'production';
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

        appLogger.warn('visible in production');

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('[WARN]');
        expect(warnSpy.mock.calls[0]?.[0]).toContain('visible in production');

        warnSpy.mockRestore();
    });

    it('error_任意の環境_console.errorがprefixとメッセージと追加引数付きで呼ばれる', () => {
        const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
        const cause = new Error('cause error');

        appLogger.error('error message', cause);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toContain('[ERROR]');
        expect(errorSpy.mock.calls[0]?.[0]).toContain('error message');
        expect(errorSpy.mock.calls[0]?.[1]).toBe(cause);

        errorSpy.mockRestore();
    });

    it('error_production環境下_console.errorが呼ばれ続ける', () => {
        process.env.NODE_ENV = 'production';
        const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

        appLogger.error('visible in production');

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toContain('[ERROR]');
        expect(errorSpy.mock.calls[0]?.[0]).toContain('visible in production');

        errorSpy.mockRestore();
    });

    describe('LOG_LEVEL による本番デバッグログの動的切替（OBS-002）', () => {
        it('debug_production環境かつLOG_LEVEL=debug_console.debugが呼ばれる', () => {
            process.env.NODE_ENV = 'production';
            process.env.LOG_LEVEL = 'debug';
            const debugSpy = spyOn(console, 'debug').mockImplementation(
                () => {},
            );

            appLogger.debug('visible via LOG_LEVEL override');

            expect(debugSpy).toHaveBeenCalledTimes(1);

            debugSpy.mockRestore();
        });

        it('debug_production環境かつLOG_LEVEL=info_console.debugが呼ばれない', () => {
            process.env.NODE_ENV = 'production';
            process.env.LOG_LEVEL = 'info';
            const debugSpy = spyOn(console, 'debug').mockImplementation(
                () => {},
            );

            appLogger.debug('still hidden');

            expect(debugSpy).toHaveBeenCalledTimes(0);

            debugSpy.mockRestore();
        });
    });

    describe('WORKER_NAME設定時のJSON構造化ログ出力（OBS-001）', () => {
        it('info_WORKER_NAME設定時_level_timestamp_worker_messageを含むJSONが出力される', () => {
            process.env.WORKER_NAME = 'api';
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            appLogger.info('structured message');

            expect(logSpy).toHaveBeenCalledTimes(1);
            const output = JSON.parse(
                logSpy.mock.calls[0]?.[0] as string,
            ) as Record<string, unknown>;
            expect(output.level).toBe('INFO');
            expect(typeof output.timestamp).toBe('string');
            expect(output.worker).toBe('api');
            expect(output.message).toBe('structured message');
            expect(output.meta).toBeUndefined();

            logSpy.mockRestore();
        });

        it('error_WORKER_NAME設定時・引数無し_metaキーを含まないこと', () => {
            process.env.WORKER_NAME = 'batch';
            const errorSpy = spyOn(console, 'error').mockImplementation(
                () => {},
            );
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            appLogger.error('no extra info');

            // WORKER_NAME設定時はJSON構造化ログ経路（console.log）を使うため、
            // console.error 自体は呼ばれない。
            expect(errorSpy).toHaveBeenCalledTimes(0);
            expect(logSpy).toHaveBeenCalledTimes(1);
            const raw = logSpy.mock.calls[0]?.[0] as string;
            expect(raw.includes('"meta"')).toBe(false);

            errorSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('error_WORKER_NAME設定時・単一引数_metaに値がそのまま入ること', () => {
            process.env.WORKER_NAME = 'batch';
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});
            const cause = { name: 'Error', message: 'boom' };

            appLogger.error('failed', cause);

            const output = JSON.parse(
                logSpy.mock.calls[0]?.[0] as string,
            ) as Record<string, unknown>;
            expect(output.meta).toEqual(cause);

            logSpy.mockRestore();
        });

        it('error_WORKER_NAME設定時・複数引数_metaが配列になること', () => {
            process.env.WORKER_NAME = 'batch';
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            appLogger.error('failed', 'reason-a', { code: 1 });

            const output = JSON.parse(
                logSpy.mock.calls[0]?.[0] as string,
            ) as Record<string, unknown>;
            expect(output.meta).toEqual(['reason-a', { code: 1 }]);

            logSpy.mockRestore();
        });

        it('info_WORKER_NAME設定時かつrunWithRequestIdスコープ内_requestIdフィールドを含むこと', () => {
            process.env.WORKER_NAME = 'api';
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            runWithRequestId('req-abc-123', () => {
                appLogger.info('inside request scope');
            });

            const output = JSON.parse(
                logSpy.mock.calls[0]?.[0] as string,
            ) as Record<string, unknown>;
            expect(output.requestId).toBe('req-abc-123');

            logSpy.mockRestore();
        });

        it('info_WORKER_NAME設定時かつrunWithRequestIdスコープ外_requestIdフィールドが無いこと', () => {
            process.env.WORKER_NAME = 'api';
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            appLogger.info('outside request scope');

            const raw = logSpy.mock.calls[0]?.[0] as string;
            expect(raw.includes('"requestId"')).toBe(false);

            logSpy.mockRestore();
        });
    });
});
