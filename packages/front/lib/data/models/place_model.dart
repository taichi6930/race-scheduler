import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/place_entity.dart';

part 'place_model.freezed.dart';
part 'place_model.g.dart';

@freezed
abstract class PlaceModel with _$PlaceModel {
  const factory PlaceModel({
    @JsonKey(name: 'placeId') required String placeId,
    @JsonKey(name: 'raceType') required String raceType,
    @JsonKey(name: 'raceCourse') required String raceCourse,
    @JsonKey(name: 'locationCode') required String locationCode,
    @JsonKey(name: 'datetime') required String datetime,
    @JsonKey(name: 'placeGrade') String? placeGrade,
    @JsonKey(name: 'isRaceListAvailable') bool? isRaceListAvailable,
  }) = _PlaceModel;

  factory PlaceModel.fromJson(Map<String, dynamic> json) =>
      _$PlaceModelFromJson(json);

  const PlaceModel._();

  PlaceEntity toEntity() {
    return PlaceEntity(
      placeId: placeId,
      raceType: raceType,
      raceCourse: raceCourse,
      locationCode: locationCode,
      datetime: datetime,
      placeGrade: placeGrade,
      isRaceListAvailable: isRaceListAvailable,
    );
  }
}
