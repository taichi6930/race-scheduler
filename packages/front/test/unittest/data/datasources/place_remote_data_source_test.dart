// PlaceRemoteDataSource.getPlacesByDateRange のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                          |
// | ---- | -------------------------------------------- | ----------------------------------------------- |
// | T-01 | raceTypeListに複数件指定                     | 全件がクエリパラメータに含まれる（PERF-122）    |
// | T-02 | locationList・gradeListに複数件指定          | 全件がクエリパラメータに含まれる（PERF-122）    |
// | T-03 | 正常応答（200・{count,places}）               | PlaceModelのリストを返す                        |
// | T-04 | isDisplayPlaceHeldDays・isDisplayPlaceGradeを指定 | 両方がクエリパラメータに文字列として含まれる |
// | T-05 | 異常応答（200・想定外の形状）                 | 例外がスローされる                              |
// | T-06 | 同一パラメータで並行に2回呼び出す             | HTTPリクエストは1回だけ発火する（PERF-124）     |
// | T-07 | 異なるパラメータで並行に2回呼び出す           | HTTPリクエストがそれぞれ発火する                |

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/place_remote_data_source.dart';

/// リクエスト内容を検証するため、実際の通信を行わず [RequestOptions] を
/// 捕捉するだけの [HttpClientAdapter]。応答本文は [responseBody] で差し替え可能。
class _CapturingAdapter implements HttpClientAdapter {
  _CapturingAdapter({
    this.responseBody = '{"count":0,"places":[]}',
    this.delay,
  });

  RequestOptions? lastOptions;
  final String responseBody;

  /// PERF-124: dedupのテスト用に、複数呼び出しが重なるよう応答を遅延させる。
  final Duration? delay;
  int fetchCallCount = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    fetchCallCount++;
    lastOptions = options;
    if (delay != null) await Future<void>.delayed(delay!);
    return ResponseBody.fromString(
      responseBody,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  group('PlaceRemoteDataSource.getPlacesByDateRange', () {
    late _CapturingAdapter adapter;
    late PlaceRemoteDataSource dataSource;

    setUp(() {
      adapter = _CapturingAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      dataSource = PlaceRemoteDataSource(dio: dio);
    });

    test('[T-01] raceTypeListに複数件指定_全件がクエリパラメータに含まれる', () async {
      await dataSource.getPlacesByDateRange(
        startDate: '2026-08-01',
        finishDate: '2026-08-31',
        raceTypeList: ['jra', 'nar'],
      );

      final query = adapter.lastOptions!.uri.queryParametersAll;

      expect(query['raceTypeList'], ['jra', 'nar']);
    });

    test('[T-02] locationList_gradeListに複数件指定_全件がクエリパラメータに含まれる', () async {
      await dataSource.getPlacesByDateRange(
        startDate: '2026-08-01',
        finishDate: '2026-08-31',
        raceTypeList: ['jra'],
        locationList: ['tokyo', 'nakayama'],
        gradeList: ['G1', 'G2'],
      );

      final query = adapter.lastOptions!.uri.queryParametersAll;

      expect(query['locationList'], ['tokyo', 'nakayama']);
      expect(query['gradeList'], ['G1', 'G2']);
    });

    test('[T-03] 正常応答_配列_PlaceModelのリストを返す', () async {
      final result = await dataSource.getPlacesByDateRange(
        startDate: '2026-08-01',
        finishDate: '2026-08-31',
        raceTypeList: ['jra'],
      );

      expect(result, isEmpty);
    });

    test(
      '[T-04] isDisplayPlaceHeldDays_isDisplayPlaceGradeを指定_両方がクエリパラメータに含まれる',
      () async {
        await dataSource.getPlacesByDateRange(
          startDate: '2026-08-01',
          finishDate: '2026-08-31',
          raceTypeList: ['jra'],
          isDisplayPlaceHeldDays: true,
          isDisplayPlaceGrade: true,
        );

        final query = adapter.lastOptions!.uri.queryParameters;

        expect(query['isDisplayPlaceHeldDays'], 'true');
        expect(query['isDisplayPlaceGrade'], 'true');
      },
    );

    test('[T-05] 異常応答_想定外の形状_例外がスローされる', () async {
      final brokenAdapter = _CapturingAdapter(
        responseBody: '{"unexpected":true}',
      );
      final brokenDataSource = PlaceRemoteDataSource(
        dio: Dio()..httpClientAdapter = brokenAdapter,
      );

      expect(
        () => brokenDataSource.getPlacesByDateRange(
          startDate: '2026-08-01',
          finishDate: '2026-08-31',
          raceTypeList: ['jra'],
        ),
        throwsException,
      );
    });

    test('[T-06] 同一パラメータで並行に2回呼び出す_HTTPリクエストは1回だけ発火する', () async {
      final dedupAdapter = _CapturingAdapter(
        delay: const Duration(milliseconds: 10),
      );
      final dedupDataSource = PlaceRemoteDataSource(
        dio: Dio()..httpClientAdapter = dedupAdapter,
      );

      await Future.wait([
        dedupDataSource.getPlacesByDateRange(
          startDate: '2026-08-01',
          finishDate: '2026-08-31',
          raceTypeList: ['jra'],
        ),
        dedupDataSource.getPlacesByDateRange(
          startDate: '2026-08-01',
          finishDate: '2026-08-31',
          raceTypeList: ['jra'],
        ),
      ]);

      expect(dedupAdapter.fetchCallCount, 1);
    });

    test('[T-07] 異なるパラメータで並行に2回呼び出す_HTTPリクエストがそれぞれ発火する', () async {
      final dedupAdapter = _CapturingAdapter(
        delay: const Duration(milliseconds: 10),
      );
      final dedupDataSource = PlaceRemoteDataSource(
        dio: Dio()..httpClientAdapter = dedupAdapter,
      );

      await Future.wait([
        dedupDataSource.getPlacesByDateRange(
          startDate: '2026-08-01',
          finishDate: '2026-08-31',
          raceTypeList: ['jra'],
        ),
        dedupDataSource.getPlacesByDateRange(
          startDate: '2026-09-01',
          finishDate: '2026-09-30',
          raceTypeList: ['jra'],
        ),
      ]);

      expect(dedupAdapter.fetchCallCount, 2);
    });
  });
}
