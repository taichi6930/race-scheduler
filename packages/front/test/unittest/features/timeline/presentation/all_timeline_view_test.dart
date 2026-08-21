// nearestTodayRowIndex のデシジョンテーブル
//
// | ID   | 条件                                                  | 期待                                    |
// | ---- | ----------------------------------------------------- | ---------------------------------------- |
// | T-01 | futureが空                                             | 0                                         |
// | T-02 | 今日の途中（NOWディバイダあり）                        | ディバイダの行インデックス                |
// | T-03 | 今日のレースが全て消化済み（後続の日付ブロック無し）   | 今日最後の行のインデックス                |
// | T-04 | 今日のレースが全て消化済み（翌日以降のブロックが続く） | 翌日ヘッダー直前（今日最後）の行インデックス |
// | T-05 | 今日のレースが全て未発走                               | 0                                         |
// | T-06 | 今日のレースが0件（ヘッダーのみ→翌日ヘッダー）          | 0                                         |
//
// _AllTimelineBodyState のスクロールデバウンス（PERF-024）のデシジョンテーブル
//
// | ID   | 条件                                                        | 期待                              |
// | ---- | ------------------------------------------------------------ | ---------------------------------- |
// | T-07 | 短時間に複数回スクロール位置が変化                           | デバウンス時間経過まで先読みロードが実行されない |
// | T-08 | デバウンス時間経過後                                          | 直近のスクロール位置に対して1回だけ先読みロードが実行される |
// | T-09 | reduced motion時（A11Y-032）、「今日へ」ボタンをタップ        | 1フレームのpumpだけでスクロール位置が境界付近へ即座に移動する（アニメーション無し） |
// | T-11 | 「今日へ」ボタン（QEMP-06）                                  | 長押しで日付ピッカーが開くことを示すtooltipを持つ |
//
// 全月の取得失敗時の表示分岐（FEDGE-03）のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                                     |
// | ---- | ------------------------------ | ---------------------------------------------------------- |
// | T-10 | 読み込み済み全月の取得が失敗   | 「条件に合うレースがありません」ではなくErrorRetryCardが表示される |
// | T-12 | 読み込み済み全月の取得がApiCallException(401)で失敗 | エラーメッセージに（HTTP 401）が付与される |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/data/datasources/dio_call_handler.dart';
import 'package:front/design/theme.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/all_timeline_provider.dart';
import 'package:front/features/timeline/application/now_provider.dart';
import 'package:front/features/timeline/application/timeline_row.dart';
import 'package:front/features/timeline/presentation/all_timeline_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _now = DateTime(2026, 4, 19, 15, 0);

RaceEntity _race(String id, DateTime datetime) => RaceEntity(
  raceId: id,
  raceName: 'レース$id',
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: datetime.toIso8601String(),
  raceNumber: 1,
);

/// [LoadedMonthsNotifier.loadEarlier]/[loadLater] の呼び出し回数を記録する
/// スパイ。デバウンスにより実処理（[loadEarlier]/[loadLater] の呼び出し）が
/// 間引かれていることを検証するために使う。
class _SpyLoadedMonthsNotifier extends LoadedMonthsNotifier {
  int loadEarlierCallCount = 0;
  int loadLaterCallCount = 0;

  @override
  void loadEarlier() {
    loadEarlierCallCount++;
    super.loadEarlier();
  }

  @override
  void loadLater() {
    loadLaterCallCount++;
    super.loadLater();
  }
}

class _FakePrefsHolder {
  static late SharedPreferences prefs;
}

Widget _buildBody(
  _SpyLoadedMonthsNotifier spy,
  List<RaceEntity> races, {
  bool disableAnimations = false,
}) {
  final app = ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
      nowProvider.overrideWith((ref) => Stream.value(_now)),
      monthRaceChunkProvider.overrideWith((ref, monthKey) async => races),
      loadedMonthsProvider.overrideWith(() => spy),
    ],
    child: MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: AllTimelineBody(
          favoriteRaceIds: const {},
          onToggleFavorite: (_) {},
          onRaceTap: (_) {},
        ),
      ),
    ),
  );
  // A11Y-032: OS の「視差効果を減らす」設定をシミュレートする。
  if (!disableAnimations) return app;
  return MediaQuery(
    data: const MediaQueryData(disableAnimations: true),
    child: app,
  );
}

void main() {
  group('nearestTodayRowIndex', () {
    test('[T-01] futureが空_0を返す', () {
      expect(nearestTodayRowIndex(const [], _now), 0);
    });

    test('[T-02] 今日の途中_NOWディバイダの行インデックスを返す', () {
      final rows = [
        DateHeaderTimelineRow(_now),
        RaceTimelineRow(_race('past', _now.subtract(const Duration(hours: 1)))),
        NowDividerTimelineRow(_now),
        RaceTimelineRow(_race('next', _now.add(const Duration(hours: 1)))),
      ];

      expect(nearestTodayRowIndex(rows, _now), 2);
    });

    test('[T-03] 今日のレースが全て消化済み_後続ブロック無し_今日最後の行を返す', () {
      final rows = [
        DateHeaderTimelineRow(_now),
        RaceTimelineRow(_race('r1', _now.subtract(const Duration(hours: 2)))),
        RaceTimelineRow(_race('r2', _now.subtract(const Duration(hours: 1)))),
      ];

      expect(nearestTodayRowIndex(rows, _now), 2);
    });

    test('[T-04] 今日のレースが全て消化済み_翌日ブロックが続く_今日最後の行を返す', () {
      final tomorrow = _now.add(const Duration(days: 1));
      final rows = [
        DateHeaderTimelineRow(_now),
        RaceTimelineRow(_race('r1', _now.subtract(const Duration(hours: 2)))),
        RaceTimelineRow(_race('r2', _now.subtract(const Duration(hours: 1)))),
        DateHeaderTimelineRow(tomorrow),
        RaceTimelineRow(_race('r3', tomorrow.add(const Duration(hours: 1)))),
      ];

      expect(nearestTodayRowIndex(rows, _now), 2);
    });

    test('[T-05] 今日のレースが全て未発走_0を返す', () {
      final rows = [
        DateHeaderTimelineRow(_now),
        RaceTimelineRow(_race('r1', _now.add(const Duration(hours: 1)))),
        RaceTimelineRow(_race('r2', _now.add(const Duration(hours: 2)))),
      ];

      expect(nearestTodayRowIndex(rows, _now), 0);
    });

    test('[T-06] 今日のレースが0件_翌日ヘッダーが続く_0を返す', () {
      final tomorrow = _now.add(const Duration(days: 1));
      final rows = [
        DateHeaderTimelineRow(_now),
        DateHeaderTimelineRow(tomorrow),
        RaceTimelineRow(_race('r1', tomorrow.add(const Duration(hours: 1)))),
      ];

      expect(nearestTodayRowIndex(rows, _now), 0);
    });
  });

  group('_AllTimelineBodyState スクロールデバウンス', () {
    setUp(() async {
      // KPLAYER-07: timelineFilterProviderの初回移行（既定値をgradeOnly/
      // favoriteOnly両方ONへ強制上書き）が、フィルタなし前提のこのテスト群
      // （grade指定なし・favorite未登録のレースを表示する）と衝突するため、
      // 移行済み・旧デフォルト値（両方OFF）として明示的に固定する。
      SharedPreferences.setMockInitialValues({
        'timeline_filter_default_migration_v2': true,
        'timeline_filter_grade_only': false,
        'timeline_filter_favorite_only': false,
      });
      _FakePrefsHolder.prefs = await SharedPreferences.getInstance();
    });

    final manyFutureRaces = [
      for (var i = 0; i < 60; i++)
        _race('future-$i', _now.add(Duration(minutes: 10 + i * 15))),
    ];

    testWidgets('[T-07] 短時間に複数回スクロール_デバウンス時間経過まで先読みロードが実行されない', (tester) async {
      final spy = _SpyLoadedMonthsNotifier();
      await tester.pumpWidget(_buildBody(spy, manyFutureRaces));
      await tester.pumpAndSettle();
      final baseline = spy.loadLaterCallCount;

      final scrollable = find.descendant(
        of: find.byType(CustomScrollView),
        matching: find.byType(Scrollable),
      );
      final position = tester.state<ScrollableState>(scrollable).position;
      // 1回のフリック中に何度も発火する状況を模して、短い間隔で
      // 連続してスクロール位置を末尾境界付近まで動かす。
      for (var i = 0; i < 5; i++) {
        position.jumpTo(position.maxScrollExtent);
      }

      // デバウンス時間（16ms）未経過の間は、まだ実処理が実行されていない。
      await tester.pump(const Duration(milliseconds: 5));
      expect(spy.loadLaterCallCount, baseline);
    });

    testWidgets('[T-08] 短時間に複数回スクロール_デバウンス時間経過後に1回だけ先読みロードが実行される', (
      tester,
    ) async {
      final spy = _SpyLoadedMonthsNotifier();
      await tester.pumpWidget(_buildBody(spy, manyFutureRaces));
      await tester.pumpAndSettle();
      final baseline = spy.loadLaterCallCount;

      final scrollable = find.descendant(
        of: find.byType(CustomScrollView),
        matching: find.byType(Scrollable),
      );
      final position = tester.state<ScrollableState>(scrollable).position;
      for (var i = 0; i < 5; i++) {
        position.jumpTo(position.maxScrollExtent);
      }

      // デバウンス時間経過後は、直近のスクロール位置に対して1回だけ実行される
      // （5回のイベント発火が1回に間引かれている）。
      await tester.pump(const Duration(milliseconds: 30));
      expect(spy.loadLaterCallCount, baseline + 1);
    });

    testWidgets('[T-09] reduced motion時_今日へボタンタップ直後に境界付近へ即座に移動する', (
      tester,
    ) async {
      final spy = _SpyLoadedMonthsNotifier();
      await tester.pumpWidget(
        _buildBody(spy, manyFutureRaces, disableAnimations: true),
      );
      await tester.pumpAndSettle();

      final scrollable = find.descendant(
        of: find.byType(CustomScrollView),
        matching: find.byType(Scrollable),
      );
      final position = tester.state<ScrollableState>(scrollable).position;
      // 「今日へ」ボタンが表示される閾値を超えるまでスクロールする。
      position.jumpTo(position.maxScrollExtent);
      // デバウンス時間（16ms）経過後、ボタンが表示されるまでpumpする。
      await tester.pump(const Duration(milliseconds: 30));
      await tester.pump();
      expect(find.byIcon(Icons.today), findsOneWidget);
      final pixelsBeforeTap = position.pixels;

      await tester.tap(find.byIcon(Icons.today));
      // reduced motion時は`jumpTo`相当で即座に移動するため、1フレームの
      // pumpだけで境界付近へ大きく移動していることを確認できる
      // （通常のアニメーション時は300msかけて移動するため、1フレーム後は
      // ほぼ動いていない）。
      await tester.pump();

      expect((position.pixels - pixelsBeforeTap).abs(), greaterThan(1000));
    });

    testWidgets('[T-11] 今日へボタン_長押しで日付ピッカーが開くことを示すtooltipを持つ', (tester) async {
      final spy = _SpyLoadedMonthsNotifier();
      await tester.pumpWidget(_buildBody(spy, manyFutureRaces));
      await tester.pumpAndSettle();

      final scrollable = find.descendant(
        of: find.byType(CustomScrollView),
        matching: find.byType(Scrollable),
      );
      final position = tester.state<ScrollableState>(scrollable).position;
      position.jumpTo(position.maxScrollExtent);
      await tester.pump(const Duration(milliseconds: 30));
      await tester.pump();

      final tooltip = tester.widget<Tooltip>(
        find.ancestor(
          of: find.byType(FloatingActionButton),
          matching: find.byType(Tooltip),
        ),
      );
      expect(tooltip.message, '今日へ移動（長押しで日付を選択）');
    });
  });

  group('_AllTimelineBodyState エラー表示', () {
    setUp(() async {
      // KPLAYER-07: timelineFilterProviderの初回移行（既定値をgradeOnly/
      // favoriteOnly両方ONへ強制上書き）が、フィルタなし前提のこのテスト群
      // （grade指定なし・favorite未登録のレースを表示する）と衝突するため、
      // 移行済み・旧デフォルト値（両方OFF）として明示的に固定する。
      SharedPreferences.setMockInitialValues({
        'timeline_filter_default_migration_v2': true,
        'timeline_filter_grade_only': false,
        'timeline_filter_favorite_only': false,
      });
      _FakePrefsHolder.prefs = await SharedPreferences.getInstance();
    });

    testWidgets('[T-10] 読み込み済み全月の取得が失敗_EmptyStateではなくErrorRetryCardが表示される', (
      tester,
    ) async {
      final spy = _SpyLoadedMonthsNotifier();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
            nowProvider.overrideWith((ref) => Stream.value(_now)),
            monthRaceChunkProvider.overrideWith(
              (ref, monthKey) async => throw Exception('fetch failed'),
            ),
            loadedMonthsProvider.overrideWith(() => spy),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(
              body: AllTimelineBody(
                favoriteRaceIds: const {},
                onToggleFavorite: (_) {},
                onRaceTap: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('レースの取得に失敗しました'), findsOneWidget);
      expect(find.text('条件に合うレースがありません'), findsNothing);
    });

    testWidgets(
      '[T-12] 読み込み済み全月の取得がApiCallException(401)で失敗_メッセージに（HTTP 401）が付与される',
      (tester) async {
        final spy = _SpyLoadedMonthsNotifier();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              sharedPreferencesProvider.overrideWithValue(
                _FakePrefsHolder.prefs,
              ),
              nowProvider.overrideWith((ref) => Stream.value(_now)),
              monthRaceChunkProvider.overrideWith(
                (ref, monthKey) async => throw ApiCallException(
                  kind: ApiErrorKind.badResponse,
                  statusCode: 401,
                  message: 'Unauthorized',
                ),
              ),
              loadedMonthsProvider.overrideWith(() => spy),
            ],
            child: MaterialApp(
              theme: AppTheme.light(),
              home: Scaffold(
                body: AllTimelineBody(
                  favoriteRaceIds: const {},
                  onToggleFavorite: (_) {},
                  onRaceTap: (_) {},
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('レースの取得に失敗しました（HTTP 401）'), findsOneWidget);
      },
    );
  });
}
