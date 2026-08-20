// FavoriteIdsNotifier のデシジョンテーブル
//
// | ID   | 操作                                  | 期待                              |
// | ---- | ------------------------------------- | ---------------------------------- |
// | T-01 | 初期状態（未保存）                    | 空集合                            |
// | T-02 | toggle('race-001')                    | 追加され isFavorite が true       |
// | T-03 | 追加済みに対して toggle('race-001')   | 削除され isFavorite が false      |
// | T-04 | toggle 後に別インスタンスで再読込     | 永続化された内容が復元される       |
//
// PERF-112: 永続化デバウンスのデシジョンテーブル
//
// | ID   | 操作                                          | 期待                                        |
// | ---- | --------------------------------------------- | -------------------------------------------- |
// | T-05 | デバウンス時間内に複数回 toggle               | 保存は1回のみ・内容は最終状態               |
// | T-06 | デバウンス時間が経過する前に破棄（dispose）   | 破棄時点で即座に最終状態が保存される         |
//
// QPRIV-05: 一括削除のデシジョンテーブル
//
// | ID   | 操作                                          | 期待                                        |
// | ---- | --------------------------------------------- | -------------------------------------------- |
// | T-07 | 複数登録済みの状態でclearAll()                | 空集合になり、デバウンス後に空集合で保存される |

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/repositories/i_favorites_repository.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _CountingFavoritesRepository implements IFavoritesRepository {
  Set<String> _stored = <String>{};
  int saveCallCount = 0;
  final List<Set<String>> savedSnapshots = [];

  @override
  Future<Set<String>> loadFavoriteRaceIds() async => _stored;

  @override
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds) async {
    saveCallCount++;
    savedSnapshots.add(Set<String>.from(raceIds));
    _stored = raceIds;
    return true;
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer() async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('FavoriteIdsNotifier', () {
    test('[T-01] 初期状態_空集合', () async {
      final container = await buildContainer();

      final ids = await container.read(favoriteIdsProvider.future);

      expect(ids, isEmpty);
    });

    test('[T-02] 未登録レースをtoggle_追加されisFavoriteがtrue', () async {
      final container = await buildContainer();
      await container.read(favoriteIdsProvider.future);
      final notifier = container.read(favoriteIdsProvider.notifier);

      notifier.toggle('race-001');

      expect(container.read(favoriteIdsProvider).value, contains('race-001'));
      expect(notifier.isFavorite('race-001'), isTrue);
    });

    test('[T-03] 登録済みレースをtoggle_削除されisFavoriteがfalse', () async {
      final container = await buildContainer();
      await container.read(favoriteIdsProvider.future);
      final notifier = container.read(favoriteIdsProvider.notifier);
      notifier.toggle('race-001');

      notifier.toggle('race-001');

      expect(
        container.read(favoriteIdsProvider).value,
        isNot(contains('race-001')),
      );
      expect(notifier.isFavorite('race-001'), isFalse);
    });

    test('[T-04] toggle後に別コンテナで再読込_永続化内容が復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final firstContainer = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      await firstContainer.read(favoriteIdsProvider.future);
      // toggle()が返すFutureはデバウンス後の実際の永続化完了を表す
      // （PERF-112）。これをawaitすることで、書き込み完了後に確実に
      // dispose・別コンテナでの再読込へ進める。
      await firstContainer.read(favoriteIdsProvider.notifier).toggle('race-042');
      firstContainer.dispose();

      final secondContainer = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(secondContainer.dispose);

      final ids = await secondContainer.read(favoriteIdsProvider.future);
      expect(ids, contains('race-042'));
    });

    test('[T-05] デバウンス時間内の複数toggle_保存は1回のみ最終状態で行われる', () {
      fakeAsync((async) {
        final repository = _CountingFavoritesRepository();
        final container = ProviderContainer(
          overrides: [
            favoritesRepositoryProvider.overrideWithValue(repository),
          ],
        );
        addTearDown(container.dispose);
        final notifier = container.read(favoriteIdsProvider.notifier);
        async.flushMicrotasks();

        notifier.toggle('race-001');
        notifier.toggle('race-002');
        notifier.toggle('race-001'); // race-001 は再度toggleで解除される

        expect(repository.saveCallCount, 0); // デバウンス時間未経過では保存されない

        async.elapse(favoriteSaveDebounceDuration);

        expect(repository.saveCallCount, 1);
        expect(repository.savedSnapshots.single, {'race-002'});
      });
    });

    test('[T-06] デバウンス時間経過前に破棄_破棄時点の最終状態が即座に保存される', () {
      fakeAsync((async) {
        final repository = _CountingFavoritesRepository();
        final container = ProviderContainer(
          overrides: [
            favoritesRepositoryProvider.overrideWithValue(repository),
          ],
        );
        final notifier = container.read(favoriteIdsProvider.notifier);
        async.flushMicrotasks();

        notifier.toggle('race-003');
        expect(repository.saveCallCount, 0);

        container.dispose();
        async.flushMicrotasks();

        expect(repository.saveCallCount, 1);
        expect(repository.savedSnapshots.single, {'race-003'});

        // 破棄後にデバウンス時間が経過してもタイマーは既にキャンセル済みのため
        // 二重保存されない
        async.elapse(favoriteSaveDebounceDuration);
        expect(repository.saveCallCount, 1);
      });
    });

    test('[T-07] 複数登録済みの状態でclearAll_空集合になりデバウンス後に空集合で保存される', () {
      fakeAsync((async) {
        final repository = _CountingFavoritesRepository();
        final container = ProviderContainer(
          overrides: [
            favoritesRepositoryProvider.overrideWithValue(repository),
          ],
        );
        addTearDown(container.dispose);
        final notifier = container.read(favoriteIdsProvider.notifier);
        async.flushMicrotasks();
        notifier.toggle('race-001');
        notifier.toggle('race-002');
        async.elapse(favoriteSaveDebounceDuration);
        expect(repository.saveCallCount, 1);

        notifier.clearAll();

        expect(container.read(favoriteIdsProvider).value, isEmpty);
        async.elapse(favoriteSaveDebounceDuration);
        expect(repository.saveCallCount, 2);
        expect(repository.savedSnapshots.last, isEmpty);
      });
    });
  });
}
