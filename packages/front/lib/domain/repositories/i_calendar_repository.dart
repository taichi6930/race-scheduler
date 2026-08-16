import '../entities/calendar_race_entity.dart';

abstract class ICalendarRepository {
  Future<List<CalendarRaceEntity>> getCalendarRaces({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
  });
}
