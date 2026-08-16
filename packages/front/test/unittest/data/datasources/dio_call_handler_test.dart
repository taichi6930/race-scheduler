// handleDioCall のデシジョンテーブル（OBS-022 / QERR-05）
//
// | ID   | 操作                                              | 期待                                                                    |
// | ---- | ------------------------------------------------- | ------------------------------------------------------------------------ |
// | T-01 | callが正常に完了する                              | callの戻り値がそのまま返る、ログは出力されない                          |
// | T-02 | callがDioExceptionを投げる                        | ApiCallExceptionへ変換される（`API Error: <message>`表示を維持）、ログが出力される |
// | T-03 | callがDioException以外のExceptionを投げる         | そのまま再スローされる（変換されない）、ログは出力されない              |
// | T-04 | DioExceptionType.connectionError                  | ApiErrorKind.connection に分類される                                    |
// | T-05 | DioExceptionType.connectionTimeout/send/receive   | ApiErrorKind.timeout に分類される                                       |
// | T-06 | DioExceptionType.badResponse (statusCode=429)     | ApiErrorKind.badResponse に分類され、statusCodeが保持される             |
// | T-07 | DioExceptionType.cancel                           | ApiErrorKind.cancel に分類される                                        |
// | T-08 | DioExceptionType.unknown/badCertificate           | ApiErrorKind.other に分類される                                         |

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/dio_call_handler.dart';

void main() {
  group('handleDioCall（OBS-022 / QERR-05）', () {
    late DebugPrintCallback originalDebugPrint;
    late List<String> logs;
    final options = RequestOptions(path: '/race', method: 'GET');

    setUp(() {
      originalDebugPrint = debugPrint;
      logs = [];
      debugPrint = (String? message, {int? wrapWidth}) {
        logs.add(message ?? '');
      };
    });

    tearDown(() {
      debugPrint = originalDebugPrint;
    });

    test('[T-01] callが正常に完了する_戻り値がそのまま返りログは出力されない', () async {
      final result = await handleDioCall(() async => 'ok');

      expect(result, 'ok');
      expect(logs, isEmpty);
    });

    test('[T-02] callがDioExceptionを投げる_ApiCallExceptionへ変換されログが出力される', () async {
      await expectLater(
        () => handleDioCall<String>(
          () async => throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionTimeout,
            message: 'timed out',
          ),
        ),
        throwsA(
          isA<ApiCallException>().having(
            (e) => e.toString(),
            'toString()',
            contains('API Error: timed out'),
          ),
        ),
      );
      expect(logs, hasLength(1));
      expect(logs.single, contains('GET'));
      expect(logs.single, contains('/race'));
      expect(logs.single, contains('timed out'));
    });

    test(
      '[T-03] callがDioException以外のExceptionを投げる_そのまま再スローされログは出力されない',
      () async {
        await expectLater(
          () => handleDioCall<String>(
            () async => throw Exception('Failed to load races'),
          ),
          throwsA(
            isA<Exception>().having(
              (e) => e.toString(),
              'message',
              contains('Failed to load races'),
            ),
          ),
        );
        expect(logs, isEmpty);
      },
    );

    final classificationCases = <String, (DioExceptionType, int?, ApiErrorKind)>{
      '[T-04] connectionError': (
        DioExceptionType.connectionError,
        null,
        ApiErrorKind.connection,
      ),
      '[T-05a] connectionTimeout': (
        DioExceptionType.connectionTimeout,
        null,
        ApiErrorKind.timeout,
      ),
      '[T-05b] sendTimeout': (
        DioExceptionType.sendTimeout,
        null,
        ApiErrorKind.timeout,
      ),
      '[T-05c] receiveTimeout': (
        DioExceptionType.receiveTimeout,
        null,
        ApiErrorKind.timeout,
      ),
      '[T-06] badResponse(429)': (
        DioExceptionType.badResponse,
        429,
        ApiErrorKind.badResponse,
      ),
      '[T-07] cancel': (DioExceptionType.cancel, null, ApiErrorKind.cancel),
      '[T-08a] unknown': (DioExceptionType.unknown, null, ApiErrorKind.other),
      '[T-08b] badCertificate': (
        DioExceptionType.badCertificate,
        null,
        ApiErrorKind.other,
      ),
    };

    for (final entry in classificationCases.entries) {
      final (dioType, statusCode, expectedKind) = entry.value;

      test('${entry.key}_${expectedKind.name}に分類される', () async {
        final response = statusCode == null
            ? null
            : Response<void>(requestOptions: options, statusCode: statusCode);

        ApiCallException? caught;
        try {
          await handleDioCall<String>(
            () async => throw DioException(
              requestOptions: options,
              type: dioType,
              response: response,
              message: 'error',
            ),
          );
        } on ApiCallException catch (e) {
          caught = e;
        }

        expect(caught, isNotNull);
        expect(caught!.kind, expectedKind);
        expect(caught.statusCode, statusCode);
      });
    }
  });
}
