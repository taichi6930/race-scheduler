import 'package:dio/dio.dart';
import '../../core/in_flight_request_dedup.dart';
import '../models/calendar_race_model.dart';
import 'dio_call_handler.dart';

abstract class ICalendarRemoteDataSource {
  Future<List<CalendarRaceModel>> getCalendarRaces({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
  });
}

class CalendarRemoteDataSource implements ICalendarRemoteDataSource {
  final Dio dio;

  CalendarRemoteDataSource({required this.dio});

  // PERF-124: PERF-010（/race）と同型のin-flight dedupを/calendarにも適用する。
  final _dedup = InFlightRequestDedup<String>();

  @override
  Future<List<CalendarRaceModel>> getCalendarRaces({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
  }) {
    final dedupKey = '$startDate|$finishDate|${raceTypeList.join(',')}';

    return _dedup.run(dedupKey, () {
      return handleDioCall(() async {
        final Map<String, dynamic> queryParams = {
          'startDate': startDate,
          'finishDate': finishDate,
          'raceTypeList': raceTypeList,
        };

        final response = await dio.get(
          '/calendar',
          queryParameters: queryParams,
        );

        if (response.statusCode == 200) {
          final data = response.data;
          if (data is Map<String, dynamic> && data['calendars'] is List) {
            return (data['calendars'] as List)
                .map(
                  (item) =>
                      CalendarRaceModel.fromJson(item as Map<String, dynamic>),
                )
                .toList();
          }
        }
        throw Exception('Failed to load calendar races');
      });
    });
  }
}
