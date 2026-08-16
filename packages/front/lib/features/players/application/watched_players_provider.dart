import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/player_entity.dart';
import '../../../domain/repositories/i_player_repository.dart';
import '../../favorites/application/favorite_races_provider.dart';
import '../../timeline/application/timeline_provider.dart';
import 'player_search_provider.dart';

/// 登録済みの注目選手一覧（KPLAYER-07）。
///
/// `GET /player` は選手ごとの `priority` を返すため、ここで
/// `priority > 0`（注目選手として登録済み）に絞り込む。
final watchedPlayersProvider = FutureProvider.autoDispose<List<PlayerEntity>>((
  ref,
) async {
  scheduleTtlInvalidate(ref, defaultCacheTtl);
  final players = await getIt<IPlayerRepository>().getPlayersByRaceType(
    raceTypeList: watchedPlayerRaceTypes.map((type) => type.value).toList(),
  );
  return players.where((player) => player.priority > 0).toList();
});

/// 指定選手の注目状態をON/OFFし、関連する一覧を再取得させる。
///
/// isWatchedはレース一覧の一部として返る値のため、注目選手の登録/解除後は
/// [watchedPlayersProvider] に加えて、レース一覧を保持する
/// `timelineProvider`（全日付）・`favoriteRacesRawProvider` も無効化し、
/// 「⭐お気に入り」表示・通知が新しい注目状態を即座に反映するようにする。
///
/// [playerSearchResultsProvider] も無効化する（回帰: これが漏れていたため、
/// 選手検索結果一覧からの登録/解除がAPI的には成功していても画面上の★が
/// 更新されず、あたかも登録が反映されていないように見えていた）。
Future<void> togglePlayerWatch(
  WidgetRef ref, {
  required String raceType,
  required String playerNo,
  required String playerName,
  required bool watched,
}) async {
  await getIt<IPlayerRepository>().setPlayerWatch(
    raceType: raceType,
    playerNo: playerNo,
    playerName: playerName,
    watched: watched,
  );
  ref.invalidate(watchedPlayersProvider);
  ref.invalidate(playerSearchResultsProvider);
  // isWatchedはレース一覧の一部として返るため、キャッシュ済みの一覧を
  // 破棄して次の watch で最新のisWatchedを取り直させる（TTL経過を待たない）。
  ref.invalidate(timelineProvider);
  ref.invalidate(favoriteRacesRawProvider);
}
