import 'package:dio/dio.dart';

import '../../core/in_flight_request_dedup.dart';
import '../models/calendar_event_preview_model.dart';
import '../models/race_detail_ui_model.dart';
import '../models/race_model.dart';
import '../models/race_player_model.dart';
import 'dio_call_handler.dart';

abstract class IRaceRemoteDataSource {
  Future<List<RaceModel>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  });

  /// カレンダー登録イベントプレビューを取得する（GET /race/calendar-event）
  Future<CalendarEventPreviewModel> getCalendarEventPreview(String raceId);

  /// 出走選手一覧（車番順）を取得する（GET /race/players、KPLAYER-07）。
  /// レース一覧取得には含めず、レース詳細を開いたときにオンデマンドで呼ぶ。
  Future<List<RacePlayerModel>> getRacePlayers(String raceId);

  /// レース詳細画面のセクション型UIスキーマを取得する
  /// （GET /ui/race-detail、race-detail-sdui-design.md）。
  Future<RaceDetailUiModel> getRaceDetailUi(String raceId);
}

class RaceRemoteDataSource implements IRaceRemoteDataSource {
  final Dio dio;

  RaceRemoteDataSource({required this.dio});

  // PERF-010: 同一パラメータの/raceリクエストが連打・並行画面遷移で重複発火
  // するのを防ぐ（複数providerが同じ日付範囲を独立に取得する場合等）。
  final _dedup = InFlightRequestDedup<String>();

  @override
  Future<List<RaceModel>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) {
    final dedupKey =
        '$startDate|$finishDate|${raceTypeList.join(',')}|'
        '${locationList?.join(',') ?? ''}|${gradeList?.join(',') ?? ''}|'
        '$isDisplayPlaceHeldDays';

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

        final response = await dio.get('/race', queryParameters: queryParams);

        if (response.statusCode == 200) {
          final data = response.data;
          if (data is Map<String, dynamic> && data['races'] is List) {
            return (data['races'] as List)
                .map((item) => RaceModel.fromJson(item as Map<String, dynamic>))
                .toList();
          }
        }
        throw Exception('Failed to load races');
      });
    });
  }

  @override
  Future<CalendarEventPreviewModel> getCalendarEventPreview(String raceId) {
    return handleDioCall(() async {
      final response = await dio.get(
        '/race/calendar-event',
        queryParameters: {'raceId': raceId},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          return CalendarEventPreviewModel.fromJson(data);
        }
      }
      throw Exception('Failed to load calendar event preview');
    });
  }

  @override
  Future<List<RacePlayerModel>> getRacePlayers(String raceId) {
    return handleDioCall(() async {
      final response = await dio.get(
        '/race/players',
        queryParameters: {'raceId': raceId},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data is Map<String, dynamic> && data['players'] is List) {
          return (data['players'] as List)
              .map(
                (item) =>
                    RacePlayerModel.fromJson(item as Map<String, dynamic>),
              )
              .toList();
        }
      }
      throw Exception('Failed to load race players');
    });
  }

  @override
  Future<RaceDetailUiModel> getRaceDetailUi(String raceId) {
    return handleDioCall(() async {
      final response = await dio.get(
        '/ui/race-detail',
        queryParameters: {'raceId': raceId},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          return RaceDetailUiModel.fromJson(data);
        }
      }
      throw Exception('Failed to load race detail UI');
    });
  }
}
