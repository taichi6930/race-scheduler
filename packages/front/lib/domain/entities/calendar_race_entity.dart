import 'package:freezed_annotation/freezed_annotation.dart';

part 'calendar_race_entity.freezed.dart';

/// カレンダー掲載対象のレース（GET /calendar のレスポンス）。
/// api = D1唯一のアクセス点という方針のもと、Google Calendarの
/// イベント情報ではなく、DBのレース情報にカレンダー登録フラグの
/// 有無（isFlagged）を付与したものを表す。
@freezed
abstract class CalendarRaceEntity with _$CalendarRaceEntity {
  const factory CalendarRaceEntity({
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
    required bool isFlagged,
  }) = _CalendarRaceEntity;
}
