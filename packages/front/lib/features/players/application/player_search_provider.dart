import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../domain/entities/player_entity.dart';
import '../../../domain/repositories/i_player_repository.dart';

/// 選手検索の入力語（KPLAYER-07）。
///
/// 検索実行のデバウンスは呼び出し側（`PlayerSearchField`）が
/// `Timer` で行い、確定した語だけをここへ反映する。
final playerSearchQueryProvider =
    NotifierProvider<PlayerSearchQueryNotifier, String>(
      PlayerSearchQueryNotifier.new,
    );

class PlayerSearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void setQuery(String value) => state = value;
}

/// 選手検索結果（[watchedPlayerRaceTypes] 対象種目、KEIRIN・AUTORACE）。
///
/// 検索語が空の間はAPIを呼ばず空リストを返す（全件取得は選手数増加時に
/// 非効率なため、GET /playerのplayerNameパラメータでの絞り込みを必須にする）。
final playerSearchResultsProvider = FutureProvider.autoDispose<
  List<PlayerEntity>
>((ref) async {
  final query = ref.watch(playerSearchQueryProvider).trim();
  if (query.isEmpty) return const [];
  return getIt<IPlayerRepository>().getPlayersByRaceType(
    raceTypeList: watchedPlayerRaceTypes.map((type) => type.value).toList(),
    playerName: query,
  );
});
