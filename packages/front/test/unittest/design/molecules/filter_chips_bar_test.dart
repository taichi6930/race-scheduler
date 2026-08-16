// FilterChipsBar の競技チップ（_DisciplineChip）・モードチップ（_ModeChip）の
// アクセシビリティに関するデシジョンテーブル（A11Y-013/014/026/028）
//
// | ID   | 条件     | 期待                                                    |
// | ---- | -------- | ------------------------------------------------------------ |
// | T-01 | 通常描画 | 競技名（例:'競馬'）がSemanticsラベルとして読み上げられる |
// | T-02 | 通常描画 | 絵文字自体はSemanticsラベルとして重複読み上げされない    |
// | T-03 | 通常描画 | 競技チップのタップ領域が44×44以上                       |
// | T-04 | 通常描画 | お気に入りチップが「お気に入り」ラベルで読み上げられ、★記号は含まない |
// | T-05 | enabledDisciplines={boatrace}（末尾の要素） | 競艇が競馬より先頭側に表示される（並び替え） |
// | T-06 | 競艇を選択後、再タップして解除     | 解除後も競艇の表示位置が変わらない（変な挙動の回帰防止） |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/filter_chips_bar.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/domain/entities/timeline_filter.dart';

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: FilterChipsBar(
          state: const TimelineFilterState(),
          enabledDisciplines: Discipline.all.toSet(),
          onToggleMode: (_) {},
          onToggleDiscipline: (_) {},
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('[T-01] 通常描画_競技名がSemanticsラベルとして読み上げられる', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel(Discipline.keiba.label), findsOneWidget);
  });

  testWidgets('[T-02] 通常描画_絵文字自体はSemanticsラベルとして重複読み上げされない', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel(Discipline.keiba.emoji), findsNothing);
  });

  testWidgets('[T-03] 通常描画_競技チップのタップ領域が44×44以上', (tester) async {
    await _pump(tester);

    final size = tester.getSize(find.bySemanticsLabel(Discipline.keiba.label));

    expect(size.width, greaterThanOrEqualTo(44));
    expect(size.height, greaterThanOrEqualTo(44));
  });

  testWidgets('[T-04] 通常描画_お気に入りチップがお気に入りラベルで読み上げられ星記号を含まない', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel('お気に入り'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('★')), findsNothing);
  });

  testWidgets('[T-05] enabledDisciplines=boatrace指定_競馬より先頭側に表示される', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: FilterChipsBar(
            state: const TimelineFilterState(),
            enabledDisciplines: const {Discipline.boatrace},
            onToggleMode: (_) {},
            onToggleDiscipline: (_) {},
          ),
        ),
      ),
    );

    final boatraceX = tester
        .getTopLeft(find.bySemanticsLabel(Discipline.boatrace.label))
        .dx;
    final keibaX = tester
        .getTopLeft(find.bySemanticsLabel(Discipline.keiba.label))
        .dx;

    expect(boatraceX, lessThan(keibaX));
  });

  testWidgets('[T-06] 競艇を選択後に解除_表示位置が変わらない', (tester) async {
    // 実アプリのRiverpod状態と同じく、選択集合を新しいSetへ置き換えて
    // トグルするステートフルなラッパー。
    var enabledDisciplines = const <Discipline>{};
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return FilterChipsBar(
                state: const TimelineFilterState(),
                enabledDisciplines: enabledDisciplines,
                onToggleMode: (_) {},
                onToggleDiscipline: (discipline) => setState(() {
                  enabledDisciplines = enabledDisciplines.contains(discipline)
                      ? ({...enabledDisciplines}..remove(discipline))
                      : {...enabledDisciplines, discipline};
                }),
              );
            },
          ),
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel(Discipline.boatrace.label));
    await tester.pumpAndSettle();
    final selectedX = tester
        .getTopLeft(find.bySemanticsLabel(Discipline.boatrace.label))
        .dx;

    await tester.tap(find.bySemanticsLabel(Discipline.boatrace.label));
    await tester.pumpAndSettle();

    expect(
      tester.getTopLeft(find.bySemanticsLabel(Discipline.boatrace.label)).dx,
      selectedX,
    );
  });
}
