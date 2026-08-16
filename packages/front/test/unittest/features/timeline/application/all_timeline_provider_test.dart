// all_timeline_provider.dart のデシジョンテーブル
//
// | ID   | 対象                 | 条件                                       | 期待                                    |
// | ---- | -------------------- | ------------------------------------------- | ---------------------------------------- |
// | T-01 | LoadedMonthsNotifier  | 初期状態                                     | 今月とその前後1ヶ月の3件（昇順）         |
// | T-02 | LoadedMonthsNotifier  | loadEarlier（先頭月が解決済み）              | 先頭に1ヶ月追加される                    |
// | T-03 | LoadedMonthsNotifier  | loadLater（末尾月が解決済み）                | 末尾に1ヶ月追加される                    |
// | T-04 | LoadedMonthsNotifier  | loadEarlier（先頭月がロード中）              | 何も追加されない                         |
// | T-05 | LoadedMonthsNotifier  | loadLater（末尾月がロード中）                | 何も追加されない                         |
// | T-06 | LoadedMonthsNotifier  | loadEarlierを上限(12)超まで繰り返す（PERF-002） | 件数が12件を超えず、最も未来側の月が破棄されキャッシュが再取得される |
// | T-07 | LoadedMonthsNotifier  | loadLaterを上限(12)超まで繰り返す（PERF-002）   | 件数が12件を超えず、最も過去側の月が破棄されキャッシュが再取得される |

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/jst_time.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/all_timeline_provider.dart';
import 'package:front/features/timeline/application/month_key.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';

void main() {
  group('LoadedMonthsNotifier', () {
    test('[T-01] 初期状態_今月とその前後1ヶ月の3件', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final current = monthKeyOf(dateOnly(jstNow()));

      final state = container.read(loadedMonthsProvider);

      expect(state, [
        offsetMonthKey(current, -1),
        current,
        offsetMonthKey(current, 1),
      ]);
    });

    test('[T-02] loadEarlier_先頭月が解決済みなら先頭に1ヶ月追加', () async {
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith(
            (ref, monthKey) async => const [],
          ),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      await container.read(monthRaceChunkProvider(initial.first).future);

      container.read(loadedMonthsProvider.notifier).loadEarlier();

      final after = container.read(loadedMonthsProvider);
      expect(after.length, initial.length + 1);
      expect(after.first, offsetMonthKey(initial.first, -1));
    });

    test('[T-03] loadLater_末尾月が解決済みなら末尾に1ヶ月追加', () async {
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith(
            (ref, monthKey) async => const [],
          ),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      await container.read(monthRaceChunkProvider(initial.last).future);

      container.read(loadedMonthsProvider.notifier).loadLater();

      final after = container.read(loadedMonthsProvider);
      expect(after.length, initial.length + 1);
      expect(after.last, offsetMonthKey(initial.last, 1));
    });

    test('[T-04] loadEarlier_先頭月がロード中なら何も追加しない', () {
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith(
            (ref, monthKey) => Completer<List<RaceEntity>>().future,
          ),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      container.read(monthRaceChunkProvider(initial.first));

      container.read(loadedMonthsProvider.notifier).loadEarlier();

      expect(container.read(loadedMonthsProvider), initial);
    });

    test('[T-05] loadLater_末尾月がロード中なら何も追加しない', () {
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith(
            (ref, monthKey) => Completer<List<RaceEntity>>().future,
          ),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      container.read(monthRaceChunkProvider(initial.last));

      container.read(loadedMonthsProvider.notifier).loadLater();

      expect(container.read(loadedMonthsProvider), initial);
    });

    test('[T-06] loadEarlierを上限超まで繰り返す_最も未来側の月が破棄されキャッシュが再取得される', () async {
      final callCounts = <String, int>{};
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith((ref, monthKey) async {
            callCounts[monthKey] = (callCounts[monthKey] ?? 0) + 1;
            return const [];
          }),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      final droppedCandidate = initial.last;
      await container.read(monthRaceChunkProvider(droppedCandidate).future);

      // 初期3ヶ月に対し、上限(12)を超える1回目のloadEarlierまで繰り返す（10回目で超過）
      for (var i = 0; i < 10; i++) {
        final current = container.read(loadedMonthsProvider);
        await container.read(monthRaceChunkProvider(current.first).future);
        container.read(loadedMonthsProvider.notifier).loadEarlier();
      }

      final after = container.read(loadedMonthsProvider);
      expect(after.length, 12);
      expect(after.contains(droppedCandidate), isFalse);

      // invalidateされているため再読み込みが発生し、呼び出し回数が増える
      await container.read(monthRaceChunkProvider(droppedCandidate).future);
      expect(callCounts[droppedCandidate], 2);
    });

    test('[T-07] loadLaterを上限超まで繰り返す_最も過去側の月が破棄されキャッシュが再取得される', () async {
      final callCounts = <String, int>{};
      final container = ProviderContainer(
        overrides: [
          monthRaceChunkProvider.overrideWith((ref, monthKey) async {
            callCounts[monthKey] = (callCounts[monthKey] ?? 0) + 1;
            return const [];
          }),
        ],
      );
      addTearDown(container.dispose);
      final initial = container.read(loadedMonthsProvider);
      final droppedCandidate = initial.first;
      await container.read(monthRaceChunkProvider(droppedCandidate).future);

      for (var i = 0; i < 10; i++) {
        final current = container.read(loadedMonthsProvider);
        await container.read(monthRaceChunkProvider(current.last).future);
        container.read(loadedMonthsProvider.notifier).loadLater();
      }

      final after = container.read(loadedMonthsProvider);
      expect(after.length, 12);
      expect(after.contains(droppedCandidate), isFalse);

      await container.read(monthRaceChunkProvider(droppedCandidate).future);
      expect(callCounts[droppedCandidate], 2);
    });
  });
}
