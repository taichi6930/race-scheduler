// InFlightRequestDedup のデシジョンテーブル
//
// | ID   | 条件                                          | 期待                                          |
// | ---- | --------------------------------------------- | ---------------------------------------------- |
// | T-01 | 同一キーで並行に2回run                        | requestは1回だけ実行され、両方が同じ結果を得る |
// | T-02 | 完了後に同一キーで再度run                     | requestが再実行される（2回目のキャッシュが独立）|
// | T-03 | 異なるキーで並行にrun                         | requestがそれぞれ独立して実行される            |
// | T-04 | 進行中のrequestが例外を投げる                 | 待ち合わせた両方に同じ例外が伝播する           |
// | T-05 | 例外後に同一キーで再度run                     | requestが再実行される（失敗時もキャッシュが解放される）|

import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/in_flight_request_dedup.dart';

void main() {
  group('InFlightRequestDedup', () {
    test('[T-01] 同一キーで並行に2回runした場合、requestは1回だけ実行されること', () async {
      final dedup = InFlightRequestDedup<String>();
      var callCount = 0;
      Future<int> request() async {
        callCount++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return 42;
      }

      final results = await Future.wait([
        dedup.run('key', request),
        dedup.run('key', request),
      ]);

      expect(callCount, 1);
      expect(results, [42, 42]);
    });

    test('[T-02] 完了後に同一キーで再度runした場合、requestが再実行されること', () async {
      final dedup = InFlightRequestDedup<String>();
      var callCount = 0;
      Future<int> request() async {
        callCount++;
        return callCount;
      }

      final first = await dedup.run('key', request);
      final second = await dedup.run('key', request);

      expect(first, 1);
      expect(second, 2);
      expect(callCount, 2);
    });

    test('[T-03] 異なるキーで並行にrunした場合、requestがそれぞれ独立して実行されること', () async {
      final dedup = InFlightRequestDedup<String>();
      var callCountA = 0;
      var callCountB = 0;

      final results = await Future.wait([
        dedup.run('a', () async {
          callCountA++;
          return 'a-result';
        }),
        dedup.run('b', () async {
          callCountB++;
          return 'b-result';
        }),
      ]);

      expect(callCountA, 1);
      expect(callCountB, 1);
      expect(results, ['a-result', 'b-result']);
    });

    test('[T-04] 進行中のrequestが例外を投げた場合、待ち合わせた両方に同じ例外が伝播すること', () async {
      final dedup = InFlightRequestDedup<String>();
      var callCount = 0;
      Future<int> request() async {
        callCount++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        throw StateError('boom');
      }

      final first = dedup.run('key', request);
      final second = dedup.run('key', request);

      // 両方のFutureへ同時にリスナーを付ける（Future.wait）。逐次await
      // すると、2つ目のFutureへリスナーが付く前に1つ目の完了処理が
      // 進んでしまい、テスト自身が「未処理の例外」として検出されうる
      // （本体の実装ではなくテストの構造上の注意点）。
      await expectLater(
        Future.wait([first, second]),
        throwsA(isA<StateError>()),
      );
      expect(callCount, 1);
    });

    test('[T-05] 例外後に同一キーで再度runした場合、requestが再実行されること', () async {
      final dedup = InFlightRequestDedup<String>();
      var callCount = 0;
      Future<int> request() async {
        callCount++;
        if (callCount == 1) throw StateError('boom');
        return callCount;
      }

      await expectLater(dedup.run('key', request), throwsA(isA<StateError>()));
      final second = await dedup.run('key', request);

      expect(second, 2);
      expect(callCount, 2);
    });
  });
}
