// DioRetryInterceptor のデシジョンテーブル
//
// | ID   | 条件                                                | 期待                                        |
// | ---- | --------------------------------------------------- | ------------------------------------------- |
// | T-01 | GETが一時的なネットワークエラーで2回失敗し3回目で成功 | リトライして成功レスポンスを返す（計3試行） |
// | T-02 | GETが5xxで最大リトライ回数を超えて失敗し続ける       | 最終的に例外がスローされる（計3試行）       |
// | T-03 | GETが4xxで失敗                                       | リトライされず即座に例外がスローされる（計1試行） |
// | T-04 | POST（副作用のある操作）が一時的なエラーで失敗       | リトライされず即座に例外がスローされる（計1試行） |
// | T-05 | GETが1回だけ一時的なエラーで失敗し2回目で成功        | 1回だけリトライして成功する（計2試行）      |

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/network/dio_retry_interceptor.dart';

/// [_ScriptedAdapter] が呼び出し順に返す1回分の応答シナリオ。
/// [exceptionType] を指定した場合はその種別の [DioException] を送出し、
/// 未指定の場合は [statusCode] のレスポンスを返す。
class _AdapterStep {
  const _AdapterStep.success({this.statusCode = 200}) : exceptionType = null;

  const _AdapterStep.failure(DioExceptionType type)
    : exceptionType = type,
      statusCode = null;

  final DioExceptionType? exceptionType;
  final int? statusCode;
}

/// あらかじめ用意したシナリオ（[_AdapterStep] の並び）を呼び出し順に返す
/// [HttpClientAdapter]。実際の通信は行わない。
/// シナリオの終端に達した後は最後の要素を返し続ける。
class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this.script);

  final List<_AdapterStep> script;
  int callCount = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final index = callCount < script.length ? callCount : script.length - 1;
    final step = script[index];
    callCount++;

    final exceptionType = step.exceptionType;
    if (exceptionType != null) {
      throw DioException(
        requestOptions: options,
        type: exceptionType,
        message: 'simulated $exceptionType',
      );
    }

    return ResponseBody.fromString(
      '{"ok":true}',
      step.statusCode!,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  group('DioRetryInterceptor', () {
    late _ScriptedAdapter adapter;

    Dio buildDio(List<_AdapterStep> script, {int maxRetries = 2}) {
      adapter = _ScriptedAdapter(script);
      final dio = Dio()..httpClientAdapter = adapter;
      dio.interceptors.add(
        DioRetryInterceptor(
          dio: dio,
          maxRetries: maxRetries,
          retryDelays: const [
            Duration(milliseconds: 200),
            Duration(milliseconds: 400),
          ],
        ),
      );
      return dio;
    }

    test('[T-01] GETが一時的なネットワークエラーで2回失敗_3回目で成功する', () {
      fakeAsync((async) {
        final dio = buildDio([
          const _AdapterStep.failure(DioExceptionType.connectionError),
          const _AdapterStep.failure(DioExceptionType.receiveTimeout),
          const _AdapterStep.success(),
        ]);

        Response<dynamic>? result;
        Object? error;
        // fakeAsyncの同期コールバック内ではawaitできないため、
        // 内部でtry/catchするヘルパーを起動しっぱなしにし、async.elapseで
        // 仮想時間を進めて完了を待つ。
        Future<void> run() async {
          try {
            result = await dio.get<dynamic>('/race');
          } on DioException catch (e) {
            error = e;
          }
        }

        run();
        async.elapse(const Duration(seconds: 1));

        expect(error, isNull);
        expect(result?.statusCode, 200);
        expect(adapter.callCount, 3);
      });
    });

    test('[T-02] GETが5xxで最大リトライ回数を超えて失敗し続ける_最終的に例外がスローされる', () {
      fakeAsync((async) {
        final dio = buildDio([
          const _AdapterStep.success(statusCode: 503),
          const _AdapterStep.success(statusCode: 503),
          const _AdapterStep.success(statusCode: 503),
        ]);

        Object? error;
        Future<void> run() async {
          try {
            await dio.get<dynamic>('/race');
          } on DioException catch (e) {
            error = e;
          }
        }

        run();
        async.elapse(const Duration(seconds: 1));

        expect(error, isA<DioException>());
        expect((error as DioException).response?.statusCode, 503);
        expect(adapter.callCount, 3);
      });
    });

    test('[T-03] GETが4xxで失敗_リトライされず即座に例外がスローされる', () {
      fakeAsync((async) {
        final dio = buildDio([const _AdapterStep.success(statusCode: 400)]);

        Object? error;
        Future<void> run() async {
          try {
            await dio.get<dynamic>('/race');
          } on DioException catch (e) {
            error = e;
          }
        }

        run();
        async.elapse(const Duration(seconds: 1));

        expect(error, isA<DioException>());
        expect(adapter.callCount, 1);
      });
    });

    test('[T-04] POST_副作用のある操作が一時的なエラーで失敗_リトライされない', () {
      fakeAsync((async) {
        final dio = buildDio([
          const _AdapterStep.failure(DioExceptionType.connectionError),
          const _AdapterStep.success(),
        ]);

        Object? error;
        Future<void> run() async {
          try {
            await dio.post<dynamic>('/push/subscription');
          } on DioException catch (e) {
            error = e;
          }
        }

        run();
        async.elapse(const Duration(seconds: 1));

        expect(error, isA<DioException>());
        expect(adapter.callCount, 1);
      });
    });

    test('[T-05] GETが1回だけ一時的なエラーで失敗_2回目で成功する', () {
      fakeAsync((async) {
        final dio = buildDio([
          const _AdapterStep.failure(DioExceptionType.connectionTimeout),
          const _AdapterStep.success(),
        ]);

        Response<dynamic>? result;
        Future<void> run() async {
          result = await dio.get<dynamic>('/race');
        }

        run();
        async.elapse(const Duration(seconds: 1));

        expect(result?.statusCode, 200);
        expect(adapter.callCount, 2);
      });
    });
  });
}
