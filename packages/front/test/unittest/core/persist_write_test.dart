// persistWrite のデシジョンテーブル
//
// | ID   | 操作                       | 期待                                        |
// | ---- | -------------------------- | ------------------------------------------- |
// | T-01 | 書き込みが失敗              | エラーが握りつぶされずonErrorへ渡る（PERF-107） |
// | T-02 | 書き込みが成功              | onErrorは呼ばれない                          |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/persist_write.dart';

void main() {
  group('persistWrite（PERF-107）', () {
    test('[T-01] 書き込みが失敗_エラーが握りつぶされずonErrorへ渡る', () async {
      Object? capturedError;
      StackTrace? capturedStackTrace;

      persistWrite(
        () => Future<bool>.error(Exception('boom'), StackTrace.current),
        onError: (error, stackTrace) {
          capturedError = error;
          capturedStackTrace = stackTrace;
        },
      );
      await Future<void>.delayed(Duration.zero);

      expect(capturedError, isNotNull);
      expect(capturedStackTrace, isNotNull);
    });

    test('[T-02] 書き込みが成功_onErrorは呼ばれない', () async {
      var onErrorCalled = false;

      persistWrite(
        () async => true,
        onError: (error, stackTrace) => onErrorCalled = true,
      );
      await Future<void>.delayed(Duration.zero);

      expect(onErrorCalled, isFalse);
    });
  });
}
