import 'package:freezed_annotation/freezed_annotation.dart';

part 'place_entity.freezed.dart';

/// 開催場情報（`GET /place` の1件分）。
///
/// `packages/core/src/entity/placeEntity.ts` の `PlaceEntity` と対応する。
/// `datetime` は1開催日を表し、`raceType`/`locationCode` と組み合わせて
/// 「その日その会場で開催があった」ことを示す。
@freezed
abstract class PlaceEntity with _$PlaceEntity {
  const factory PlaceEntity({
    required String placeId,
    required String raceType, // jra, nar, keirin, autorace, boatrace 等
    required String raceCourse,
    required String locationCode,
    required String datetime, // 開催日（JST ISO8601文字列）
    String? placeGrade,
    bool? isRaceListAvailable,
  }) = _PlaceEntity;
}
