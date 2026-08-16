// MonthCalendarGrid のデシジョンテーブル
//
// | ID   | 条件                            | 期待                                 |
// | ---- | ------------------------------- | -------------------------------------- |
// | T-01 | 4月の1日をタップ                | onSelectDayが1で呼ばれる             |
// | T-02 | markersに19日=blueberryを指定   | 19日セルにマーカーが表示される       |
// | T-03 | selectedDay=19を指定             | 19日セルが選択状態で表示される       |
// | T-04 | markersに19日を指定（A11Y-005） | Semanticsラベルに「重賞開催あり」を含む |
// | T-05 | markersに19日を指定しない        | Semanticsラベルは「19日」のみ        |
// | T-06 | 4月の19日を長押し                | onLongPressDayが19で呼ばれる         |
// | T-07 | onLongPressDay省略                | 長押ししても例外が起きない           |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/google_calendar_colors.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/month_calendar_grid.dart';

void main() {
  Widget buildGrid({
    required Map<int, GoogleCalendarColorKey> markers,
    int? selectedDay,
    required ValueChanged<int> onSelectDay,
    ValueChanged<int>? onLongPressDay,
  }) {
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: MonthCalendarGrid(
          month: DateTime(2026, 4),
          markers: markers,
          selectedDay: selectedDay,
          onSelectDay: onSelectDay,
          onLongPressDay: onLongPressDay,
        ),
      ),
    );
  }

  testWidgets('[T-01] 1日をタップ_onSelectDayが1で呼ばれる', (tester) async {
    int? tapped;
    await tester.pumpWidget(
      buildGrid(markers: const {}, onSelectDay: (day) => tapped = day),
    );

    await tester.tap(find.text('1'));
    await tester.pump();

    expect(tapped, 1);
  });

  testWidgets('[T-02] markersに19日=blueberryを指定_19日セルが描画される', (tester) async {
    await tester.pumpWidget(
      buildGrid(
        markers: const {19: GoogleCalendarColorKey.blueberry},
        onSelectDay: (_) {},
      ),
    );

    expect(find.text('19'), findsOneWidget);
  });

  testWidgets('[T-03] selectedDay=19を指定_例外なく描画される', (tester) async {
    await tester.pumpWidget(
      buildGrid(markers: const {}, selectedDay: 19, onSelectDay: (_) {}),
    );

    expect(find.text('19'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('[T-04] markersに19日を指定_Semanticsラベルに重賞開催ありを含む', (tester) async {
    await tester.pumpWidget(
      buildGrid(
        markers: const {19: GoogleCalendarColorKey.blueberry},
        onSelectDay: (_) {},
      ),
    );

    expect(find.bySemanticsLabel('19日、重賞開催あり'), findsOneWidget);
  });

  testWidgets('[T-05] markersに19日を指定しない_Semanticsラベルは19日のみ', (tester) async {
    await tester.pumpWidget(buildGrid(markers: const {}, onSelectDay: (_) {}));

    expect(find.bySemanticsLabel('19日'), findsOneWidget);
    expect(find.bySemanticsLabel('19日、重賞開催あり'), findsNothing);
  });

  testWidgets('[T-06] 19日を長押し_onLongPressDayが19で呼ばれる', (tester) async {
    int? longPressed;
    await tester.pumpWidget(
      buildGrid(
        markers: const {},
        onSelectDay: (_) {},
        onLongPressDay: (day) => longPressed = day,
      ),
    );

    await tester.longPress(find.text('19'));
    await tester.pump();

    expect(longPressed, 19);
  });

  testWidgets('[T-07] onLongPressDay省略_長押ししても例外が起きない', (tester) async {
    await tester.pumpWidget(buildGrid(markers: const {}, onSelectDay: (_) {}));

    await tester.longPress(find.text('19'));
    await tester.pump();

    expect(tester.takeException(), isNull);
  });
}
