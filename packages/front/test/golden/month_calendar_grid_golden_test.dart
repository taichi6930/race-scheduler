// MonthCalendarGrid のビジュアルリグレッション（ゴールデン）テスト。
//
// 月グリッドの曜日配色（日曜=danger, 土曜=saturday。祝日は曜日ヘッダーには
// 適用されないが日付セルの数字色には適用される）と Google Calendar
// 配色のドットマーカー、選択日のハイライトを画素レベルで固定する。
//
// | ID   | 条件                                | 期待                                  |
// | ---- | ----------------------------------- | ---------------------------------------- |
// | T-01 | 複数グレード色のマーカー・選択日あり | goldens/month_calendar_grid.png と一致  |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/google_calendar_colors.dart';
import 'package:front/design/organisms/month_calendar_grid.dart';

import 'golden_test_helpers.dart';

void main() {
  testWidgets('[T-01] 複数グレード色のマーカー_選択日あり', (tester) async {
    await pumpGolden(
      tester,
      MonthCalendarGrid(
        month: DateTime(2026, 4),
        markers: const {
          5: GoogleCalendarColorKey.blueberry,
          12: GoogleCalendarColorKey.tomato,
          19: GoogleCalendarColorKey.basil,
          26: GoogleCalendarColorKey.banana,
        },
        selectedDay: 19,
        onSelectDay: (_) {},
      ),
      surfaceSize: const Size(360, 320),
    );

    await expectLater(
      find.byType(MonthCalendarGrid),
      matchesGoldenFile('goldens/month_calendar_grid.png'),
    );
  });
}
