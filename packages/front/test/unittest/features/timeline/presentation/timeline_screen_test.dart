// TimelineScreen のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                      |
// | ---- | ------------------------------------------- | ------------------------------------------ |
// | T-01 | 既定（全開催）、重賞と一般が混在            | 重賞・一般の両方のレース名が表示される    |
// | T-02 | 「重賞のみ」チップをタップ（フィルタON）    | 一般レースは表示されなくなる              |
// | T-03 | 「重賞のみ」ONで該当レースが無い            | 空状態メッセージが表示される              |
// | T-04 | 未発走のレースがある                        | Next Raceカード（レース名）が表示される   |
// | T-05 | 全レースが過去                              | Next Raceカードのレース名が表示されない   |
// | T-06 | 「全期間」へ切替                            | 日別モードと同じレースが表示される        |
// | T-07 | 「全期間」へ切替                            | 日付見出しが表示される                    |
// | T-08 | 今日を表示、全レースが過去（多数件）        | 先頭ではなく末尾付近のレースが表示される  |
// | T-09 | 今日でない日を表示、全レースが過去（多数件）| 先頭のレースが表示される（強制スクロールなし） |
// | T-10 | 全期間、今日から離れた日を表示中にフィルタ操作 | 「今日へ」ボタンが表示されたまま（強制的に今日へ戻されない） |
// | T-11 | 全期間、今日付近を表示中にフィルタ操作          | NOWディバイダの位置へスクロールが追従する（境界付近に留まる） |
// | T-12 | 表示モード切替チップ（A11Y-015）             | タップ領域が44×44以上                     |
// | T-13 | 日別モードで更新ボタンをタップ               | timelineProviderが再取得される            |
// | T-14 | 日別モードでpull-to-refreshで引っ張る        | timelineProviderが再取得される            |
// | T-15 | 全期間モードで更新ボタンをタップ             | 読み込み済みの月すべてが再取得される      |
// | T-16 | 日別モードで左へスワイプ                     | 翌日へ切り替わる                          |
// | T-17 | 日別モードで右へスワイプ                     | 前日へ切り替わる                          |
// | T-18 | 全期間・今日へボタンを長押しして日付を選択   | 日別モードへ切り替わり選択した日付が表示される |
// | T-19 | フィルタが既定（未絞り込み）                 | 「絞り込みを解除」ボタンが表示されない    |
// | T-20 | 「重賞のみ」ON後に「絞り込みを解除」をタップ | 全フィルタが解除され一般レースも表示される |
// | T-21 | 日別モードで左へスワイプ                     | 取り消し可能なSnackBarが表示される        |
// | T-22 | スワイプ後のSnackBarの「取り消す」をタップ   | 元の日付に戻る                            |
// | T-23 | レース行の★をタップ（BEHAV-024）             | お気に入り登録され、再タップで解除される  |
// | T-24 | 日別モードでレース行（★以外）をタップ（BEHAV-023,033） | 詳細シート（RaceDetailContent）が表示される |
// | T-25 | 全期間モードでレース行タップ・★トグル（BEHAV-032） | 詳細シートが表示され、★トグルも動作する   |
// | T-26 | 全期間モードで過去方向へ大きくスクロール（BEHAV-030） | より過去の月が追加読み込みされる          |
// | T-27 | 全期間モードで境界から離れた後に戻る（BEHAV-031）  | 「今日へ」ボタンが再び非表示になる        |
// | T-28 | 日別モードでtimelineProviderが失敗（BEHAV-025）    | ErrorRetryCardが表示され、再試行タップで復帰する |
// | T-29 | 競走場チップをタップ（BEHAV-026）           | 選択した競走場のレースのみ表示される      |
// | T-30 | 競馬種別チップをタップ（BEHAV-027）         | 選択した種別のレースのみ表示される        |
// | T-31 | 重賞のみ×競走場チップの組み合わせ連続タップ（BEHAV-028） | 各段階で正しい組み合わせのレースのみ表示される |
// | T-32 | wideレイアウトでレース行をタップ（BEHAV-029） | 詳細パネルの選択レースが切り替わる        |
// | T-34 | 今日・全レースが過去(多数件)で先頭が非表示   | 「先頭へ戻る」FABをタップすると先頭のレースが表示される |
// | T-35 | 日別モードで右矢印キーを押す                 | 翌日へ切り替わる                          |
// | T-36 | 日別モードで左矢印キーを押す                 | 前日へ切り替わる                          |
// | T-37 | reduced motion時、今日・全レースが過去(多数件)で先頭が非表示（A11Y-032） | 「先頭へ戻る」FABタップ直後（1フレームのみ）で先頭のレースが表示される（アニメーション無しで即座に移動） |
// | T-38 | 日別モードで連続して左へスワイプ（QERR-10）  | SnackBarが積み上がらず最新の1件だけが表示される |
// | T-39 | 日別モードでスワイプヒント未表示・×をタップ（QEMP-05） | ヒントバーが消え、以後表示されない |
// | T-40 | 日別モードでスワイプヒント未表示のままスワイプ（QEMP-05） | スワイプ操作でヒントバーが自動的に消える |
// | T-41 | 重賞のみチップをタップ（QUX-021） | 絞り込みを解除ボタンの隣に該当件数バッジ「該当 1件」が表示される |
// | T-42 | 重賞のみチップをタップ（スマホの画面ジャンプ対策） | レース一覧の位置が瞬時に確定せず、AnimatedSizeで段階的に移動する |
// | T-43 | 通知タップ由来のレースIDが指定されている | 該当レースの詳細シート（RaceDetailContent）が自動的に開く |
// | T-44 | 日別モードで今日以外の日付を表示中          | アプリバーに「今日に移動」ボタンが表示される |
// | T-45 | 日別モードで今日を表示中                    | アプリバーに「今日に移動」ボタンが表示されない |
// | T-46 | 「今日に移動」ボタンをタップ                | 今日の日付に切り替わる                    |
// | T-47 | 日別モードでtimelineProviderがApiCallException(401)で失敗 | エラーメッセージに（HTTP 401）が付与される |

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/core/jst_time.dart' show jstNow;
import 'package:front/data/datasources/dio_call_handler.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/keiba_type_chips_bar.dart';
import 'package:front/design/organisms/race_row.dart';
import 'package:front/design/molecules/venue_chips_bar.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/all_timeline_provider.dart';
import 'package:front/features/timeline/application/month_key.dart';
import 'package:front/features/timeline/application/now_provider.dart';
import 'package:front/features/timeline/application/pending_race_deep_link_provider.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/features/timeline/presentation/race_detail_sheet.dart';
import 'package:front/features/timeline/presentation/timeline_screen.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/i_notification_scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// テストでは実プラットフォームチャンネルを持たないため、
/// 通知スケジューラは常にフェイクへ差し替える。
class _FakeNotificationScheduler implements INotificationScheduler {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {}

  @override
  Future<void> cancelRaceNotification(String raceId) async {}

  @override
  Future<void> cancelAll() async {}
}

final _fixedNow = DateTime(2026, 4, 19, 15, 35);

RaceEntity _race({
  required String id,
  required String name,
  required Duration offsetFromNow,
  String? grade,
}) => RaceEntity(
  raceId: id,
  raceName: name,
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: _fixedNow.add(offsetFromNow).toIso8601String(),
  raceGrade: grade,
  raceNumber: 11,
);

Widget _buildApp(
  List<RaceEntity> races, {
  DateTime? date,
  bool disableAnimations = false,
  String? pendingRaceId,
}) {
  final app = ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
      nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
      timelineProvider.overrideWith((ref, date) async => races),
      monthRaceChunkProvider.overrideWith((ref, monthKey) async => races),
      notificationSchedulerProvider.overrideWithValue(
        _FakeNotificationScheduler(),
      ),
      if (date != null)
        timelineDateProvider.overrideWith(() => _FixedDateNotifier(date)),
      if (pendingRaceId != null)
        pendingRaceDeepLinkProvider.overrideWith(
          () => _FixedPendingRaceIdNotifier(pendingRaceId),
        ),
    ],
    child: MaterialApp(theme: AppTheme.light(), home: const TimelineScreen()),
  );
  // A11Y-032: OS の「視差効果を減らす」設定をシミュレートする。MaterialApp の
  // 外側に MediaQuery を差し込むことで、内部のすべてのウィジェットから見て
  // `MediaQuery.of(context).disableAnimations` が true になる。
  if (!disableAnimations) return app;
  return MediaQuery(
    data: const MediaQueryData(disableAnimations: true),
    child: app,
  );
}

/// 月キーごとに異なるレース一覧を返す `monthRaceChunkProvider` を組み立てる。
/// [_buildApp] は全月に同じレース一覧を返すため、無限スクロールで
/// 「まだ読み込まれていない月にだけ存在するレース」の出現を検証できない。
Widget _buildMonthlyApp(Map<String, List<RaceEntity>> byMonth) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
      nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
      timelineProvider.overrideWith(
        (ref, date) async => byMonth.values.expand((races) => races).toList(),
      ),
      monthRaceChunkProvider.overrideWith(
        (ref, monthKey) async => byMonth[monthKey] ?? const [],
      ),
      notificationSchedulerProvider.overrideWithValue(
        _FakeNotificationScheduler(),
      ),
    ],
    child: MaterialApp(theme: AppTheme.light(), home: const TimelineScreen()),
  );
}

/// [timelineDateProvider] を固定日付にするテスト用Notifier。
class _FixedDateNotifier extends TimelineDateNotifier {
  _FixedDateNotifier(this._initial);

  final DateTime _initial;

  @override
  DateTime build() => _initial;
}

/// [pendingRaceDeepLinkProvider] を初期値ありで組み立てる（通知タップ直後の
/// 状態を模す）テスト用Notifier。
class _FixedPendingRaceIdNotifier extends PendingRaceDeepLinkNotifier {
  _FixedPendingRaceIdNotifier(this._initial);

  final String _initial;

  @override
  String? build() => _initial;
}

class _FakePrefsHolder {
  static late SharedPreferences prefs;
}

/// NextRaceCard は内部で `Timer.periodic` を保持し続けるため、
/// `pumpAndSettle` は永久に完了しない。代わりに FutureProvider の解決を
/// 待つのに十分な回数だけ明示的に pump する。
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  setUp(() async {
    // KPLAYER-07: timelineFilterProviderの初回移行（既定値をgradeOnly/
    // favoriteOnly両方ONへ強制上書きする一度限りの処理）は、この画面の
    // 他の挙動を検証するテスト群の前提（既定=絞り込みなし）と衝突するため、
    // 移行済み・旧デフォルト値（両方OFF）として明示的に固定する。
    SharedPreferences.setMockInitialValues({
      'timeline_filter_default_migration_v2': true,
      'timeline_filter_grade_only': false,
      'timeline_filter_favorite_only': false,
      // QEMP-05: スワイプヒントバーは表示済み扱いにしておく。既定（未表示）の
      // 挙動はヒント専用のテスト（T-39/T-40）で個別に検証する。
      'timeline_swipe_hint_seen': true,
    });
    _FakePrefsHolder.prefs = await SharedPreferences.getInstance();
  });

  final graded = _race(
    id: 'g1',
    name: '皐月賞',
    offsetFromNow: const Duration(minutes: 5),
    grade: 'GⅠ',
  );
  final plain = _race(
    id: 'plain',
    name: '伏竜特別',
    offsetFromNow: const Duration(minutes: 10),
  );
  final pastGraded = _race(
    id: 'past',
    name: '過去の重賞',
    offsetFromNow: const Duration(hours: -2),
    grade: 'GⅡ',
  );

  testWidgets('[T-01] 既定(全開催)_重賞と一般の両方が表示される', (tester) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('伏竜特別'), findsOneWidget);
  });

  testWidgets('[T-02] 重賞のみチップをタップ_一般レースは表示されなくなる', (tester) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    await tester.tap(find.text('重賞のみ'));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('伏竜特別'), findsNothing);
  });

  testWidgets('[T-03] 重賞のみON_該当レースが無い_空状態が表示される', (tester) async {
    await tester.pumpWidget(_buildApp([plain]));
    await _settle(tester);

    await tester.tap(find.text('重賞のみ'));
    await _settle(tester);

    expect(find.text('条件に合うレースがありません'), findsOneWidget);
  });

  testWidgets('[T-04] 未発走のレースがある_Next Raceカードが表示される', (tester) async {
    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);

    expect(find.text('▶ 次のレース'), findsOneWidget);
    expect(find.text('皐月賞'), findsWidgets);
  });

  testWidgets('[T-05] 全レースが過去_Next Raceカードが表示されない', (tester) async {
    await tester.pumpWidget(_buildApp([pastGraded]));
    await _settle(tester);

    expect(find.text('▶ 次のレース'), findsNothing);
  });

  testWidgets('[T-06] 全期間へ切替_日別モードと同じレースが表示される', (tester) async {
    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);

    await tester.tap(find.text('全期間'));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
  });

  testWidgets('[T-07] 全期間へ切替_日付見出しが表示される', (tester) async {
    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);

    await tester.tap(find.text('全期間'));
    await _settle(tester);

    expect(find.text('${_fixedNow.month}月${_fixedNow.day}日'), findsOneWidget);
  });

  final manyPastRaces = [
    for (var i = 0; i < 30; i++)
      _race(
        id: 'past-$i',
        name: 'レース$i',
        offsetFromNow: Duration(minutes: -300 + i * 10),
      ),
  ];

  testWidgets('[T-08] 今日_全レースが過去(多数件)_末尾付近のレースが表示される', (tester) async {
    await tester.pumpWidget(
      _buildApp(
        manyPastRaces,
        date: DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day),
      ),
    );
    await _settle(tester);

    expect(find.text('レース0'), findsNothing);
    expect(find.text('レース29'), findsOneWidget);
  });

  testWidgets('[T-09] 今日でない日_全レースが過去(多数件)_先頭のレースが表示される', (tester) async {
    final otherDay = DateTime(
      _fixedNow.year,
      _fixedNow.month,
      _fixedNow.day,
    ).add(const Duration(days: 3));
    await tester.pumpWidget(_buildApp(manyPastRaces, date: otherDay));
    await _settle(tester);

    expect(find.text('レース0'), findsOneWidget);
  });

  testWidgets('[T-10] 全期間_今日から離れた日を表示中のフィルタ操作で今日へ戻されない', (tester) async {
    final farRaces = [
      for (var i = 0; i < 25; i++)
        _race(
          id: 'far-$i',
          name: 'レースfar-$i',
          offsetFromNow: Duration(days: 10, minutes: i * 15),
          grade: 'GⅢ',
        ),
    ];
    await tester.pumpWidget(_buildApp([graded, ...farRaces]));
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);

    // 今日から大きく離れた日まで一気にスクロールする。
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
    await _settle(tester);
    expect(find.text('今日へ'), findsOneWidget);

    await tester.tap(find.text('重賞のみ'));
    // 追従アニメーション（あれば）が完了するまで待つ。全期間モードに
    // 切替済みでNextRaceCardのTimer.periodicは存在しないためpumpAndSettle可。
    await tester.pumpAndSettle();

    // フィルタ操作（表示対象レースの増減）だけでは、離れた場所を見ている
    // 最中のスクロール位置を強制的に今日へ戻さない（「今日へ」ボタンが
    // 表示されたまま＝境界から離れた位置に留まっている）。
    expect(find.text('今日へ'), findsOneWidget);
  });

  testWidgets('[T-11] 全期間_今日付近を表示中のフィルタ操作でNOWディバイダ位置へ追従する', (tester) async {
    final pastPlain = [
      for (var i = 0; i < 3; i++)
        _race(
          id: 'past-plain-$i',
          name: 'レースpast-plain-$i',
          offsetFromNow: Duration(minutes: -40 + i * 10),
        ),
    ];
    final pastGrade = _race(
      id: 'past-grade',
      name: 'レースpastGrade',
      offsetFromNow: const Duration(minutes: -5),
      grade: 'GⅢ',
    );
    final futureGrade = [
      for (var i = 0; i < 10; i++)
        _race(
          id: 'future-grade-$i',
          name: 'レースfutureGrade-$i',
          offsetFromNow: Duration(minutes: 10 + i * 10),
          grade: 'GⅢ',
        ),
    ];
    await tester.pumpWidget(
      _buildApp([...pastPlain, pastGrade, ...futureGrade]),
    );
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);

    final scrollable = find.descendant(
      of: find.byType(CustomScrollView),
      matching: find.byType(Scrollable),
    );
    final beforePixels = tester
        .state<ScrollableState>(scrollable)
        .position
        .pixels;
    expect(beforePixels, 0);

    await tester.tap(find.text('重賞のみ'));
    // 追従アニメーション（あれば）が完了するまで待つ。全期間モードに
    // 切替済みでNextRaceCardのTimer.periodicは存在しないためpumpAndSettle可。
    await tester.pumpAndSettle();

    // フィルタで一般レースが消え、NOWディバイダより前の行数が減った分だけ、
    // 発走が一番近いレース（NOWディバイダ）の位置へ追従してスクロールする。
    // 「今日へ」ボタンが出るほど遠くへは動かない（境界付近に留まる）。
    final afterPixels = tester
        .state<ScrollableState>(scrollable)
        .position
        .pixels;
    expect(afterPixels, greaterThan(0));
    expect(find.text('今日へ'), findsNothing);
  });

  testWidgets('[T-12] 表示モード切替チップのタップ領域が44×44以上（A11Y-015）', (tester) async {
    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);

    final size = tester.getSize(find.bySemanticsLabel('全期間'));

    expect(size.height, greaterThanOrEqualTo(44));
  });

  Widget buildAppWithCounter(
    void Function() onFetch, {
    List<RaceEntity> races = const [],
  }) {
    return ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
        nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
        timelineProvider.overrideWith((ref, date) async {
          onFetch();
          return races;
        }),
        monthRaceChunkProvider.overrideWith((ref, monthKey) async {
          onFetch();
          return races;
        }),
        notificationSchedulerProvider.overrideWithValue(
          _FakeNotificationScheduler(),
        ),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const TimelineScreen()),
    );
  }

  testWidgets('[T-13] 日別モードで更新ボタンをタップ_timelineProviderが再取得される', (tester) async {
    var callCount = 0;
    await tester.pumpWidget(
      buildAppWithCounter(() => callCount++, races: [pastGraded]),
    );
    await tester.pumpAndSettle();
    expect(callCount, 1);

    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pumpAndSettle();

    expect(callCount, 2);
  });

  testWidgets('[T-14] 日別モードでpull-to-refreshで引っ張る_timelineProviderが再取得される', (
    tester,
  ) async {
    var callCount = 0;
    await tester.pumpWidget(
      buildAppWithCounter(() => callCount++, races: [pastGraded]),
    );
    await tester.pumpAndSettle();
    expect(callCount, 1);

    await tester.fling(find.text('過去の重賞'), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(callCount, 2);
  });

  testWidgets('[T-15] 全期間モードで更新ボタンをタップ_読み込み済みの月すべてが再取得される', (tester) async {
    var callCount = 0;
    await tester.pumpWidget(
      buildAppWithCounter(() => callCount++, races: [pastGraded]),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('全期間'));
    await tester.pumpAndSettle();
    final callCountAfterSwitch = callCount;

    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pumpAndSettle();

    // 初期読み込み済みの3ヶ月（前月・今月・翌月）すべてが再取得される。
    expect(callCount, callCountAfterSwitch + 3);
  });

  testWidgets('[T-16] 日別モードで左へスワイプ_翌日へ切り替わる', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await _settle(tester);

    final nextDay = date.add(const Duration(days: 1));
    expect(find.text('${nextDay.month}月${nextDay.day}日'), findsOneWidget);
  });

  testWidgets('[T-17] 日別モードで右へスワイプ_前日へ切り替わる', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.fling(find.text('タイムライン'), const Offset(400, 0), 1000);
    await _settle(tester);

    final prevDay = date.subtract(const Duration(days: 1));
    expect(find.text('${prevDay.month}月${prevDay.day}日'), findsOneWidget);
  });

  testWidgets('[T-18] 全期間_今日へボタンを長押しして日付を選択_日別モードへ切り替わり選択した日付が表示される', (
    tester,
  ) async {
    final farRaces = [
      for (var i = 0; i < 25; i++)
        _race(
          id: 'far-$i',
          name: 'レースfar-$i',
          offsetFromNow: Duration(days: 10, minutes: i * 15),
          grade: 'GⅢ',
        ),
    ];
    await tester.pumpWidget(_buildApp([graded, ...farRaces]));
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
    await _settle(tester);
    expect(find.text('今日へ'), findsOneWidget);

    await tester.longPress(find.text('今日へ'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(DatePickerDialog),
        matching: find.text('20'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(DatePickerDialog),
        matching: find.text('OK'),
      ),
    );
    await tester.pumpAndSettle();

    final picked = DateTime(_fixedNow.year, _fixedNow.month, 20);
    expect(find.text('${picked.month}月${picked.day}日'), findsOneWidget);
  });

  testWidgets('[T-19] フィルタが既定_絞り込みを解除ボタンが表示されない', (tester) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    expect(find.text('絞り込みを解除'), findsNothing);
  });

  testWidgets('[T-20] 重賞のみON後に絞り込みを解除をタップ_全フィルタが解除される', (tester) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    await tester.tap(find.text('重賞のみ'));
    // 「絞り込みを解除」ボタンはAnimatedSizeで出現する行の中でも最も下に
    // あり、_settle（100ms）だけでは200msのアニメーションが完了せず
    // まだ画面外にクリップされている場合があるため、次にこれをタップする
    // 前提でここは完全に静止するまで待つ。
    await tester.pumpAndSettle();
    expect(find.text('伏竜特別'), findsNothing);
    expect(find.text('絞り込みを解除'), findsOneWidget);

    await tester.tap(find.text('絞り込みを解除'));
    await tester.pumpAndSettle();

    expect(find.text('伏竜特別'), findsOneWidget);
    expect(find.text('絞り込みを解除'), findsNothing);
  });

  testWidgets('[T-41] 重賞のみチップをタップ_該当件数バッジに該当1件が表示される', (tester) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    await tester.tap(find.text('重賞のみ'));
    await _settle(tester);

    expect(find.text('該当 1件'), findsOneWidget);
  });

  testWidgets('[T-21] 日別モードで左へスワイプ_取り消し可能なSnackBarが表示される', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await tester.pump();

    final nextDay = date.add(const Duration(days: 1));
    expect(
      find.text('${nextDay.month}月${nextDay.day}日に移動しました'),
      findsOneWidget,
    );
    expect(find.text('取り消す'), findsOneWidget);
  });

  testWidgets('[T-22] スワイプ後のSnackBarの取り消すをタップ_元の日付に戻る', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await tester.pumpAndSettle();
    await tester.tap(find.text('取り消す'));
    await _settle(tester);

    expect(find.text('${date.month}月${date.day}日'), findsOneWidget);
  });

  testWidgets('[T-38] 日別モードで連続して左へスワイプ_SnackBarが最新の1件だけになる', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await tester.pump();
    // timelineProviderの非同期解決（async関数のFutureオーバーライド）を
    // 待つため、2回目のスワイプ前にもう1フレームpumpする（本ファイル内の
    // 他テストと同じ「非同期解決待ちの2連続pump」パターン）。
    await tester.pump();
    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await tester.pump();

    final twoDaysLater = date.add(const Duration(days: 2));
    expect(
      find.text('${twoDaysLater.month}月${twoDaysLater.day}日に移動しました'),
      findsOneWidget,
    );
    expect(find.byType(SnackBar), findsOneWidget);
  });

  testWidgets('[T-23] レース行の★をタップ_お気に入り登録され再タップで解除されること', (tester) async {
    // デフォルトのテストビューポート（800x600）だと、1件のみのレース行の★が
    // 「先頭へ戻る」FAB（画面右下に常時固定表示）と重なりタップを奪われるため、
    // 縦に余裕を持たせてから検証する。
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_buildApp([plain]));
    await _settle(tester);

    expect(find.bySemanticsLabel('お気に入り登録'), findsOneWidget);
    expect(find.bySemanticsLabel('お気に入り解除'), findsNothing);

    await tester.tap(find.bySemanticsLabel('お気に入り登録'));
    await _settle(tester);

    expect(find.bySemanticsLabel('お気に入り解除'), findsOneWidget);
    expect(find.bySemanticsLabel('お気に入り登録'), findsNothing);

    await tester.tap(find.bySemanticsLabel('お気に入り解除'));
    await _settle(tester);

    expect(find.bySemanticsLabel('お気に入り登録'), findsOneWidget);
    expect(find.bySemanticsLabel('お気に入り解除'), findsNothing);
  });

  testWidgets('[T-24] 日別モードでレース行をタップ_詳細シートが表示される', (tester) async {
    await tester.pumpWidget(_buildApp([plain]));
    await _settle(tester);

    expect(find.byType(RaceDetailContent), findsNothing);

    await tester.tap(
      find.descendant(of: find.byType(RaceRow), matching: find.text('伏竜特別')),
    );
    await _settle(tester);

    expect(find.byType(RaceDetailContent), findsOneWidget);
  });

  testWidgets('[T-25] 全期間モードでレース行タップ・★トグル_詳細シート表示とトグルが動作する', (tester) async {
    final currentMonthKey = monthKeyOf(DateTime(jstNow().year, jstNow().month));
    await tester.pumpWidget(
      _buildMonthlyApp({
        currentMonthKey: [plain],
      }),
    );
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);

    expect(find.bySemanticsLabel('お気に入り登録'), findsOneWidget);

    await tester.tap(
      find.descendant(of: find.byType(RaceRow), matching: find.text('伏竜特別')),
    );
    await _settle(tester);
    expect(find.byType(RaceDetailContent), findsOneWidget);

    await tester.tapAt(const Offset(10, 10));
    await _settle(tester);

    await tester.tap(find.bySemanticsLabel('お気に入り登録'));
    await _settle(tester);
    expect(find.bySemanticsLabel('お気に入り解除'), findsOneWidget);
  });

  testWidgets('[T-26] 全期間モードで過去方向へ大きくスクロール_より過去の月が追加読み込みされる', (tester) async {
    final currentMonthKey = monthKeyOf(DateTime(jstNow().year, jstNow().month));
    final farPastMonthKey = offsetMonthKey(currentMonthKey, -2);
    RaceEntity raceOn(String id, String name, DateTime datetime) => RaceEntity(
      raceId: id,
      raceName: name,
      raceType: 'jra',
      placeId: 'place-$id',
      raceCourse: '中山',
      datetime: datetime.toIso8601String(),
      raceNumber: 1,
    );
    final byMonth = {
      farPastMonthKey: [
        raceOn(
          'far-past',
          'レース2ヶ月前',
          jstNow().subtract(const Duration(days: 60)),
        ),
      ],
      offsetMonthKey(currentMonthKey, -1): [
        raceOn('prev', 'レース前月', jstNow().subtract(const Duration(days: 20))),
      ],
      currentMonthKey: [graded],
      offsetMonthKey(currentMonthKey, 1): [
        raceOn('next', 'レース来月', jstNow().add(const Duration(days: 20))),
      ],
    };
    await tester.pumpWidget(_buildMonthlyApp(byMonth));
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);

    expect(find.text('レース2ヶ月前'), findsNothing);
    expect(find.text('レース前月'), findsOneWidget);

    for (var i = 0; i < 6; i++) {
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await tester.pumpAndSettle();
    }

    expect(find.text('レース2ヶ月前'), findsOneWidget);
  });

  testWidgets('[T-27] 全期間モードで境界から離れた後に戻る_今日へボタンが再び非表示になる', (tester) async {
    final farRaces = [
      for (var i = 0; i < 25; i++)
        _race(
          id: 'far-$i',
          name: 'レースfar-$i',
          offsetFromNow: Duration(days: 10, minutes: i * 15),
          grade: 'GⅢ',
        ),
    ];
    await tester.pumpWidget(_buildApp([graded, ...farRaces]));
    await _settle(tester);
    await tester.tap(find.text('全期間'));
    await _settle(tester);
    expect(find.text('今日へ'), findsNothing);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
    await _settle(tester);
    expect(find.text('今日へ'), findsOneWidget);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, 3000));
    await _settle(tester);
    expect(find.text('今日へ'), findsNothing);
  });

  testWidgets('[T-28] 日別モードでtimelineProviderが失敗_ErrorRetryCard表示・再試行で復帰する', (
    tester,
  ) async {
    var shouldFail = true;
    final app = ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
        nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
        timelineProvider.overrideWith((ref, date) async {
          if (shouldFail) throw Exception('network error');
          return [plain];
        }),
        monthRaceChunkProvider.overrideWith((ref, monthKey) async => [plain]),
        notificationSchedulerProvider.overrideWithValue(
          _FakeNotificationScheduler(),
        ),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const TimelineScreen()),
    );

    await tester.pumpWidget(app);
    await tester.pumpAndSettle();

    expect(find.text('レースの取得に失敗しました'), findsOneWidget);
    expect(find.text('伏竜特別'), findsNothing);

    shouldFail = false;
    await tester.tap(find.text('再試行'));
    await tester.pumpAndSettle();

    expect(find.text('レースの取得に失敗しました'), findsNothing);
    expect(find.text('伏竜特別'), findsWidgets);
  });

  testWidgets(
    '[T-47] 日別モードでApiCallException(401)で失敗_メッセージに（HTTP 401）が付与される',
    (tester) async {
      final app = ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(_FakePrefsHolder.prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          timelineProvider.overrideWith(
            (ref, date) async => throw ApiCallException(
              kind: ApiErrorKind.badResponse,
              statusCode: 401,
              message: 'Unauthorized',
            ),
          ),
          monthRaceChunkProvider.overrideWith(
            (ref, monthKey) async => [plain],
          ),
          notificationSchedulerProvider.overrideWithValue(
            _FakeNotificationScheduler(),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TimelineScreen(),
        ),
      );

      await tester.pumpWidget(app);
      await tester.pumpAndSettle();

      expect(find.text('レースの取得に失敗しました（HTTP 401）'), findsOneWidget);
    },
  );

  testWidgets('[T-29] 競走場チップをタップ_選択した競走場のレースのみ表示される', (tester) async {
    final nakayama = _race(
      id: 'nk',
      name: '中山レース',
      offsetFromNow: const Duration(minutes: 10),
    );
    final oi = RaceEntity(
      raceId: 'oi',
      raceName: '大井レース',
      raceType: 'nar',
      placeId: 'place-oi',
      raceCourse: '大井',
      datetime: _fixedNow.add(const Duration(minutes: 15)).toIso8601String(),
      raceNumber: 5,
    );
    await tester.pumpWidget(_buildApp([nakayama, oi]));
    await _settle(tester);

    expect(find.text('中山レース'), findsWidgets);
    expect(find.text('大井レース'), findsOneWidget);

    await tester.tap(
      find.descendant(
        of: find.byType(VenueChipsBar),
        matching: find.text('中山'),
      ),
    );
    await _settle(tester);

    expect(find.text('中山レース'), findsWidgets);
    expect(find.text('大井レース'), findsNothing);
  });

  testWidgets('[T-30] 競馬種別チップをタップ_選択した種別のレースのみ表示される', (tester) async {
    final jraRace = _race(
      id: 'jra1',
      name: 'JRAレース',
      offsetFromNow: const Duration(minutes: 10),
    );
    final narRace = RaceEntity(
      raceId: 'nar1',
      raceName: '地方レース',
      raceType: 'nar',
      placeId: 'place-nar1',
      raceCourse: '大井',
      datetime: _fixedNow.add(const Duration(minutes: 15)).toIso8601String(),
      raceNumber: 5,
    );
    await tester.pumpWidget(_buildApp([jraRace, narRace]));
    await _settle(tester);

    expect(find.text('JRAレース'), findsWidgets);
    expect(find.text('地方レース'), findsOneWidget);

    await tester.tap(
      find.descendant(
        of: find.byType(KeibaTypeChipsBar),
        matching: find.text('JRA'),
      ),
    );
    await _settle(tester);

    expect(find.text('JRAレース'), findsWidgets);
    expect(find.text('地方レース'), findsNothing);
  });

  testWidgets('[T-31] 重賞のみ×競走場チップの組み合わせ連続タップ_各段階で正しく絞り込まれる', (tester) async {
    final narGraded = RaceEntity(
      raceId: 'narg',
      raceName: '地方重賞',
      raceType: 'nar',
      placeId: 'place-narg',
      raceCourse: '大井',
      raceGrade: 'GⅢ',
      datetime: _fixedNow.add(const Duration(minutes: 20)).toIso8601String(),
      raceNumber: 5,
    );
    // ScrollablePositionedList はデフォルトのテストビューポート（800x600）だと
    // 3件目のレース行を仮想化により未構築のままにするため、縦に十分な高さを
    // 確保してから検証する（本番コードの不具合ではなくテスト環境のサイズ起因）。
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_buildApp([graded, narGraded, plain]));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('地方重賞'), findsOneWidget);
    expect(find.text('伏竜特別'), findsOneWidget);

    await tester.tap(find.text('重賞のみ'));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('地方重賞'), findsOneWidget);
    expect(find.text('伏竜特別'), findsNothing);

    await tester.tap(
      find.descendant(
        of: find.byType(VenueChipsBar),
        matching: find.text('中山'),
      ),
    );
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('地方重賞'), findsNothing);
    expect(find.text('伏竜特別'), findsNothing);

    await tester.tap(
      find.descendant(
        of: find.byType(VenueChipsBar),
        matching: find.text('中山'),
      ),
    );
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('地方重賞'), findsOneWidget);
    expect(find.text('伏竜特別'), findsNothing);

    await tester.tap(find.text('重賞のみ'));
    await _settle(tester);

    expect(find.text('皐月賞'), findsWidgets);
    expect(find.text('地方重賞'), findsOneWidget);
    expect(find.text('伏竜特別'), findsOneWidget);
  });

  testWidgets('[T-32] wideレイアウトでレース行をタップ_詳細パネルの選択レースが切り替わる', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);

    expect(
      find.descendant(
        of: find.byType(RaceDetailContent),
        matching: find.text('皐月賞'),
      ),
      findsOneWidget,
    );

    await tester.tap(
      find.descendant(of: find.byType(RaceRow), matching: find.text('伏竜特別')),
    );
    await _settle(tester);

    expect(
      find.descendant(
        of: find.byType(RaceDetailContent),
        matching: find.text('伏竜特別'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('[T-34] 今日_全レースが過去(多数件)_先頭へ戻るFABで先頭のレースが表示される', (tester) async {
    await tester.pumpWidget(
      _buildApp(
        manyPastRaces,
        date: DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day),
      ),
    );
    await _settle(tester);
    expect(find.text('レース0'), findsNothing);

    await tester.tap(find.byIcon(Icons.arrow_upward));
    await tester.pumpAndSettle();

    expect(find.text('レース0'), findsOneWidget);
  });

  testWidgets(
    '[T-37] reduced motion時_今日_全レースが過去(多数件)_先頭へ戻るFABタップ直後に先頭のレースが表示される',
    (tester) async {
      await tester.pumpWidget(
        _buildApp(
          manyPastRaces,
          date: DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day),
          disableAnimations: true,
        ),
      );
      await _settle(tester);
      expect(find.text('レース0'), findsNothing);

      await tester.tap(find.byIcon(Icons.arrow_upward));
      // 通常時は300msのスクロールアニメーションが必要だが、reduced motion
      // 時は`jumpTo`で即座に移動するため、1フレームのpumpだけで到達を確認できる。
      await tester.pump();

      expect(find.text('レース0'), findsOneWidget);
    },
  );

  testWidgets('[T-35] 日別モードで右矢印キーを押す_翌日へ切り替わる', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
    await _settle(tester);

    final nextDay = date.add(const Duration(days: 1));
    expect(find.text('${nextDay.month}月${nextDay.day}日'), findsOneWidget);
  });

  testWidgets('[T-36] 日別モードで左矢印キーを押す_前日へ切り替わる', (tester) async {
    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
    await _settle(tester);

    final prevDay = date.subtract(const Duration(days: 1));
    expect(find.text('${prevDay.month}月${prevDay.day}日'), findsOneWidget);
  });

  testWidgets('[T-39] 日別モードでスワイプヒント未表示_×をタップするとヒントが消え以後表示されない', (tester) async {
    SharedPreferences.setMockInitialValues({
      'timeline_filter_default_migration_v2': true,
      'timeline_filter_grade_only': false,
      'timeline_filter_favorite_only': false,
    });
    _FakePrefsHolder.prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);
    expect(find.text('左右にスワイプすると前日・翌日に移動できます'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await _settle(tester);
    expect(find.text('左右にスワイプすると前日・翌日に移動できます'), findsNothing);

    // 永続化されるため、画面を再構築しても表示されない。
    await tester.pumpWidget(_buildApp([graded]));
    await _settle(tester);
    expect(find.text('左右にスワイプすると前日・翌日に移動できます'), findsNothing);
  });

  testWidgets('[T-40] 日別モードでスワイプヒント未表示のままスワイプ_ヒントバーが自動的に消える', (tester) async {
    SharedPreferences.setMockInitialValues({
      'timeline_filter_default_migration_v2': true,
      'timeline_filter_grade_only': false,
      'timeline_filter_favorite_only': false,
    });
    _FakePrefsHolder.prefs = await SharedPreferences.getInstance();

    final date = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: date));
    await _settle(tester);
    expect(find.text('左右にスワイプすると前日・翌日に移動できます'), findsOneWidget);

    await tester.fling(find.text('タイムライン'), const Offset(-400, 0), 1000);
    await _settle(tester);

    expect(find.text('左右にスワイプすると前日・翌日に移動できます'), findsNothing);
  });

  testWidgets('[T-42] 重賞のみチップをタップ_レース一覧の位置がAnimatedSizeで段階的に移動する', (
    tester,
  ) async {
    await tester.pumpWidget(_buildApp([graded, plain]));
    await _settle(tester);
    final beforeY = tester.getTopLeft(find.text('皐月賞').first).dy;

    await tester.tap(find.text('重賞のみ'));
    await tester.pump();
    // GradeTierChipsBar・該当件数バッジが出現し、AnimatedSize（200ms）の
    // アニメーション途中の状態。
    await tester.pump(const Duration(milliseconds: 50));
    final duringY = tester.getTopLeft(find.text('皐月賞').first).dy;

    await tester.pumpAndSettle();
    final afterY = tester.getTopLeft(find.text('皐月賞').first).dy;

    // アニメーション無しなら次のフレームで即座に afterY まで動くはずだが、
    // AnimatedSizeにより途中経過（before < during < after）を経由する
    // （スマホでフィルタ更新時に画面が瞬時に大きくジャンプする不具合の対策）。
    expect(duringY, greaterThan(beforeY));
    expect(duringY, lessThan(afterY));
  });

  testWidgets('[T-43] 通知タップ由来のレースIDが指定されている_該当レースの詳細シートが自動的に開く', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildApp([graded, plain], pendingRaceId: plain.raceId),
    );
    await _settle(tester);

    expect(find.byType(RaceDetailContent), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(RaceDetailContent),
        matching: find.text('伏竜特別'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('[T-44] 日別モードで今日以外の日付_今日に移動ボタンが表示される', (tester) async {
    final otherDay = DateTime(
      _fixedNow.year,
      _fixedNow.month,
      _fixedNow.day,
    ).add(const Duration(days: 3));
    await tester.pumpWidget(_buildApp([graded], date: otherDay));
    await _settle(tester);

    expect(find.byIcon(Icons.today), findsOneWidget);
  });

  testWidgets('[T-45] 日別モードで今日を表示中_今日に移動ボタンが表示されない', (tester) async {
    final today = DateTime(_fixedNow.year, _fixedNow.month, _fixedNow.day);
    await tester.pumpWidget(_buildApp([graded], date: today));
    await _settle(tester);

    expect(find.byIcon(Icons.today), findsNothing);
  });

  testWidgets('[T-46] 今日に移動ボタンをタップ_今日の日付に切り替わる', (tester) async {
    final otherDay = DateTime(
      _fixedNow.year,
      _fixedNow.month,
      _fixedNow.day,
    ).add(const Duration(days: 3));
    await tester.pumpWidget(_buildApp([graded], date: otherDay));
    await _settle(tester);

    await tester.tap(find.byIcon(Icons.today));
    await _settle(tester);

    expect(find.text('${_fixedNow.month}月${_fixedNow.day}日'), findsOneWidget);
    expect(find.byIcon(Icons.today), findsNothing);
  });
}
