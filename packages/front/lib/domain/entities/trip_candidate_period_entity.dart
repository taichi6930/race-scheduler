import 'package:freezed_annotation/freezed_annotation.dart';

import 'trip_group_course_entity.dart';

part 'trip_candidate_period_entity.freezed.dart';

/// 候補期間内で、ある1会場が開催を持つ日付一覧（JST暦日、YYYY-MM-DD、昇順）。
@freezed
abstract class TripCandidateCourseEntity with _$TripCandidateCourseEntity {
  const factory TripCandidateCourseEntity({
    required TripGroupCourseEntity course,
    required List<String> dates,
  }) = _TripCandidateCourseEntity;
}

/// 検出された1つの候補期間（旅程グループ候補日検出、design §2.1）。
///
/// `courses` には、この期間に開催を持つ会場のみが含まれる
/// （開催の無い会場は含まれない）。
@freezed
abstract class TripCandidatePeriodEntity with _$TripCandidatePeriodEntity {
  const factory TripCandidatePeriodEntity({
    /// 期間の開始日（クラスタ内最小日、YYYY-MM-DD）
    required String startDate,

    /// 期間の終了日（クラスタ内最大日、YYYY-MM-DD）
    required String endDate,
    required List<TripCandidateCourseEntity> courses,
  }) = _TripCandidatePeriodEntity;
}
