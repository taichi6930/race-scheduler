// installGlobalErrorHandlers のデシジョンテーブル（OBS-021）
//
// | ID   | 操作                                              | 期待                                                    |
// | ---- | ------------------------------------------------- | -------------------------------------------------------- |
// | T-01 | installGlobalErrorHandlers()を実行                | FlutterError.onError / PlatformDispatcher.instance.onError が非nullになる |
// | T-02 | FlutterError.onErrorへダミーのFlutterErrorDetailsを渡す | 例外を再スローせず正常終了し、ログが出力される（既定表示も維持） |
// | T-03 | PlatformDispatcher.instance.onErrorへダミーの例外を渡す | trueを返し、例外を握りつぶさずログへ出力される（PERF-107と同様の握りつぶし防止） |

import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/global_error_handler.dart';

void main() {
  group('installGlobalErrorHandlers（OBS-021）', () {
    late FlutterExceptionHandler? originalFlutterOnError;
    late ErrorCallback? originalPlatformOnError;
    late DebugPrintCallback originalDebugPrint;
    late List<String> logs;

    setUp(() {
      originalFlutterOnError = FlutterError.onError;
      originalPlatformOnError = PlatformDispatcher.instance.onError;
      originalDebugPrint = debugPrint;

      logs = [];
      debugPrint = (String? message, {int? wrapWidth}) {
        logs.add(message ?? '');
      };
    });

    tearDown(() {
      FlutterError.onError = originalFlutterOnError;
      PlatformDispatcher.instance.onError = originalPlatformOnError;
      debugPrint = originalDebugPrint;
    });

    test(
      '[T-01] installGlobalErrorHandlersを実行_両方のハンドラが非nullになる',
      () {
        installGlobalErrorHandlers();

        expect(FlutterError.onError, isNotNull);
        expect(PlatformDispatcher.instance.onError, isNotNull);
      },
    );

    test(
      '[T-02] FlutterErrorOnErrorへダミーのdetailsを渡す_再スローせずログ出力される',
      () {
        installGlobalErrorHandlers();
        final details = FlutterErrorDetails(
          exception: Exception('dummy widget error'),
          stack: StackTrace.current,
        );

        expect(() => FlutterError.onError!(details), returnsNormally);
        expect(
          logs.any((log) => log.contains('FlutterError.onError')),
          isTrue,
        );
      },
    );

    test(
      '[T-03] PlatformDispatcherOnErrorへダミーの例外を渡す_trueを返しログ出力される',
      () {
        installGlobalErrorHandlers();
        final error = Exception('dummy async error');
        final stackTrace = StackTrace.current;

        final handled = PlatformDispatcher.instance.onError!(
          error,
          stackTrace,
        );

        expect(handled, isTrue);
        expect(
          logs.any(
            (log) => log.contains('PlatformDispatcher.instance.onError'),
          ),
          isTrue,
        );
      },
    );
  });
}
