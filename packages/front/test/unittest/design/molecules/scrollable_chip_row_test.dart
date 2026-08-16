// ScrollableChipRow のデシジョンテーブル
//
// 新しく選択されたチップを先頭（左端）へ移動しスクロールする挙動と、
// 「解除時は位置を変えない」（解除した瞬間にチップが元の位置へ飛んで
// 見える不具合の修正）を検証する。
//
// | ID   | 条件                                       | 期待                                          |
// | ---- | ------------------------------------------ | ---------------------------------------------- |
// | T-01 | 画面外寄りのアイテムを選択                 | 先頭へ移動しスクロールされる                  |
// | T-02 | 既に先頭にあるアイテムを選択               | 位置が変わらない（クラッシュしない）          |
// | T-03 | 選択済みアイテムを解除                     | 位置が変わらない（元の位置へ飛ばない）        |
// | T-04 | 複数選択                                   | 後から選択したものほど先頭に来る              |
// | T-05 | isPinned指定                               | 固定項目は選択されても並び替えの対象外        |
//
// sortSelectedFirst のデシジョンテーブル（初期表示順の算出に使う純粋関数）
//
// | ID   | 条件                | 期待                                   |
// | ---- | ------------------- | ---------------------------------------- |
// | T-06 | 一部が選択済み      | 選択済みが前、各グループ内は元の順序を維持 |
// | T-07 | 選択なし            | 元の順序のまま                          |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/molecules/scrollable_chip_row.dart';

class _TestChipRow extends StatefulWidget {
  const _TestChipRow({this.isPinned});

  final bool Function(int item)? isPinned;

  @override
  State<_TestChipRow> createState() => _TestChipRowState();
}

class _TestChipRowState extends State<_TestChipRow> {
  // 実アプリのRiverpod状態（copyWithで常に新しいSetを作る）を模して、
  // 破壊的変更ではなく新しいSetへの置き換えでトグルする。ScrollableChipRow
  // のdidUpdateWidgetは旧/新のisSelectedクロージャを比較するため、同一の
  // 可変Setを指したままだと新規選択を検出できない。
  Set<int> _selected = {};

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 200,
          child: ScrollableChipRow<int>(
            items: List.generate(10, (i) => i),
            isSelected: _selected.contains,
            isPinned: widget.isPinned,
            itemBuilder: (context, item) => GestureDetector(
              onTap: () => setState(() {
                _selected = _selected.contains(item)
                    ? ({..._selected}..remove(item))
                    : {..._selected, item};
              }),
              child: Container(
                width: 60,
                alignment: Alignment.center,
                child: Text('item$item'),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

void main() {
  testWidgets('[T-01] 画面外寄りのアイテムを選択_先頭へ移動しスクロールされる', (tester) async {
    await tester.pumpWidget(const _TestChipRow());
    final frontX = tester.getTopLeft(find.text('item0')).dx;
    final beforeX = tester.getTopLeft(find.text('item2')).dx;

    await tester.tap(find.text('item2'));
    await tester.pumpAndSettle();

    final afterX = tester.getTopLeft(find.text('item2')).dx;
    expect(afterX, lessThan(beforeX));
    expect(afterX, closeTo(frontX, 1));
  });

  testWidgets('[T-02] 既に先頭にあるアイテムを選択_位置が変わらない', (tester) async {
    await tester.pumpWidget(const _TestChipRow());
    final frontX = tester.getTopLeft(find.text('item0')).dx;

    await tester.tap(find.text('item0'));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.text('item0')).dx, closeTo(frontX, 1));
  });

  testWidgets('[T-03] 選択済みアイテムを解除_位置が変わらない', (tester) async {
    await tester.pumpWidget(const _TestChipRow());

    await tester.tap(find.text('item2'));
    await tester.pumpAndSettle();
    final selectedX = tester.getTopLeft(find.text('item2')).dx;

    await tester.tap(find.text('item2'));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.text('item2')).dx, selectedX);
  });

  testWidgets('[T-04] 複数選択_後から選択したものほど先頭に来る', (tester) async {
    // ScrollablePositionedListは画面外遠くのアイテムを遅延構築しないため、
    // ビューポート幅(200)内に収まるインデックスのみをタップする。
    await tester.pumpWidget(const _TestChipRow());

    await tester.tap(find.text('item2'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('item1'));
    await tester.pumpAndSettle();

    final item1X = tester.getTopLeft(find.text('item1')).dx;
    final item2X = tester.getTopLeft(find.text('item2')).dx;
    expect(item1X, lessThan(item2X));
  });

  testWidgets('[T-05] isPinned指定_固定項目は選択されても並び替えの対象外', (tester) async {
    await tester.pumpWidget(_TestChipRow(isPinned: (item) => item == 0));

    await tester.tap(find.text('item1'));
    await tester.pumpAndSettle();

    final item0X = tester.getTopLeft(find.text('item0')).dx;
    final item1X = tester.getTopLeft(find.text('item1')).dx;
    expect(item0X, lessThan(item1X));
  });

  test('[T-06] 一部が選択済み_選択済みが前で各グループ内は元の順序を維持', () {
    final result = sortSelectedFirst([
      '中山',
      '東京',
      '京都',
      '阪神',
    ], {'京都', '東京'}.contains);

    expect(result, ['東京', '京都', '中山', '阪神']);
  });

  test('[T-07] 選択なし_元の順序のまま', () {
    final result = sortSelectedFirst(['中山', '東京', '京都'], (_) => false);

    expect(result, ['中山', '東京', '京都']);
  });
}
