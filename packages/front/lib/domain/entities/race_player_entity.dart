import 'package:freezed_annotation/freezed_annotation.dart';

part 'race_player_entity.freezed.dart';

/// 出走選手1名分の情報（KPLAYER-07、レース詳細の出走選手ロスター表示用）。
///
/// `GET /race/players` のレスポンス（`RacePlayerEntity`、core側）と対応する。
@freezed
abstract class RacePlayerEntity with _$RacePlayerEntity {
  const factory RacePlayerEntity({
    // 車番（レース内で一意, 1-9）
    required int carNumber,
    // 枠番（複数車が同一枠を共有しうるため一意ではない）
    required int frameNumber,
    // 選手コード（先頭ゼロを保持するため文字列）
    required String playerNo,
    required String playerName,
    // 期別（選手養成所の卒業期。KEIRINのみ、省略され得る）
    int? term,
    // 所属（KEIRINは府県、AUTORACEは拠点/LG。省略され得る）
    String? branch,
  }) = _RacePlayerEntity;
}
