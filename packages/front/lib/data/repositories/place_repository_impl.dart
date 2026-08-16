import '../../domain/entities/place_entity.dart';
import '../../domain/repositories/i_place_repository.dart';
import '../datasources/place_remote_data_source.dart';

class PlaceRepositoryImpl implements IPlaceRepository {
  final IPlaceRemoteDataSource remoteDataSource;

  PlaceRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<PlaceEntity>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  }) async {
    final models = await remoteDataSource.getPlacesByDateRange(
      startDate: startDate,
      finishDate: finishDate,
      raceTypeList: raceTypeList,
      locationList: locationList,
      gradeList: gradeList,
      isDisplayPlaceHeldDays: isDisplayPlaceHeldDays,
      isDisplayPlaceGrade: isDisplayPlaceGrade,
    );
    return models.map((model) => model.toEntity()).toList();
  }

  @override
  Future<PlaceEntity?> getPlaceDetail(String placeId) {
    throw UnimplementedError();
  }
}
