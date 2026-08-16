// GradeTierChipsBar のデシジョンテーブル
//
// ラベルは enabledDisciplines に応じて実際のグレード名を列挙する
// （SG・GPなど「GⅠ」という表記だけでは伝わらない最高峰グレードが
// 一目で分かるようにするため、design/molecules/grade_tier_chips_bar.dart）。
// T-01〜T-05は競輪のみ有効（最高峰チップ「GP・GⅠ」・上位チップ「GⅡ」）で
// 検証する。
//
// | ID   | 条件                                | 期待                                    |
// | ---- | ------------------------------------ | ------------------------------------------ |
// | T-01 | 「GP・GⅠ」をタップ                  | onToggleTierがGradeTier.topで呼ばれる     |
// | T-02 | selectedTiers={high}を指定          | 「GⅡ」が選択状態で表示される             |
// | T-03 | 通常描画（A11Y-013）                 | チップのタップ領域の高さが44以上         |
// | T-04 | selectedTiers={mid}を指定（末尾）    | 「GⅢ」が「GP・GⅠ」より先頭側に表示される（並び替え） |
// | T-05 | 「GⅢ」を選択後、再タップして解除     | 解除後も「GⅢ」の表示位置が変わらない（変な挙動の回帰防止） |
// | T-06 | 競輪+ボートレースが有効              | 最高峰チップのラベルにSGとGPが両方含まれる |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/grade_tier_chips_bar.dart';
import 'package:front/domain/entities/grade_tier.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  Widget buildBar({
    required Set<GradeTier> selectedTiers,
    required Set<Discipline> enabledDisciplines,
    required ValueChanged<GradeTier> onToggleTier,
  }) {
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: GradeTierChipsBar(
          selectedTiers: selectedTiers,
          enabledDisciplines: enabledDisciplines,
          onToggleTier: onToggleTier,
        ),
      ),
    );
  }

  // 実アプリのRiverpod状態と同じく、選択集合を新しいSetへ置き換えて
  // トグルするステートフルなラッパー（T-05用）。
  Widget buildStatefulBar() {
    var selectedTiers = const <GradeTier>{};
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) {
            return GradeTierChipsBar(
              selectedTiers: selectedTiers,
              enabledDisciplines: const {Discipline.keirin},
              onToggleTier: (tier) => setState(() {
                selectedTiers = selectedTiers.contains(tier)
                    ? ({...selectedTiers}..remove(tier))
                    : {...selectedTiers, tier};
              }),
            );
          },
        ),
      ),
    );
  }

  testWidgets('[T-01] 「GP・GⅠ」をタップ_onToggleTierがGradeTier.topで呼ばれる', (
    tester,
  ) async {
    GradeTier? tapped;
    await tester.pumpWidget(
      buildBar(
        selectedTiers: const {},
        enabledDisciplines: const {Discipline.keirin},
        onToggleTier: (tier) => tapped = tier,
      ),
    );

    await tester.tap(find.text('GP・GⅠ'));
    await tester.pump();

    expect(tapped, GradeTier.top);
  });

  testWidgets('[T-02] selectedTiers=high指定_「GⅡ」が選択状態で表示される', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(
        selectedTiers: const {GradeTier.high},
        enabledDisciplines: const {Discipline.keirin},
        onToggleTier: (_) {},
      ),
    );

    expect(
      tester.getSemantics(find.text('GⅡ')),
      matchesSemantics(
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
        label: 'GⅡ',
      ),
    );
    handle.dispose();
  });

  testWidgets('[T-03] 通常描画_チップのタップ領域の高さが44以上', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(
        selectedTiers: const {},
        enabledDisciplines: const {Discipline.keirin},
        onToggleTier: (_) {},
      ),
    );

    final size = tester.getSize(find.bySemanticsLabel('GP・GⅠ'));

    expect(size.height, greaterThanOrEqualTo(44));
    handle.dispose();
  });

  testWidgets('[T-04] selectedTiers=mid指定_「GⅢ」が「GP・GⅠ」より先頭側に表示される', (
    tester,
  ) async {
    await tester.pumpWidget(
      buildBar(
        selectedTiers: const {GradeTier.mid},
        enabledDisciplines: const {Discipline.keirin},
        onToggleTier: (_) {},
      ),
    );

    final midX = tester.getTopLeft(find.text('GⅢ')).dx;
    final topX = tester.getTopLeft(find.text('GP・GⅠ')).dx;

    expect(midX, lessThan(topX));
  });

  testWidgets('[T-05] 「GⅢ」を選択後に解除_表示位置が変わらない', (tester) async {
    await tester.pumpWidget(buildStatefulBar());

    await tester.tap(find.text('GⅢ'));
    await tester.pumpAndSettle();
    final selectedX = tester.getTopLeft(find.text('GⅢ')).dx;

    await tester.tap(find.text('GⅢ'));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.text('GⅢ')).dx, selectedX);
  });

  testWidgets('[T-06] 競輪+ボートレースが有効_最高峰チップにSGとGPが両方含まれる', (tester) async {
    await tester.pumpWidget(
      buildBar(
        selectedTiers: const {},
        enabledDisciplines: const {Discipline.keirin, Discipline.boatrace},
        onToggleTier: (_) {},
      ),
    );

    final topLabel = tester.widget<Text>(find.text('GP・GⅠ・SG・PGⅠ')).data!;

    expect(topLabel, contains('SG'));
    expect(topLabel, contains('GP'));
  });
}
