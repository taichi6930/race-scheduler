import '../entities/place_entity.dart';

abstract class IPlaceRepository {
  Future<List<PlaceEntity>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  });

  Future<PlaceEntity?> getPlaceDetail(String placeId);
}
