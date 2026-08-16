// SettingsStepperRow / SettingsToggleRow / SettingsActionRow / SettingsGroup の
// アクセシビリティに関するデシジョンテーブル
// （A11Y-002, A11Y-003, A11Y-004, A11Y-016, A11Y-036）
//
// | ID   | 条件                    | 期待                                                        |
// | ---- | ----------------------- | ---------------------------------------------------------------- |
// | T-01 | SettingsStepperRow描画  | 「減らす」ラベルの操作可能要素が存在する                    |
// | T-02 | SettingsStepperRow描画  | 「増やす」ラベルの操作可能要素が存在する                    |
// | T-03 | SettingsToggleRow描画   | titleのテキストがSwitchのSemanticsとマージされ関連付く      |
// | T-04 | SettingsStepperRow描画  | 「減らす」「増やす」ボタンのタップ領域が44×44以上           |
// | T-05 | SettingsActionRow描画   | ボタンロール(isButton)が付与される                          |
// | T-06 | SettingsActionRow描画_enabled:false | ボタンが無効(isEnabled:false)として読み上げられる |
// | T-07 | SettingsGroup描画       | titleがグループのSemanticsラベルとして関連付く              |
// | T-08 | SettingsActionRow描画   | excludeSemantics適用後もtapアクションがSemantics経由で有効  |
// | T-09 | SettingsActionRow描画   | タップ可能なことを示すシェブロンアイコンが表示される（QSET-08） |
// | T-10 | SettingsValueRow描画    | 読み取り専用行にはシェブロンアイコンが表示されない（QSET-08） |
// | T-11 | SettingsValueRow(onTap指定) | コピーアイコンが表示され、タップでonTapが呼ばれる（QSUP-04） |

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/settings_rows.dart';

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(theme: AppTheme.light(), home: Scaffold(body: child)),
  );
}

void main() {
  group('SettingsStepperRow', () {
    testWidgets('[T-01] 減らすラベルの操作可能要素が存在する', (tester) async {
      await _pump(
        tester,
        SettingsStepperRow(
          icon: '⏱',
          title: '通知タイミング',
          valueLabel: '5分前',
          onDecrement: () {},
          onIncrement: () {},
        ),
      );

      expect(find.bySemanticsLabel('減らす'), findsOneWidget);
    });

    testWidgets('[T-02] 増やすラベルの操作可能要素が存在する', (tester) async {
      await _pump(
        tester,
        SettingsStepperRow(
          icon: '⏱',
          title: '通知タイミング',
          valueLabel: '5分前',
          onDecrement: () {},
          onIncrement: () {},
        ),
      );

      expect(find.bySemanticsLabel('増やす'), findsOneWidget);
    });

    testWidgets('[T-04] 減らす_増やすボタンのタップ領域が44×44以上', (tester) async {
      await _pump(
        tester,
        SettingsStepperRow(
          icon: '⏱',
          title: '通知タイミング',
          valueLabel: '5分前',
          onDecrement: () {},
          onIncrement: () {},
        ),
      );

      final decreaseSize = tester.getSize(find.bySemanticsLabel('減らす'));
      final increaseSize = tester.getSize(find.bySemanticsLabel('増やす'));

      expect(decreaseSize.width, greaterThanOrEqualTo(44));
      expect(decreaseSize.height, greaterThanOrEqualTo(44));
      expect(increaseSize.width, greaterThanOrEqualTo(44));
      expect(increaseSize.height, greaterThanOrEqualTo(44));
    });
  });

  group('SettingsToggleRow', () {
    testWidgets('[T-03] titleがSwitchのSemanticsとマージされ関連付く', (tester) async {
      await _pump(
        tester,
        SettingsToggleRow(
          icon: '🔔',
          title: '通知を受け取る',
          value: true,
          onChanged: (_) {},
        ),
      );

      final mergedNode = tester.getSemantics(find.bySemanticsLabel('通知を受け取る'));
      expect(mergedNode.flagsCollection.isToggled, Tristate.isTrue);
    });
  });

  group('SettingsActionRow', () {
    testWidgets('[T-05] ボタンロールisButtonが付与される', (tester) async {
      await _pump(
        tester,
        SettingsActionRow(
          icon: '🔔',
          title: 'テスト通知を送信',
          actionLabel: '送信',
          onTap: () {},
        ),
      );

      final node = tester.getSemantics(
        find.bySemanticsLabel(RegExp('テスト通知を送信')),
      );
      expect(node.flagsCollection.isButton, isTrue);
    });

    testWidgets('[T-06] enabled_false_ボタンが無効として読み上げられる', (tester) async {
      await _pump(
        tester,
        SettingsActionRow(
          icon: '🔔',
          title: 'テスト通知を送信',
          actionLabel: '送信',
          enabled: false,
          onTap: () {},
        ),
      );

      final node = tester.getSemantics(
        find.bySemanticsLabel(RegExp('テスト通知を送信')),
      );
      expect(node.flagsCollection.isEnabled, Tristate.isFalse);
    });

    testWidgets('[T-08] excludeSemantics適用後もtapアクションが有効なまま', (tester) async {
      await _pump(
        tester,
        SettingsActionRow(
          icon: '🔔',
          title: 'テスト通知を送信',
          actionLabel: '送信',
          onTap: () {},
        ),
      );

      final node = tester.getSemantics(
        find.bySemanticsLabel(RegExp('テスト通知を送信')),
      );
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
    });

    testWidgets('[T-09] タップ可能アフォーダンス(シェブロン)が表示される', (tester) async {
      await _pump(
        tester,
        SettingsActionRow(
          icon: '🔔',
          title: 'テスト通知を送信',
          actionLabel: '送信',
          onTap: () {},
        ),
      );

      expect(find.byIcon(Icons.chevron_right), findsOneWidget);
    });
  });

  group('SettingsValueRow', () {
    testWidgets('[T-10] シェブロンアイコンが表示されない（読み取り専用）', (tester) async {
      await _pump(
        tester,
        const SettingsValueRow(
          icon: '🔔',
          title: '既定フィルタ',
          value: 'すべて',
        ),
      );

      expect(find.byIcon(Icons.chevron_right), findsNothing);
    });

    testWidgets('[T-11] onTap指定時はコピーアイコンが表示されタップでonTapが呼ばれる', (
      tester,
    ) async {
      var tapped = false;
      await _pump(
        tester,
        SettingsValueRow(
          icon: 'ℹ️',
          title: 'バージョン',
          value: 'abc1234',
          onTap: () => tapped = true,
        ),
      );

      expect(find.byIcon(Icons.copy), findsOneWidget);

      await tester.tap(find.byType(InkWell));
      await tester.pump();

      expect(tapped, isTrue);
    });
  });

  group('SettingsGroup', () {
    testWidgets('[T-07] titleがグループのSemanticsラベルとして関連付く', (tester) async {
      await _pump(
        tester,
        const SettingsGroup(title: '通知', children: [SizedBox(height: 1)]),
      );

      final node = tester.getSemantics(find.byType(SettingsGroup));
      expect(node.label, '通知');
    });
  });
}
