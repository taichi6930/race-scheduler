import 'package:freezed_annotation/freezed_annotation.dart';

part 'race_entity.freezed.dart';

@freezed
abstract class RaceEntity with _$RaceEntity {
  const factory RaceEntity({
    required String raceId,
    required String raceName,
    required String raceType,
    required String placeId,
    required String raceCourse,
    required String datetime,
    String? raceGrade,
    required int raceNumber,
    String? surfaceType,
    int? distance,
    String? locationCode,
    String? raceStage,

    /// APIが算出した「グレード・ステージによりカレンダー登録対象か」
    /// （グレードマスタ＋KEIRIN/AUTORACE/BOATRACEはステージ優先度準拠）。
    ///
    /// バックエンドの `GET /race` から取得したレースは必ず値を持つ。
    /// front側で手動生成したエンティティ（テスト等）では未設定（null）になり得るため、
    /// 利用側は `race.isCalendarSpecified ?? isCalendarSpecifiedGrade(...)`
    /// （`domain/entities/grade_tier.dart`）でフォールバックすること。
    bool? isCalendarSpecified,

    /// 登録した注目選手（player_watch）が出走するレースか（KPLAYER-07）。
    ///
    /// バックエンドの `GET /race` から取得したレースは必ず値を持つ。
    /// front側で手動生成したエンティティ（テスト等）では未設定（null）になり得るため、
    /// 利用側は `race.isWatched ?? false` でフォールバックすること。
    bool? isWatched,

    /// 開催情報が確定しているか（公式発表前に運用者が推測で先行登録した
    /// 未来のレースは false）。
    ///
    /// バックエンドの `GET /race` から取得したレースは必ず値を持つ。
    /// front側で手動生成したエンティティ（テスト等）では未設定（null）になり得るため、
    /// 利用側は `race.isConfirmed ?? true`（省略時は確定扱い）でフォールバックすること。
    bool? isConfirmed,
  }) = _RaceEntity;
}
