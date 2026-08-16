import type { MockFn } from '@race-schedule/core/test';
import { container } from 'tsyringe';

// afterEachで使用する共通のモッククリア関数
interface RepositoryWithCalls {
    [key: string]: { calls?: unknown[] } | unknown;
}

export const clearMocks = (): void => {
    const repositoryBindings = [
        'RaceRepository',
        'PlayerRepository',
        'PlaceRepository',
        'PushSubscriptionRepository',
        'PushRequestRepository',
        'WebPushSendRepository',
    ];

    for (const bindingName of repositoryBindings) {
        try {
            const repository = container.resolve<unknown>(bindingName);
            if (repository && typeof repository === 'object') {
                const repoObj = repository as RepositoryWithCalls;
                for (const key of Object.keys(repoObj)) {
                    const value = repoObj[key];
                    if (
                        value &&
                        typeof value === 'object' &&
                        'calls' in value &&
                        Array.isArray(value.calls)
                    ) {
                        value.calls.length = 0;
                    }
                }
            }
        } catch {
            // リポジトリが未登録の場合はスキップ
        }
    }
};

interface BunMockFn {
    mock?: { calls: unknown[][] };
}

// テスト用ヘルパー：toHaveBeenCalledWith の代わり
export function assertCalledWith(
    mockFn: MockFn | BunMockFn,
    ...expectedArgs: unknown[]
): void {
    // Bun mock の場合（mock.calls 構造）
    // mockFn は function の場合もあるので typeof mockFn !== 'undefined' でチェック
    if (mockFn && typeof mockFn === 'function' && 'mock' in mockFn) {
        const bunMock = mockFn as BunMockFn;
        if (bunMock.mock?.calls) {
            const found = bunMock.mock.calls.some(
                (call: unknown[]) =>
                    JSON.stringify(call) === JSON.stringify(expectedArgs),
            );
            if (!found) {
                throw new Error(
                    `Expected mock to be called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(bunMock.mock.calls)}`,
                );
            }
        } else {
            throw new Error(
                'Invalid mock function: missing mock.calls property',
            );
        }
    }
    // custom MockFn の場合（直接 calls プロパティ）
    else if (mockFn && typeof mockFn === 'object' && 'calls' in mockFn) {
        const calls = mockFn.calls as unknown[];
        if (!Array.isArray(calls) || calls.length === 0) {
            throw new Error(
                `Expected mock to be called with ${JSON.stringify(expectedArgs)}, but mock was never called`,
            );
        }
        const found = (calls as unknown[][]).some(
            (call: unknown[]) =>
                JSON.stringify(call) === JSON.stringify(expectedArgs),
        );
        if (!found) {
            throw new Error(
                `Expected mock to be called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(calls)}`,
            );
        }
    } else {
        throw new Error('Invalid mock function: missing calls property');
    }
}
