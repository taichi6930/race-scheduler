// RaceRow のお気に入りボタンのアクセシビリティに関するデシジョンテーブル
// （A11Y-012, A11Y-027, A11Y-031）
//
// | ID   | 条件                    | 期待                                                          |
// | ---- | ----------------------- | ----------------------------------------------------------------- |
// | T-01 | isFavorite: false       | Semanticsラベル「お気に入り登録」が読み上げられる                 |
// | T-02 | isFavorite: true        | Semanticsラベル「お気に入り解除」が読み上げられる                 |
// | T-03 | 通常描画                | ☆/★の記号自体はSemanticsラベルとして重複読み上げされない          |
// | T-04 | 通常描画（A11Y-012）    | お気に入りボタンのタップ領域が44×44以上                          |
//
// RaceRow の時刻表示に関するデシジョンテーブル
//
// | ID   | 条件                                    | 期待                              |
// | ---- | --------------------------------------- | ----------------------------------- |
// | T-05 | timeを指定しない                        | race.datetimeをパースした時刻が表示される |
// | T-06 | timeを指定（race.datetimeとは異なる値） | 指定したtimeが優先して表示される  |
//
// RaceRow のヘッダー行（開催地名＋Rバッジ＋グレードバッジ）に関する
// デシジョンテーブル（FEDGE-01）
//
// | ID   | 条件                                              | 期待                                       |
// | ---- | -------------------------------------------------- | -------------------------------------------- |
// | T-07 | 狭い画面幅＋競輪の長いraceStage文言を持つレース   | レイアウトオーバーフロー例外が発生しない  |
//
// RaceRow の注目選手バッジ（KPLAYER-07）に関するデシジョンテーブル
//
// | ID   | 条件                     | 期待                                       |
// | ---- | ------------------------ | -------------------------------------------- |
// | T-08 | race.isWatched: true     | 「注目選手」バッジが表示される              |
// | T-09 | race.isWatched: false/null | 「注目選手」バッジが表示されない          |
//
// RaceRow のカウントダウン表示（QINF-07）に関するデシジョンテーブル
//
// | ID   | 条件                     | 期待                                       |
// | ---- | ------------------------ | -------------------------------------------- |
// | T-10 | countdownMinutes: 0      | 「まもなく」が表示される（「あと0分」ではない） |
// | T-11 | countdownMinutes: 5      | 「あと5分」が表示される                     |
//
// RaceRow の未確定バッジに関するデシジョンテーブル
//
// | ID   | 条件                       | 期待                                       |
// | ---- | -------------------------- | -------------------------------------------- |
// | T-12 | race.isConfirmed: false    | 「未確定」バッジが表示される                |
// | T-13 | race.isConfirmed: true/null | 「未確定」バッジが表示されない             |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/race_row.dart';
import 'package:front/domain/entities/race_entity.dart';

RaceEntity _race() => const RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00+09:00',
  raceGrade: 'GⅠ',
  raceNumber: 11,
);

RaceEntity _keirinRaceWithLongStage() => const RaceEntity(
  raceId: 'race-002',
  raceName: 'ＫＥＩＲＩＮグランプリ',
  raceType: 'keirin',
  placeId: 'place-002',
  raceCourse: '函館競輪場',
  datetime: '2026-04-19T15:40:00+09:00',
  raceGrade: 'ＧⅠ',
  raceStage: 'Ａ級チャレンジ予選最終選抜審査',
  raceNumber: 11,
);

Widget _buildRow({
  DateTime? time,
  bool isFavorite = false,
  int? countdownMinutes,
}) {
  return MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(
      body: RaceRow(
        race: _race(),
        time: time,
        isPast: false,
        isFavorite: isFavorite,
        countdownMinutes: countdownMinutes,
        onTap: () {},
        onToggleFavorite: () {},
      ),
    ),
  );
}

Future<void> _pump(WidgetTester tester, {required bool isFavorite}) async {
  await tester.pumpWidget(_buildRow(isFavorite: isFavorite));
}

void main() {
  testWidgets('[T-01] isFavorite_false_お気に入り登録ラベルが読み上げられる', (tester) async {
    await _pump(tester, isFavorite: false);

    expect(find.bySemanticsLabel('お気に入り登録'), findsOneWidget);
  });

  testWidgets('[T-02] isFavorite_true_お気に入り解除ラベルが読み上げられる', (tester) async {
    await _pump(tester, isFavorite: true);

    expect(find.bySemanticsLabel('お気に入り解除'), findsOneWidget);
  });

  testWidgets('[T-03] 通常描画_記号自体はSemanticsラベルとして重複読み上げされない', (tester) async {
    await _pump(tester, isFavorite: true);

    expect(find.bySemanticsLabel('★'), findsNothing);
  });

  testWidgets('[T-04] 通常描画_お気に入りボタンのタップ領域が44×44以上', (tester) async {
    await _pump(tester, isFavorite: false);

    final size = tester.getSize(find.bySemanticsLabel('お気に入り登録'));

    expect(size.width, greaterThanOrEqualTo(44));
    expect(size.height, greaterThanOrEqualTo(44));
  });

  testWidgets('[T-05] timeを指定しない_race.datetimeをパースした時刻が表示される', (tester) async {
    await tester.pumpWidget(_buildRow());

    expect(find.text('15:40'), findsOneWidget);
  });

  testWidgets('[T-06] timeを指定_指定したtimeが優先して表示される', (tester) async {
    // race.datetimeをパースすると15:40になるはずだが、呼び出し元計算済みの
    // 09:05を渡した場合はそちらが優先されることを確認する（二重パース回避、PERF-019）。
    await tester.pumpWidget(_buildRow(time: DateTime(2026, 4, 19, 9, 5)));

    expect(find.text('09:05'), findsOneWidget);
    expect(find.text('15:40'), findsNothing);
  });

  testWidgets('[T-07] 狭い画面幅_競輪の長いraceStage文言_オーバーフロー例外が発生しない', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: SizedBox(
            width: 220,
            child: RaceRow(
              race: _keirinRaceWithLongStage(),
              isPast: false,
              isFavorite: false,
              onTap: () {},
              onToggleFavorite: () {},
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('[T-08] race.isWatched_true_注目選手バッジが表示される', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: RaceRow(
            race: _race().copyWith(isWatched: true),
            isPast: false,
            isFavorite: false,
            onTap: () {},
            onToggleFavorite: () {},
          ),
        ),
      ),
    );

    expect(find.text('注目選手'), findsOneWidget);
  });

  testWidgets('[T-09] race.isWatched_falseまたはnull_注目選手バッジが表示されない', (
    tester,
  ) async {
    await tester.pumpWidget(_buildRow());

    expect(find.text('注目選手'), findsNothing);
  });

  testWidgets('[T-10] countdownMinutes_0_まもなくが表示される', (tester) async {
    await tester.pumpWidget(_buildRow(countdownMinutes: 0));

    expect(find.text('まもなく'), findsOneWidget);
    expect(find.text('あと0分'), findsNothing);
  });

  testWidgets('[T-11] countdownMinutes_5_あと5分が表示される', (tester) async {
    await tester.pumpWidget(_buildRow(countdownMinutes: 5));

    expect(find.text('あと5分'), findsOneWidget);
  });

  testWidgets('[T-12] race.isConfirmed_false_未確定バッジが表示される', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: RaceRow(
            race: _race().copyWith(isConfirmed: false),
            isPast: false,
            isFavorite: false,
            onTap: () {},
            onToggleFavorite: () {},
          ),
        ),
      ),
    );

    expect(find.text('未確定'), findsOneWidget);
  });

  testWidgets('[T-13] race.isConfirmed_trueまたはnull_未確定バッジが表示されない', (
    tester,
  ) async {
    await tester.pumpWidget(_buildRow());

    expect(find.text('未確定'), findsNothing);
  });
}
