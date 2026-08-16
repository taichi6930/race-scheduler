import '../../domain/entities/calendar_race_entity.dart';
import '../../domain/repositories/i_calendar_repository.dart';
import '../datasources/calendar_remote_data_source.dart';

class CalendarRepositoryImpl implements ICalendarRepository {
  final ICalendarRemoteDataSource remoteDataSource;

  CalendarRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<CalendarRaceEntity>> getCalendarRaces({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
  }) async {
    final models = await remoteDataSource.getCalendarRaces(
      startDate: startDate,
      finishDate: finishDate,
      raceTypeList: raceTypeList,
    );
    return models.map((model) => model.toEntity()).toList();
  }
}
