/**
 * pushUsecase.test.ts - PushUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド            | 条件                        | 期待値                                                        |
 * |---|---------------------|-----------------------------|----------------------------------------------------------------|
 * | 2 | removeSubscription  | endpoint                    | subscriptionRepository.removeWithDependentRequestsをハッシュ化idで呼ぶ（CONC-08） |
 * | 3 | upsertRequest       | subscriptionId, raceId等    | `${subscriptionId}:${raceId}`をidとしてrequestRepository.upsertを呼ぶ |
 * | 4 | removeRequest       | subscriptionId, raceId      | `${subscriptionId}:${raceId}`をidとしてrequestRepository.removeを呼ぶ |
 *
 * ### メソッド: upsertSubscription()（SECPUSH-02、push-ownership-design.md §2.4）
 * | # | findSecretHashByIdの返り値 | params.secret | 期待される結果・副作用 |
 * |----|----------------------------|--------------------|--------------------------|
 * | 1a | undefined（新規行）        | -                   | 新しいシークレットを発行しupsert（secretHash付き）、`{ ok: true, id, secret }` を返す |
 * | 1b | null（既存行・未発行）     | -                   | 新しいシークレットを発行しupsert（secretHash付き）、`{ ok: true, id, secret }` を返す |
 * | 1c | ハッシュ値（既存行・発行済み） | 正しいシークレット | upsert（secretHash無し）を呼び、`{ ok: true, id }`（secretを含まない）を返す |
 * | 1d | ハッシュ値（既存行・発行済み） | 誤ったシークレット | upsertは呼ばれず `{ ok: false }` を返す |
 * | 1e | ハッシュ値（既存行・発行済み） | 未提示（undefined） | upsertは呼ばれず `{ ok: false }` を返す |
 *
 * ### メソッド: dispatchDue()
 * | # | fetchDueの返り値                          | webPushSendRepository.sendの結果       | 期待される副作用 |
 * |---|---------------------------------------------|----------------------------------|-------------------|
 * | 5 | 空配列                                     | -                                 | attempted:0、purgeOldのみ呼ばれる |
 * | 6 | 1件                                        | `{ ok: true }`                    | markSentが呼ばれ、sent:1 |
 * | 7 | 1件                                        | `{ ok: false, gone: true }`       | 購読と予約が削除され、gone:1 |
 * | 8 | 1件                                        | `{ ok: false, gone: false }`      | 何も更新されず、failed:1 |
 * | 9 | 3件（成功/gone/失敗が混在）                  | 各件で異なる結果                  | attempted:3、sent:1、gone:1、failed:1、かつ全件のsendに同一dispatchCache参照が渡ること(PERF-104) |
 * | 9b | 1件（失敗あり、OBS-009）                   | `{ ok: false, gone: false }`      | appLogger.errorでサマリーが出力される |
 * | 9c | 1件（全件成功、OBS-009）                   | `{ ok: true }`                    | appLogger.errorは呼ばれない |
 * | 9d | 2件（1件目のsendが例外をthrow、CONC-07）    | 1件目: throw、2件目: `{ ok: true }` | throwした方はfailedとしてappLogger.warnされ、2件目は継続してsent:1・purgeOldも呼ばれる |
 * | 9e | 1件（送信成功、OBS-024）                    | `{ ok: true }`                    | subscriptionRepository.resetFailureCountが呼ばれる |
 * | 9f | 1件（失敗・連続失敗回数が上限未満、OBS-024） | `{ ok: false, gone: false }`＋incrementFailureCountが2を返す | releaseClaimが呼ばれ、購読は削除されずfailed:1 |
 * | 9g | 1件（失敗・連続失敗回数が上限到達、OBS-024） | `{ ok: false, gone: false }`＋incrementFailureCountが5を返す | 購読が削除されgone:1、releaseClaimは呼ばれない |
 *
 * ### メソッド: sendTest()
 * | # | subscriptionRepository.findByIdの返り値 | webPushSendRepository.sendの結果 | 期待される結果・副作用 |
 * |---|-------------------------------------------|-----------------------------------|-------------------------|
 * | 10 | undefined（購読なし）                     | -                                  | `{ ok: false, message: '購読が見つかりません' }`、sendは呼ばれない |
 * | 11 | 購読あり                                  | `{ ok: true }`                     | `{ ok: true }` |
 * | 12 | 購読あり                                  | `{ ok: false, gone: true }`        | 購読と予約が削除され `{ ok: false, message: '...' }` |
 * | 13 | 購読あり                                  | `{ ok: false, gone: false, message }` | 何も削除されず `{ ok: false, message }` |
 *
 * ### メソッド: purgeStaleSubscriptions()（SEC-053）
 * | # | subscriptionRepository.purgeStaleの返り値 | 期待される結果・副作用 |
 * |---|---------------------------------------------|--------------------------|
 * | 14 | 0（対象なし） | 0を返し、appLogger.infoは呼ばれない |
 * | 15 | 3（3件削除） | 3を返し、appLogger.infoで件数が記録される |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { appLogger, validateRaceId } from '@race-schedule/core';
import { container } from 'tsyringe';
import { PushUsecase } from '../../../../src/usecase/implement/pushUsecase';
import type { IPushUsecase } from '../../../../src/usecase/interface/IPushUsecase';
import {
    hashSubscriptionEndpoint,
    hashSubscriptionSecret,
} from '../../../../src/utility/pushIds';
import {
    assertCalledWith,
    clearMocks,
    type TestRepositorySetup,
} from '../../../common';
import { setupTestRepositoryMock } from '../../../testSetupHelper';

describe('PushUsecase', () => {
    let usecase: IPushUsecase;
    let repositorySetup: TestRepositorySetup;

    beforeEach(() => {
        repositorySetup = setupTestRepositoryMock();
        usecase = container.resolve(PushUsecase);
    });

    afterEach(() => {
        clearMocks();
    });

    describe('upsertSubscription', () => {
        const baseParams = {
            endpoint: 'https://push.example.com/subscription/abc',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        };

        it('1a: 新規行（findSecretHashByIdがundefined）の場合は新しいシークレットを発行すること', async () => {
            repositorySetup.pushSubscriptionRepository.findSecretHashById.mockResolvedValue(
                undefined,
            );

            const result = await usecase.upsertSubscription(baseParams);

            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('unreachable');
            expect(result.id).toBeString();
            expect(result.secret).toBeString();
            const [upsertArgs] =
                repositorySetup.pushSubscriptionRepository.upsert.mock.calls[0];
            expect(upsertArgs).toMatchObject({
                id: result.id,
                ...baseParams,
            });
            expect(upsertArgs.secretHash).toBeString();
            expect(upsertArgs.secretHash?.length).toBeGreaterThan(0);
        });

        it('1b: 既存行だがシークレット未発行（findSecretHashByIdがnull）の場合は新しいシークレットを発行すること', async () => {
            repositorySetup.pushSubscriptionRepository.findSecretHashById.mockResolvedValue(
                null,
            );

            const result = await usecase.upsertSubscription(baseParams);

            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('unreachable');
            expect(result.secret).toBeString();
            const [upsertArgs] =
                repositorySetup.pushSubscriptionRepository.upsert.mock.calls[0];
            expect(upsertArgs.secretHash).toBeString();
        });

        it('1c: 既存行・発行済みで正しいシークレットを提示した場合はsecretHash無しでupsertし、応答にsecretを含めないこと', async () => {
            const presentedSecret = 'correct-secret';
            const existingHash = await hashSubscriptionSecret(presentedSecret);
            repositorySetup.pushSubscriptionRepository.findSecretHashById.mockResolvedValue(
                existingHash,
            );

            const result = await usecase.upsertSubscription({
                ...baseParams,
                secret: presentedSecret,
            });

            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('unreachable');
            expect(result.secret).toBeUndefined();
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository.upsert,
                {
                    id: result.id,
                    ...baseParams,
                },
            );
        });

        it('1d: 既存行・発行済みで誤ったシークレットを提示した場合はupsertを呼ばず{ ok: false }を返すこと', async () => {
            const existingHash =
                await hashSubscriptionSecret('the-real-secret');
            repositorySetup.pushSubscriptionRepository.findSecretHashById.mockResolvedValue(
                existingHash,
            );

            const result = await usecase.upsertSubscription({
                ...baseParams,
                secret: 'wrong-secret',
            });

            expect(result.ok).toBe(false);
            expect(
                repositorySetup.pushSubscriptionRepository.upsert,
            ).not.toHaveBeenCalled();
        });

        it('1e: 既存行・発行済みでシークレットが未提示の場合はupsertを呼ばず{ ok: false }を返すこと', async () => {
            repositorySetup.pushSubscriptionRepository.findSecretHashById.mockResolvedValue(
                'existing-hash',
            );

            const result = await usecase.upsertSubscription(baseParams);

            expect(result.ok).toBe(false);
            expect(
                repositorySetup.pushSubscriptionRepository.upsert,
            ).not.toHaveBeenCalled();
        });
    });

    describe('removeSubscription', () => {
        it('2: subscriptionRepository.removeWithDependentRequestsをハッシュ化idで呼び出すこと（CONC-08）', async () => {
            await usecase.removeSubscription(
                'https://push.example.com/subscription/abc',
            );

            const expectedId = await hashSubscriptionEndpoint(
                'https://push.example.com/subscription/abc',
            );
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequests,
                expectedId,
            );
        });
    });

    describe('upsertRequest', () => {
        it('3: `subscriptionId:raceId`をidとしてrequestRepository.upsertを呼び出すこと', async () => {
            const raceId = validateRaceId('jra202601010101');

            await usecase.upsertRequest({
                subscriptionId: 'sub-1',
                raceId,
                fireAtMs: 1_700_000_000_000,
                title: '皐月賞（GⅠ）',
                body: '中山 11R ・ 発走 5分前',
                url: '/timeline',
            });

            assertCalledWith(repositorySetup.pushRequestRepository.upsert, {
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId,
                fireAtMs: 1_700_000_000_000,
                title: '皐月賞（GⅠ）',
                body: '中山 11R ・ 発走 5分前',
                url: '/timeline',
            });
        });
    });

    describe('removeRequest', () => {
        it('4: `subscriptionId:raceId`をidとしてrequestRepository.removeを呼び出すこと', async () => {
            const raceId = validateRaceId('jra202601010101');

            await usecase.removeRequest('sub-1', raceId);

            assertCalledWith(
                repositorySetup.pushRequestRepository.remove,
                'sub-1:jra202601010101',
            );
        });
    });

    describe('dispatchDue', () => {
        const buildDueRecord = (
            overrides: Partial<{
                id: string;
                subscriptionId: string;
            }> = {},
        ) => ({
            id: overrides.id ?? 'sub-1:jra202601010101',
            subscriptionId: overrides.subscriptionId ?? 'sub-1',
            raceId: 'jra202601010101',
            fireAtMs: 1_700_000_000_000,
            title: '皐月賞（GⅠ）',
            body: '中山 11R ・ 発走 5分前',
            url: '/timeline',
            endpoint: 'https://push.example.com/subscription/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        });

        it('5: 期限到来分が無い場合はattempted:0でpurgeOldのみ呼ばれること', async () => {
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue(
                [],
            );

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 0,
                sent: 0,
                gone: 0,
                failed: 0,
            });
            expect(
                repositorySetup.pushRequestRepository.purgeOld.mock.calls,
            ).toHaveLength(1);
            expect(
                repositorySetup.webPushSendRepository.send.mock.calls,
            ).toHaveLength(0);
        });

        it('6: 送信成功した場合はmarkSentが呼ばれsent:1になること', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: true,
            });

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 1,
                sent: 1,
                gone: 0,
                failed: 0,
            });
            assertCalledWith(
                repositorySetup.pushRequestRepository.markSentBatch,
                [record.id],
            );
        });

        it('6b (QNTF-02): 送信ペイロードにraceIdが含まれ通知tagの元になること', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: true,
            });

            await usecase.dispatchDue(1_700_000_100_000);

            const [, payload] =
                repositorySetup.webPushSendRepository.send.mock.calls[0];
            expect(payload).toMatchObject({ raceId: record.raceId });
        });

        it('7: 購読が失効している場合は購読と予約が削除されgone:1になること', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: true,
                message: 'gone',
            });

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 1,
                sent: 0,
                gone: 1,
                failed: 0,
            });
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequestsBatch,
                [record.subscriptionId],
            );
            expect(
                repositorySetup.pushRequestRepository.markSentBatch.mock.calls,
            ).toHaveLength(0);
        });

        it('8: 送信失敗（gone以外）の場合は何も更新されずfailed:1になること', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: false,
                message: 'push service error',
            });

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 1,
                sent: 0,
                gone: 0,
                failed: 1,
            });
            expect(
                repositorySetup.pushRequestRepository.markSentBatch.mock.calls,
            ).toHaveLength(0);
            expect(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequestsBatch.mock.calls,
            ).toHaveLength(0);
        });

        it('9: 複数件の結果が混在する場合は件数が正しく集計されること', async () => {
            const sentRecord = buildDueRecord({ id: 'sub-1:race-1' });
            const goneRecord = buildDueRecord({
                id: 'sub-2:race-2',
                subscriptionId: 'sub-2',
            });
            const failedRecord = buildDueRecord({
                id: 'sub-3:race-3',
                subscriptionId: 'sub-3',
            });
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                sentRecord,
                goneRecord,
                failedRecord,
            ]);
            // 3件とも同一のフィクスチャ（endpoint等）から生成しているため、
            // sendの呼び出し順で結果を切り替える。
            let callIndex = 0;
            repositorySetup.webPushSendRepository.send.mockImplementation(
                () => {
                    const results = [
                        { ok: true },
                        { ok: false, gone: true, message: 'gone' },
                        { ok: false, gone: false, message: 'error' },
                    ] as const;
                    const result = results[callIndex];
                    callIndex += 1;
                    return Promise.resolve(result);
                },
            );

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 3,
                sent: 1,
                gone: 1,
                failed: 1,
            });

            // PERF-104: 1回のdispatchDue呼び出し内では、VAPID鍵インポートを
            // 使い回すための同一dispatchCache参照が、全件のsend呼び出しに
            // 渡されていることを確認する。
            const sendCalls =
                repositorySetup.webPushSendRepository.send.mock.calls;
            expect(sendCalls).toHaveLength(3);
            const dispatchCaches = sendCalls.map((call) => call[2]);
            expect(dispatchCaches[0]).toBeDefined();
            expect(dispatchCaches[1]).toBe(dispatchCaches[0]);
            expect(dispatchCaches[2]).toBe(dispatchCaches[0]);
        });

        it('9b: 失敗が1件以上ある場合appLogger.errorでサマリーが出力されること', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: false,
                message: 'push service error',
            });
            const errorSpy = spyOn(appLogger, 'error').mockImplementation(
                () => {},
            );

            await usecase.dispatchDue(1_700_000_100_000);

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0]?.[0]).toBe(
                'Web Push dispatch had failures',
            );
            expect(errorSpy.mock.calls[0]?.[1]).toEqual({
                attempted: 1,
                sent: 0,
                gone: 0,
                failed: 1,
            });

            errorSpy.mockRestore();
        });

        it('9c: 失敗が無い場合appLogger.errorは呼ばれないこと', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: true,
            });
            const errorSpy = spyOn(appLogger, 'error').mockImplementation(
                () => {},
            );

            await usecase.dispatchDue(1_700_000_100_000);

            expect(errorSpy).toHaveBeenCalledTimes(0);

            errorSpy.mockRestore();
        });

        it('9d: sendが例外をthrowしても他の件・purgeOldの処理が継続されること（CONC-07）', async () => {
            const throwingRecord = buildDueRecord({ id: 'sub-1:race-1' });
            const succeedingRecord = buildDueRecord({
                id: 'sub-2:race-2',
                subscriptionId: 'sub-2',
            });
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                throwingRecord,
                succeedingRecord,
            ]);
            let callIndex = 0;
            repositorySetup.webPushSendRepository.send.mockImplementation(
                () => {
                    callIndex += 1;
                    if (callIndex === 1) {
                        return Promise.reject(new Error('unexpected error'));
                    }
                    return Promise.resolve({ ok: true });
                },
            );
            const warnSpy = spyOn(appLogger, 'warn').mockImplementation(
                () => {},
            );

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 2,
                sent: 1,
                gone: 0,
                failed: 1,
            });
            expect(warnSpy).toHaveBeenCalledWith(
                'unexpected error while dispatching web push notification',
                expect.any(Error),
            );
            expect(
                repositorySetup.pushRequestRepository.purgeOld.mock.calls,
            ).toHaveLength(1);

            warnSpy.mockRestore();
        });

        it('9e: 送信成功した場合はresetFailureCountが呼ばれること（OBS-024）', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: true,
            });

            await usecase.dispatchDue(1_700_000_100_000);

            assertCalledWith(
                repositorySetup.pushSubscriptionRepository
                    .resetFailureCountBatch,
                [record.subscriptionId],
            );
        });

        it('9f: 連続失敗回数が上限未満の場合は購読を削除せずreleaseClaimが呼ばれること（OBS-024）', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: false,
                message: 'push service error',
            });
            repositorySetup.pushSubscriptionRepository.incrementFailureCountBatch.mockResolvedValue(
                new Map([[record.subscriptionId, 2]]),
            );

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 1,
                sent: 0,
                gone: 0,
                failed: 1,
            });
            assertCalledWith(
                repositorySetup.pushRequestRepository.releaseClaimBatch,
                [record.id],
            );
            expect(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequestsBatch.mock.calls,
            ).toHaveLength(0);
        });

        it('9g: 連続失敗回数が上限に達した場合は購読が削除されgone扱いになること（OBS-024）', async () => {
            const record = buildDueRecord();
            repositorySetup.pushRequestRepository.fetchDue.mockResolvedValue([
                record,
            ]);
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: false,
                message: 'push service error',
            });
            repositorySetup.pushSubscriptionRepository.incrementFailureCountBatch.mockResolvedValue(
                new Map([[record.subscriptionId, 5]]),
            );
            const warnSpy = spyOn(appLogger, 'warn').mockImplementation(
                () => {},
            );

            const result = await usecase.dispatchDue(1_700_000_100_000);

            expect(result).toEqual({
                attempted: 1,
                sent: 0,
                gone: 1,
                failed: 0,
            });
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequestsBatch,
                [record.subscriptionId],
            );
            expect(
                repositorySetup.pushRequestRepository.releaseClaimBatch.mock
                    .calls,
            ).toHaveLength(0);
            expect(warnSpy).toHaveBeenCalledWith(
                'permanently failing web push subscription purged',
                expect.objectContaining({
                    subscriptionId: record.subscriptionId,
                    failureCount: 5,
                }),
            );

            warnSpy.mockRestore();
        });
    });

    describe('sendTest', () => {
        const buildSubscription = () => ({
            id: 'sub-1',
            endpoint: 'https://push.example.com/subscription/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        });

        it('10: 購読が見つからない場合はok:falseを返しsendが呼ばれないこと', async () => {
            repositorySetup.pushSubscriptionRepository.findById.mockResolvedValue(
                undefined,
            );

            const result = await usecase.sendTest('sub-1');

            expect(result).toEqual({
                ok: false,
                message: '購読が見つかりません',
            });
            expect(
                repositorySetup.webPushSendRepository.send.mock.calls,
            ).toHaveLength(0);
        });

        it('11: 送信に成功した場合はok:trueを返すこと', async () => {
            repositorySetup.pushSubscriptionRepository.findById.mockResolvedValue(
                buildSubscription(),
            );
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: true,
            });

            const result = await usecase.sendTest('sub-1');

            expect(result).toEqual({ ok: true });
        });

        it('12: 購読が失効している場合は購読と予約が削除されok:falseを返すこと', async () => {
            repositorySetup.pushSubscriptionRepository.findById.mockResolvedValue(
                buildSubscription(),
            );
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: true,
                message: 'gone',
            });

            const result = await usecase.sendTest('sub-1');

            expect(result.ok).toBe(false);
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequests,
                'sub-1',
            );
        });

        it('13: 送信失敗（gone以外）の場合は何も削除されずメッセージを返すこと', async () => {
            repositorySetup.pushSubscriptionRepository.findById.mockResolvedValue(
                buildSubscription(),
            );
            repositorySetup.webPushSendRepository.send.mockResolvedValue({
                ok: false,
                gone: false,
                message: 'push service error',
            });

            const result = await usecase.sendTest('sub-1');

            expect(result).toEqual({
                ok: false,
                message: 'push service error',
            });
            expect(
                repositorySetup.pushSubscriptionRepository
                    .removeWithDependentRequests.mock.calls,
            ).toHaveLength(0);
        });
    });

    describe('purgeStaleSubscriptions', () => {
        it('14: 対象なしの場合は0を返し件数ログが記録されないこと', async () => {
            repositorySetup.pushSubscriptionRepository.purgeStale.mockResolvedValue(
                0,
            );
            const infoSpy = spyOn(appLogger, 'info').mockImplementation(
                () => {},
            );

            const result = await usecase.purgeStaleSubscriptions();

            expect(result).toBe(0);
            // @LogAllMethods が開始/終了ログを出すため呼び出し回数自体は0にならない。
            // 「件数ログ（purged stale ...）が無いこと」だけを見る。
            expect(
                infoSpy.mock.calls.some(
                    (call) => call[0] === 'purged stale web push subscriptions',
                ),
            ).toBe(false);
            assertCalledWith(
                repositorySetup.pushSubscriptionRepository.purgeStale,
                365,
            );

            infoSpy.mockRestore();
        });

        it('15: 削除件数を返し、appLogger.infoで件数が記録されること', async () => {
            repositorySetup.pushSubscriptionRepository.purgeStale.mockResolvedValue(
                3,
            );
            const infoSpy = spyOn(appLogger, 'info').mockImplementation(
                () => {},
            );

            const result = await usecase.purgeStaleSubscriptions();

            expect(result).toBe(3);
            expect(infoSpy).toHaveBeenCalledWith(
                'purged stale web push subscriptions',
                { purged: 3 },
            );

            infoSpy.mockRestore();
        });
    });
});
