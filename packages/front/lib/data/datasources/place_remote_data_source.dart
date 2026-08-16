import 'package:dio/dio.dart';

import '../../core/in_flight_request_dedup.dart';
import '../models/place_model.dart';
import 'dio_call_handler.dart';

abstract class IPlaceRemoteDataSource {
  Future<List<PlaceModel>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  });
}

class PlaceRemoteDataSource implements IPlaceRemoteDataSource {
  final Dio dio;

  PlaceRemoteDataSource({required this.dio});

  // PERF-124: PERF-010（/race）と同型のin-flight dedupを/placeにも適用する。
  final _dedup = InFlightRequestDedup<String>();

  @override
  Future<List<PlaceModel>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  }) {
    final dedupKey =
        '$startDate|$finishDate|${raceTypeList.join(',')}|'
        '${locationList?.join(',') ?? ''}|${gradeList?.join(',') ?? ''}|'
        '$isDisplayPlaceHeldDays|$isDisplayPlaceGrade';

    return _dedup.run(dedupKey, () {
      return handleDioCall(() async {
        final Map<String, dynamic> queryParams = {
          'startDate': startDate,
          'finishDate': finishDate,
          'raceTypeList': raceTypeList,
        };

        if (locationList != null && locationList.isNotEmpty) {
          queryParams['locationList'] = locationList;
        }

        if (gradeList != null && gradeList.isNotEmpty) {
          queryParams['gradeList'] = gradeList;
        }

        if (isDisplayPlaceHeldDays != null) {
          queryParams['isDisplayPlaceHeldDays'] = isDisplayPlaceHeldDays
              .toString();
        }

        if (isDisplayPlaceGrade != null) {
          queryParams['isDisplayPlaceGrade'] = isDisplayPlaceGrade.toString();
        }

        final response = await dio.get('/place', queryParameters: queryParams);

        if (response.statusCode == 200) {
          final data = response.data;
          if (data is Map<String, dynamic> && data['places'] is List) {
            return (data['places'] as List)
                .map(
                  (item) => PlaceModel.fromJson(item as Map<String, dynamic>),
                )
                .toList();
          }
        }
        throw Exception('Failed to load places');
      });
    });
  }
}
