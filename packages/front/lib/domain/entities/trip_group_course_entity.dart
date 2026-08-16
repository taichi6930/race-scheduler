import 'package:freezed_annotation/freezed_annotation.dart';

part 'trip_group_course_entity.freezed.dart';

/// 旅程グループ内の1会場（`raceType`/`raceCourse`/`placeCode`）。
///
/// バックエンド（`packages/core/src/domain/master/tripGroupMaster.ts` の
/// `TripGroupCourse`）と対応する。旅程グループ一覧・候補期間の両方で
/// 会場を表す最小単位として使い回す。
@freezed
abstract class TripGroupCourseEntity with _$TripGroupCourseEntity {
  const factory TripGroupCourseEntity({
    required String raceType,
    required String raceCourse,
    required String placeCode,
  }) = _TripGroupCourseEntity;
}
