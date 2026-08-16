import '../entities/race_entity.dart';
import '../repositories/i_race_repository.dart';

class GetRacesByDateRangeUseCase {
  final IRaceRepository repository;

  GetRacesByDateRangeUseCase(this.repository);

  Future<List<RaceEntity>> call({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
  }) {
    return repository.getRacesByDateRange(
      startDate: startDate,
      finishDate: finishDate,
      raceTypeList: raceTypeList,
      locationList: locationList,
      gradeList: gradeList,
    );
  }
}
