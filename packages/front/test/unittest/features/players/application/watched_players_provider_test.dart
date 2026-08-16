// togglePlayerWatch のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                              |
// | ---- | ------------------------------------------- | -------------------------------------------------- |
// | T-01 | 選手検索結果一覧から注目状態をトグル        | playerSearchResultsProviderも無効化され、次回watchで最新のpriorityを反映する（回帰: 無効化漏れで★が反映されなかった） |
// | T-02 | 登録済み注目選手一覧から注目状態をトグル    | watchedPlayersProviderが無効化され、次回watchで最新の一覧を反映する |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/domain/entities/player_entity.dart';
import 'package:front/domain/repositories/i_player_repository.dart';
import 'package:front/features/players/application/player_search_provider.dart';
import 'package:front/features/players/application/watched_players_provider.dart';

class _FakePlayerRepository implements IPlayerRepository {
  _FakePlayerRepository({required this.responses});

  /// getPlayersByRaceTypeの呼び出し回数ごとに返す応答
  /// （1回目→responses[0]、2回目→responses[1]、...）。
  final List<List<PlayerEntity>> responses;
  int callCount = 0;

  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async {
    final response = responses[callCount];
    callCount++;
    return response;
  }

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {}
}

const _unwatchedPlayer = PlayerEntity(
  raceType: 'keirin',
  playerNo: '014833',
  playerName: '郡司浩平',
  priority: 0,
);

const _watchedPlayer = PlayerEntity(
  raceType: 'keirin',
  playerNo: '014833',
  playerName: '郡司浩平',
  priority: kWatchedPlayerPriority,
);

/// [captureRef] で実際の [WidgetRef] を取得できる最小のアプリを組み立てる
/// （`favorite_toggle_feedback_test.dart` と同じ方針）。
Widget _buildApp(void Function(WidgetRef ref) captureRef) {
  return ProviderScope(
    child: Consumer(
      builder: (context, ref, _) {
        captureRef(ref);
        return const MaterialApp(home: SizedBox());
      },
    ),
  );
}

void main() {
  tearDown(() {
    if (getIt.isRegistered<IPlayerRepository>()) {
      getIt.unregister<IPlayerRepository>();
    }
  });

  testWidgets(
    '[T-01] 選手検索結果一覧から登録_playerSearchResultsProviderも無効化され最新のpriorityを反映する',
    (tester) async {
      getIt.registerSingleton<IPlayerRepository>(
        _FakePlayerRepository(
          responses: [
            [_unwatchedPlayer],
            [_watchedPlayer],
          ],
        ),
      );
      late WidgetRef ref;
      await tester.pumpWidget(_buildApp((r) => ref = r));

      ref.read(playerSearchQueryProvider.notifier).setQuery('郡司');
      final before = await ref.read(playerSearchResultsProvider.future);
      expect(before.single.priority, 0);

      await togglePlayerWatch(
        ref,
        raceType: 'keirin',
        playerNo: '014833',
        playerName: '郡司浩平',
        watched: true,
      );

      final after = await ref.read(playerSearchResultsProvider.future);
      expect(after.single.priority, kWatchedPlayerPriority);
    },
  );

  testWidgets(
    '[T-02] 登録済み注目選手一覧から解除_watchedPlayersProviderが無効化され最新の一覧を反映する',
    (tester) async {
      getIt.registerSingleton<IPlayerRepository>(
        _FakePlayerRepository(
          responses: [
            [_watchedPlayer],
            [_unwatchedPlayer],
          ],
        ),
      );
      late WidgetRef ref;
      await tester.pumpWidget(_buildApp((r) => ref = r));

      final before = await ref.read(watchedPlayersProvider.future);
      expect(before, [_watchedPlayer]);

      await togglePlayerWatch(
        ref,
        raceType: 'keirin',
        playerNo: '014833',
        playerName: '郡司浩平',
        watched: false,
      );

      final after = await ref.read(watchedPlayersProvider.future);
      expect(after, isEmpty);
    },
  );
}
