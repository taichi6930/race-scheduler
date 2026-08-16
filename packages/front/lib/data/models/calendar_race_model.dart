import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/calendar_race_entity.dart';

part 'calendar_race_model.freezed.dart';
part 'calendar_race_model.g.dart';

@freezed
abstract class CalendarConditionData with _$CalendarConditionData {
  const factory CalendarConditionData({
    @JsonKey(name: 'surfaceType') String? surfaceType,
    @JsonKey(name: 'distance') int? distance,
  }) = _CalendarConditionData;

  factory CalendarConditionData.fromJson(Map<String, dynamic> json) =>
      _$CalendarConditionDataFromJson(json);
}

@freezed
abstract class CalendarRaceModel with _$CalendarRaceModel {
  const factory CalendarRaceModel({
    @JsonKey(name: 'raceId') required String raceId,
    @JsonKey(name: 'raceName') required String raceName,
    @JsonKey(name: 'raceType') required String raceType,
    @JsonKey(name: 'placeId') required String placeId,
    @JsonKey(name: 'raceCourse') required String raceCourse,
    @JsonKey(name: 'datetime') required String datetime,
    @JsonKey(name: 'raceGrade') String? raceGrade,
    @JsonKey(name: 'raceNumber') required int raceNumber,
    @JsonKey(name: 'conditionData') CalendarConditionData? conditionData,
    @JsonKey(name: 'locationCode') String? locationCode,
    @JsonKey(name: 'isFlagged') required bool isFlagged,
  }) = _CalendarRaceModel;

  factory CalendarRaceModel.fromJson(Map<String, dynamic> json) =>
      _$CalendarRaceModelFromJson(json);

  const CalendarRaceModel._();

  CalendarRaceEntity toEntity() {
    return CalendarRaceEntity(
      raceId: raceId,
      raceName: raceName,
      raceType: raceType,
      placeId: placeId,
      raceCourse: raceCourse,
      datetime: datetime,
      raceGrade: raceGrade,
      raceNumber: raceNumber,
      surfaceType: conditionData?.surfaceType,
      distance: conditionData?.distance,
      locationCode: locationCode,
      isFlagged: isFlagged,
    );
  }
}
