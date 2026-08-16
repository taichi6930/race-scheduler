// scheduleTtlInvalidate のデシジョンテーブル
//
// | ID   | 条件                                  | 期待                                    |
// | ---- | ------------------------------------- | ------------------------------------------ |
// | T-01 | TTL未経過                             | 再取得されず値は変わらない                |
// | T-02 | TTL経過後に参照                       | 自動的に再取得され値が更新される          |
// | T-03 | TTL経過を1サイクル超えて繰り返す      | build のたびにタイマーが張り直され続ける  |
// | T-04 | providerが破棄された後にTTLが経過     | タイマーが解放されエラーにならない        |

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/riverpod/ttl_refresh.dart';

int _buildCount = 0;

final _counterProvider = FutureProvider<int>((ref) async {
  scheduleTtlInvalidate(ref, const Duration(minutes: 15));
  _buildCount++;
  return _buildCount;
});

void main() {
  setUp(() {
    _buildCount = 0;
  });

  group('scheduleTtlInvalidate', () {
    test('[T-01] TTL未経過_再取得されず値は変わらない', () {
      fakeAsync((async) {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        container.read(_counterProvider);
        async.flushMicrotasks();
        expect(container.read(_counterProvider).value, 1);

        async.elapse(const Duration(minutes: 14));

        expect(container.read(_counterProvider).value, 1);
      });
    });

    test('[T-02] TTL経過後に参照_自動的に再取得され値が更新される', () {
      fakeAsync((async) {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        container.read(_counterProvider);
        async.flushMicrotasks();
        expect(container.read(_counterProvider).value, 1);

        async.elapse(const Duration(minutes: 15));
        container.read(_counterProvider);
        async.flushMicrotasks();

        expect(container.read(_counterProvider).value, 2);
      });
    });

    test('[T-03] TTL経過を1サイクル超えて繰り返す_buildのたびにタイマーが張り直され続ける', () {
      fakeAsync((async) {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        container.read(_counterProvider);
        async.flushMicrotasks();

        async.elapse(const Duration(minutes: 15));
        container.read(_counterProvider);
        async.flushMicrotasks();
        expect(container.read(_counterProvider).value, 2);

        async.elapse(const Duration(minutes: 15));
        container.read(_counterProvider);
        async.flushMicrotasks();
        expect(container.read(_counterProvider).value, 3);
      });
    });

    test('[T-04] providerが破棄された後にTTLが経過_タイマーが解放されエラーにならない', () {
      fakeAsync((async) {
        final container = ProviderContainer();

        container.read(_counterProvider);
        async.flushMicrotasks();

        container.dispose();

        expect(
          () => async.elapse(const Duration(minutes: 15)),
          returnsNormally,
        );
      });
    });
  });
}
