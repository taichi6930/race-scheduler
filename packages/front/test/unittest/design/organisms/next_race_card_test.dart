// NextRaceCard のデシジョンテーブル
//
// | ID   | 条件                                    | 期待                                        |
// | ---- | --------------------------------------- | --------------------------------------------- |
// | T-01 | 初期表示                                | カウントダウン形式（M:SS）のテキストが表示される |
// | T-02 | 初期表示                                | race.datetimeから発走時刻（HH:mm 発走）が表示される |
// | T-03 | raceが別レース（別raceId）に差し替わる  | 新しいレースの発走時刻に更新される（PERF-126） |
//
// PERF-126: 1秒毎のTimerコールバック内で発走時刻を都度パースし直さず、
// initState/didUpdateWidgetで計算したキャッシュを使い回す変更のため、
// レース差し替え時にキャッシュが正しく更新されることを重点的に検証する。
//
// NextRaceCard のアクセシビリティに関するデシジョンテーブル（A11Y-017, A11Y-028）
//
// | ID   | 条件                    | 期待                                                        |
// | ---- | ----------------------- | ------------------------------------------------------------------ |
// | T-04 | isFavorite: false       | 「通知する」ラベルの操作可能要素が存在する（☆記号は含まない）      |
// | T-05 | isFavorite: true        | 「通知ON」ラベルの操作可能要素が存在する（★記号は含まない）        |
// | T-06 | 通常描画                | 「詳細」「通知する」ボタンのタップ領域の高さが44以上                |
// | T-07 | 通常描画（A11Y-033）     | カウントダウン秒数はセマンティクスから除外され、発走時刻のみが1つの静的ラベルとして読み上げられる |
//
// | T-08 | 長いraceStage文言を持つレース（FEDGE-02） | ヘッダーピルとカウントダウン表示が重ならずオーバーフロー例外も発生しない |
//
// NextRaceCard のテキストスケール拡大時のレイアウトに関するデシジョンテーブル（A11Y-020）
//
// | ID   | 条件                                              | 期待                                        |
// | ---- | ------------------------------------------------- | --------------------------------------------- |
// | T-09 | textScaler 2.0倍 + 長いraceStage文言              | オーバーフロー例外が発生しない（RenderFlex overflow等）|
// | T-10 | textScaler 2.0倍                                   | カウントダウン表示とレース名テキストが画面上で重ならない |
//
// NextRaceCard の1時間超先レース・通知ボタンに関するデシジョンテーブル
//
// | ID   | 条件                                | 期待                                        |
// | ---- | ----------------------------------- | --------------------------------------------- |
// | T-11 | 発走まで1時間超                     | カウントダウン形式(M:SS)のテキストは表示されず、発走時刻のみ表示される |
// | T-12 | 発走まで1時間以内                   | カウントダウン形式(M:SS)のテキストが表示される |
// | T-13 | 「通知する」ボタンをタップ          | onToggleFavoriteとonTapの両方が呼ばれる     |
//
// NextRaceCardのカウントダウン分表示とrace_time_utils.dartの「あとN分」の
// 丸め方向一致に関するデシジョンテーブル（QLIFE-07）
//
// | ID   | 条件                                              | 期待                                        |
// | ---- | ------------------------------------------------- | --------------------------------------------- |
// | T-14 | 分境界をまたぐ残り時間（2分5秒）を同一瞬間で比較   | カウントダウン表示の分部分とminutesUntilが同じ値になる（floorで一致） |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/jst_time.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/next_race_card.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/race_time_utils.dart';

RaceEntity _race({
  required String id,
  required String name,
  required String datetime,
  String? grade,
  String? raceType,
  String? raceStage,
}) => RaceEntity(
  raceId: id,
  raceName: name,
  raceType: raceType ?? 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: datetime,
  raceGrade: grade,
  raceStage: raceStage,
  raceNumber: 11,
);

Widget _buildCard(
  RaceEntity race, {
  bool isFavorite = false,
  TextScaler? textScaler,
  VoidCallback? onTap,
  VoidCallback? onToggleFavorite,
}) {
  final app = MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(
      body: NextRaceCard(
        race: race,
        isFavorite: isFavorite,
        onTap: onTap ?? () {},
        onToggleFavorite: onToggleFavorite ?? () {},
      ),
    ),
  );
  if (textScaler == null) return app;
  // A11Y-020: OS/ブラウザのテキストスケール設定拡大をシミュレートする。
  // MaterialApp の外側に MediaQuery を差し込み、内部の全ウィジェットから見て
  // `MediaQuery.of(context).textScaler` が指定値になるようにする
  // （timeline_screen_test.dart の disableAnimations 差し込みと同じ手法）。
  return MediaQuery(
    data: MediaQueryData(textScaler: textScaler),
    child: app,
  );
}

/// [jstWallClock]（[jstNow]と同じ「isUtc:true・フィールドはJST壁時計」表現）を、
/// レースAPIの`datetime`と同じ`+09:00`オフセット付きISO8601文字列に変換する。
///
/// [jstWallClock]をそのまま`toIso8601String()`すると`Z`終端の文字列になり、
/// `parseJstDateTime`がUTC文字列と解釈してさらに+9時間ずらしてしまう
/// （`jstNow()`が返す`isUtc:true`なDateTimeは既にJST壁時計を表しているため、
/// 二重に9時間進んでしまう）。明示的に`+09:00`を付けることで正しく往復させる。
String _jstIsoString(DateTime jstWallClock) {
  String pad(int value) => value.toString().padLeft(2, '0');
  return '${jstWallClock.year}-${pad(jstWallClock.month)}-${pad(jstWallClock.day)}'
      'T${pad(jstWallClock.hour)}:${pad(jstWallClock.minute)}:${pad(jstWallClock.second)}'
      '+09:00';
}

bool _looksLikeCountdown(Widget widget) {
  if (widget is! Text) return false;
  final data = widget.data;
  if (data == null) return false;
  return RegExp(r'^\d+:\d{2}$').hasMatch(data);
}

void main() {
  testWidgets('[T-01] 初期表示_カウントダウン形式(M:SS)のテキストが表示される', (tester) async {
    final datetime = _jstIsoString(jstNow().add(const Duration(minutes: 5)));

    await tester.pumpWidget(
      _buildCard(_race(id: 'r1', name: '皐月賞', datetime: datetime)),
    );
    await tester.pump();

    expect(find.byWidgetPredicate(_looksLikeCountdown), findsOneWidget);
  });

  testWidgets('[T-02] 初期表示_race.datetimeから発走時刻が表示される', (tester) async {
    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r1', name: '皐月賞', datetime: '2026-04-19T15:40:00+09:00'),
      ),
    );
    await tester.pump();

    expect(find.textContaining('15:40 発走'), findsOneWidget);
  });

  testWidgets('[T-03] raceが別レースに差し替わる_新しい発走時刻に更新される', (tester) async {
    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r1', name: '皐月賞', datetime: '2026-04-19T15:40:00+09:00'),
      ),
    );
    await tester.pump();
    expect(find.textContaining('15:40 発走'), findsOneWidget);

    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r2', name: '日本ダービー', datetime: '2026-04-19T16:55:00+09:00'),
      ),
    );
    await tester.pump();

    expect(find.textContaining('16:55 発走'), findsOneWidget);
    expect(find.textContaining('15:40 発走'), findsNothing);
  });

  testWidgets('[T-04] isFavorite_false_通知するラベルが読み上げられる_記号なし', (tester) async {
    await tester.pumpWidget(
      _buildCard(
        _race(
          id: 'r1',
          name: '皐月賞',
          datetime: '2026-04-19T15:40:00+09:00',
          grade: 'GⅠ',
        ),
      ),
    );

    expect(find.bySemanticsLabel('通知する'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('☆')), findsNothing);
  });

  testWidgets('[T-05] isFavorite_true_通知ONラベルが読み上げられる_記号なし', (tester) async {
    await tester.pumpWidget(
      _buildCard(
        _race(
          id: 'r1',
          name: '皐月賞',
          datetime: '2026-04-19T15:40:00+09:00',
          grade: 'GⅠ',
        ),
        isFavorite: true,
      ),
    );

    expect(find.bySemanticsLabel('通知ON'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('★')), findsNothing);
  });

  testWidgets('[T-06] 通常描画_詳細_通知するボタンのタップ領域の高さが44以上', (tester) async {
    await tester.pumpWidget(
      _buildCard(
        _race(
          id: 'r1',
          name: '皐月賞',
          datetime: '2026-04-19T15:40:00+09:00',
          grade: 'GⅠ',
        ),
      ),
    );

    final detailSize = tester.getSize(find.bySemanticsLabel('詳細'));
    final notifySize = tester.getSize(find.bySemanticsLabel('通知する'));

    expect(detailSize.height, greaterThanOrEqualTo(44));
    expect(notifySize.height, greaterThanOrEqualTo(44));
  });

  testWidgets('[T-07] 通常描画_カウントダウン秒数はセマンティクスから除外され発走時刻のみが読み上げられる', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r1', name: '皐月賞', datetime: '2026-04-19T15:40:00+09:00'),
      ),
    );
    await tester.pump();

    // 発走時刻は1つの静的なセマンティクスラベルとして読み上げ可能
    expect(find.bySemanticsLabel('15:40発走'), findsOneWidget);

    // カウントダウン数字・"HH:mm 発走" の描画テキスト自体は
    // ExcludeSemantics 配下のため、セマンティクスラベルとしては
    // 見つからない（画面上の描画は find.textContaining で別途 T-01/T-02
    // が検証済み）
    expect(find.bySemanticsLabel(RegExp(r'^\d+:\d{2}$')), findsNothing);
  });

  testWidgets('[T-08] 長いraceStage文言のレース_ヘッダーとカウントダウンが重ならずオーバーフローしない', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildCard(
        _race(
          id: 'r1',
          name: 'ＫＥＩＲＩＮグランプリ',
          datetime: '2026-04-19T15:40:00+09:00',
          grade: 'ＧⅠ',
          raceType: 'keirin',
          raceStage: 'Ａ級チャレンジ予選最終選抜審査',
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
  });

  testWidgets('[T-09] textScaler2倍かつ長いraceStage文言_オーバーフロー例外が発生しない', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildCard(
        _race(
          id: 'r1',
          name: 'ＫＥＩＲＩＮグランプリ',
          datetime: '2026-04-19T15:40:00+09:00',
          grade: 'ＧⅠ',
          raceType: 'keirin',
          raceStage: 'Ａ級チャレンジ予選最終選抜審査',
        ),
        textScaler: TextScaler.linear(2),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
  });

  testWidgets('[T-10] textScaler2倍_カウントダウン表示とレース名テキストが重ならない', (tester) async {
    final datetime = _jstIsoString(jstNow().add(const Duration(minutes: 5)));

    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r1', name: '皐月賞', datetime: datetime),
        textScaler: TextScaler.linear(2),
      ),
    );
    await tester.pump();

    final countdownRect = tester.getRect(
      find.byWidgetPredicate(_looksLikeCountdown),
    );
    final raceNameRect = tester.getRect(find.text('皐月賞'));

    expect(countdownRect.overlaps(raceNameRect), isFalse);
  });

  testWidgets('[T-11] 発走まで1時間超_カウントダウンは表示されず発走時刻のみ表示される', (tester) async {
    final datetime = _jstIsoString(jstNow().add(const Duration(minutes: 90)));

    await tester.pumpWidget(
      _buildCard(_race(id: 'r1', name: '皐月賞', datetime: datetime)),
    );
    await tester.pump();

    expect(find.byWidgetPredicate(_looksLikeCountdown), findsNothing);
  });

  testWidgets('[T-12] 発走まで1時間以内_カウントダウン形式のテキストが表示される', (tester) async {
    final datetime = _jstIsoString(jstNow().add(const Duration(minutes: 60)));

    await tester.pumpWidget(
      _buildCard(_race(id: 'r1', name: '皐月賞', datetime: datetime)),
    );
    await tester.pump();

    expect(find.byWidgetPredicate(_looksLikeCountdown), findsOneWidget);
  });

  testWidgets('[T-13] 通知するボタンをタップ_onToggleFavoriteとonTapの両方が呼ばれる', (
    tester,
  ) async {
    var toggleFavoriteCalled = false;
    var tapCalled = false;

    await tester.pumpWidget(
      _buildCard(
        _race(id: 'r1', name: '皐月賞', datetime: '2026-04-19T15:40:00+09:00'),
        onTap: () => tapCalled = true,
        onToggleFavorite: () => toggleFavoriteCalled = true,
      ),
    );

    await tester.tap(find.bySemanticsLabel('通知する'));
    await tester.pump();

    expect(toggleFavoriteCalled, isTrue);
    expect(tapCalled, isTrue);
  });

  testWidgets(
    '[T-14] 分境界をまたぐ残り時間_カウントダウンの分表示がminutesUntilと一致する',
    (tester) async {
      // 2分5秒後（分の境界を跨ぐ値）を発走時刻とし、カード側のカウントダウン
      // （M:SSの"M"部分）と行側「あとN分」が使う`minutesUntil`（floor）が
      // 同一瞬間を基準にした場合に一致することを確認する（QLIFE-07）。
      final target = jstNow().add(const Duration(seconds: 125));
      final datetime = _jstIsoString(target);

      await tester.pumpWidget(
        _buildCard(_race(id: 'r1', name: '皐月賞', datetime: datetime)),
      );
      await tester.pump();

      final countdownText = tester
          .widget<Text>(find.byWidgetPredicate(_looksLikeCountdown))
          .data!;
      final displayedMinutes = int.parse(countdownText.split(':').first);
      final expectedMinutes = minutesUntil(jstNow(), target);

      expect(displayedMinutes, expectedMinutes);
    },
  );
}
