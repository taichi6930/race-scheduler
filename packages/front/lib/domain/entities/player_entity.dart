import 'package:freezed_annotation/freezed_annotation.dart';

import 'race_type.dart';

part 'player_entity.freezed.dart';

/// 注目選手として登録するときの `priority` 値（KPLAYER-07）。
/// バックエンド（player_watch.priority）の「0=注目しない/10=注目する」の
/// 二値運用にそのまま揃える。
const int kWatchedPlayerPriority = 10;

/// 注目選手機能の対象レース種別（KPLAYER-07 → AUTORACE拡張）。
///
/// 選手データ基盤（player_keirin/player_autorace）が整っているKEIRIN・
/// AUTORACEのみが対象。BOATRACE等は選手データの取得経路自体が無いため対象外。
const watchedPlayerRaceTypes = [RaceType.keirin, RaceType.autorace];

@freezed
abstract class PlayerEntity with _$PlayerEntity {
  const factory PlayerEntity({
    // jra, nar, keirin, overseas, autorace, boatrace
    required String raceType,
    // 選手コード（先頭ゼロを保持するため文字列）
    required String playerNo,
    required String playerName,
    // 0 = 注目しない / 10 = 注目する（KPLAYER-07）。
    // バックエンド（player_watch.priority）の二値運用にそのまま揃える。
    required int priority,
    // 期別（選手養成所の卒業期。KEIRINのみ、省略され得る）
    int? term,
    // 所属（KEIRINは府県、AUTORACEは拠点/LG。省略され得る）
    String? branch,
  }) = _PlayerEntity;
}
