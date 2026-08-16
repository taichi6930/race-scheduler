// KeibaTypeChipsBar のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                       |
// | ---- | ----------------------------- | --------------------------------------------- |
// | T-01 | JRAをタップ                   | onToggleTypeがRaceType.jraで呼ばれる         |
// | T-02 | selectedTypes={nar}を指定     | 「地方」が選択状態で表示される               |
// | T-03 | 通常描画（A11Y-013）          | チップのタップ領域の高さが44以上             |
// | T-04 | selectedTypes={overseas}を指定（末尾） | 「海外」がJRAより先頭側に表示される（並び替え） |
// | T-05 | 「海外」を選択後、再タップして解除 | 解除後も「海外」の表示位置が変わらない（変な挙動の回帰防止） |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/keiba_type_chips_bar.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  Widget buildBar({
    required Set<RaceType> selectedTypes,
    required ValueChanged<RaceType> onToggleType,
  }) {
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: KeibaTypeChipsBar(
          selectedTypes: selectedTypes,
          onToggleType: onToggleType,
        ),
      ),
    );
  }

  // 実アプリのRiverpod状態と同じく、選択集合を新しいSetへ置き換えて
  // トグルするステートフルなラッパー（T-05用）。
  Widget buildStatefulBar() {
    var selectedTypes = const <RaceType>{};
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) {
            return KeibaTypeChipsBar(
              selectedTypes: selectedTypes,
              onToggleType: (type) => setState(() {
                selectedTypes = selectedTypes.contains(type)
                    ? ({...selectedTypes}..remove(type))
                    : {...selectedTypes, type};
              }),
            );
          },
        ),
      ),
    );
  }

  testWidgets('[T-01] JRAをタップ_onToggleTypeがRaceType.jraで呼ばれる', (tester) async {
    RaceType? tapped;
    await tester.pumpWidget(
      buildBar(selectedTypes: const {}, onToggleType: (type) => tapped = type),
    );

    await tester.tap(find.text('JRA'));
    await tester.pump();

    expect(tapped, RaceType.jra);
  });

  testWidgets('[T-02] selectedTypes=nar指定_「地方」が選択状態で表示される', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(selectedTypes: const {RaceType.nar}, onToggleType: (_) {}),
    );

    expect(
      tester.getSemantics(find.text('地方')),
      matchesSemantics(
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
        label: '地方',
      ),
    );
    handle.dispose();
  });

  testWidgets('[T-03] 通常描画_チップのタップ領域の高さが44以上', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(selectedTypes: const {}, onToggleType: (_) {}),
    );

    final size = tester.getSize(find.bySemanticsLabel('JRA'));

    expect(size.height, greaterThanOrEqualTo(44));
    handle.dispose();
  });

  testWidgets('[T-04] selectedTypes=overseas指定_JRAより先頭側に表示される', (tester) async {
    await tester.pumpWidget(
      buildBar(selectedTypes: const {RaceType.overseas}, onToggleType: (_) {}),
    );

    final overseasX = tester.getTopLeft(find.text('海外')).dx;
    final jraX = tester.getTopLeft(find.text('JRA')).dx;

    expect(overseasX, lessThan(jraX));
  });

  testWidgets('[T-05] 「海外」を選択後に解除_表示位置が変わらない', (tester) async {
    await tester.pumpWidget(buildStatefulBar());

    await tester.tap(find.text('海外'));
    await tester.pumpAndSettle();
    final selectedX = tester.getTopLeft(find.text('海外')).dx;

    await tester.tap(find.text('海外'));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.text('海外')).dx, selectedX);
  });
}
