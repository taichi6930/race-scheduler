import '../../domain/entities/calendar_event_preview.dart';
import '../../domain/entities/race_detail_ui.dart';
import '../../domain/entities/race_entity.dart';
import '../../domain/entities/race_player_entity.dart';
import '../../domain/repositories/i_race_repository.dart';
import '../datasources/race_remote_data_source.dart';

class RaceRepositoryImpl implements IRaceRepository {
  final IRaceRemoteDataSource remoteDataSource;

  RaceRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async {
    final models = await remoteDataSource.getRacesByDateRange(
      startDate: startDate,
      finishDate: finishDate,
      raceTypeList: raceTypeList,
      locationList: locationList,
      gradeList: gradeList,
      isDisplayPlaceHeldDays: isDisplayPlaceHeldDays,
    );
    return models.map((model) => model.toEntity()).toList();
  }

  @override
  Future<RaceEntity?> getRaceDetail(String raceId) {
    throw UnimplementedError();
  }

  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async {
    final model = await remoteDataSource.getCalendarEventPreview(raceId);
    return model.toEntity();
  }

  @override
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId) async {
    final models = await remoteDataSource.getRacePlayers(raceId);
    return models.map((model) => model.toEntity()).toList();
  }

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async {
    final model = await remoteDataSource.getRaceDetailUi(raceId);
    return model.entity;
  }
}
