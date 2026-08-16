import 'package:freezed_annotation/freezed_annotation.dart';

import 'trip_candidate_period_entity.dart';
import 'trip_group_course_entity.dart';

part 'trip_group_entity.freezed.dart';

/// 旅程グループ1件分の候補日検出結果（`GET /trip-group` のレスポンス項目）。
///
/// `courses.length == 1`（単独グループ、例: 水沢・帯広ば）のときのみ
/// [heldDates] が設定され、複数会場グループのときのみ [candidates] が
/// 設定される（`docs/specs/SPEC-TRIP-001.md` 参照）。
@freezed
abstract class TripGroupEntity with _$TripGroupEntity {
  const factory TripGroupEntity({
    /// 安定した一意キー（kebab-case）。ルーティング（`/trip-groups/:id`）にも使う。
    required String id,

    /// 画面表示名
    required String name,
    required List<TripGroupCourseEntity> courses,

    /// 単独グループの開催日一覧（JST暦日、YYYY-MM-DD、昇順）。単独グループのみ設定。
    List<String>? heldDates,

    /// 複数会場グループの候補期間一覧（空配列 = 候補なし）。複数会場グループのみ設定。
    List<TripCandidatePeriodEntity>? candidates,
  }) = _TripGroupEntity;

  const TripGroupEntity._();

  /// 単独グループ（候補日検出の対象外、開催日一覧のみ保持）かどうか。
  bool get isSingleCourseGroup => courses.length == 1;

  /// 複数会場グループで、候補期間が1件も無い（「候補なし」）かどうか。
  bool get hasNoCandidates => candidates != null && candidates!.isEmpty;
}
