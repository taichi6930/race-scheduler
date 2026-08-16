import 'package:freezed_annotation/freezed_annotation.dart';

import '../../domain/entities/race_entity.dart';

part 'race_model.freezed.dart';
part 'race_model.g.dart';

@freezed
abstract class ConditionData with _$ConditionData {
  const factory ConditionData({
    @JsonKey(name: 'surfaceType') String? surfaceType,
    @JsonKey(name: 'distance') int? distance,
  }) = _ConditionData;

  factory ConditionData.fromJson(Map<String, dynamic> json) =>
      _$ConditionDataFromJson(json);
}

@freezed
abstract class RaceModel with _$RaceModel {
  const factory RaceModel({
    @JsonKey(name: 'raceId') required String raceId,
    @JsonKey(name: 'raceName') required String raceName,
    @JsonKey(name: 'raceType') required String raceType,
    @JsonKey(name: 'placeId') required String placeId,
    @JsonKey(name: 'raceCourse') required String raceCourse,
    @JsonKey(name: 'datetime') required String datetime,
    @JsonKey(name: 'raceGrade') String? raceGrade,
    @JsonKey(name: 'raceNumber') required int raceNumber,
    @JsonKey(name: 'conditionData') ConditionData? conditionData,
    @JsonKey(name: 'locationCode') String? locationCode,
    @JsonKey(name: 'raceStage') String? raceStage,
    @JsonKey(name: 'isCalendarSpecified') bool? isCalendarSpecified,
    @JsonKey(name: 'isWatched') bool? isWatched,
    @JsonKey(name: 'isConfirmed') bool? isConfirmed,
  }) = _RaceModel;

  factory RaceModel.fromJson(Map<String, dynamic> json) =>
      _$RaceModelFromJson(json);

  const RaceModel._();

  RaceEntity toEntity() {
    return RaceEntity(
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
      raceStage: raceStage,
      isCalendarSpecified: isCalendarSpecified,
      isWatched: isWatched,
      isConfirmed: isConfirmed,
    );
  }
}
