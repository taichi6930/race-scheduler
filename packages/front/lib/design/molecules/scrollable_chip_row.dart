import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../tokens.dart';

/// [items] を [isSelected] がtrueのものを前に、falseのものを後ろに、
/// 各グループ内の相対順序を保ったまま並べ替える（安定ソート）。
///
/// [ScrollableChipRow] が初回表示時の並び順を決めるために使う。
List<T> sortSelectedFirst<T>(List<T> items, bool Function(T item) isSelected) {
  final selected = items.where(isSelected).toList();
  final unselected = items.where((item) => !isSelected(item)).toList();
  return [...selected, ...unselected];
}

/// 横スクロールのフィルタチップ列の共通土台。
///
/// [FilterChipsBar]・[GradeTierChipsBar]・[KeibaTypeChipsBar]・[VenueChipsBar]
/// の4箇所で「チップをタップして選択しても、画面外（後方）にあると選択された
/// ことに気づけない」という同一の問題があったため、新しく選択されたチップを
/// 先頭（左端）へ移動しスクロールする挙動をここに集約する。
///
/// **選択時のみ**先頭へ移動し、**解除時は位置を変えない**（解除の瞬間に
/// チップが元の位置へ飛んで見える「変な挙動」を避けるため）。この非対称な
/// 挙動は現在の選択状態だけから導出できない（解除後にどこへ戻すべきかは
/// 「直前にどこにあったか」という履歴が要る）ため、[items]/[isSelected] の
/// 変化を [didUpdateWidget] で検知して並び順を内部状態として保持する。
///
/// [isPinned] がtrueを返す項目は並び替えの対象外とし、常に [items] に渡した
/// 順序のまま先頭側に固定表示する（例: [FilterChipsBar] の「重賞のみ」
/// 「★ お気に入り」の2つのモードチップ）。
class ScrollableChipRow<T> extends StatefulWidget {
  const ScrollableChipRow({
    required this.items,
    required this.isSelected,
    required this.itemBuilder,
    this.isPinned,
    super.key,
  });

  /// 選択肢一覧（[isPinned] が無い場合は登場順、並び替えの初期順序の基準）。
  final List<T> items;
  final bool Function(T item) isSelected;
  final Widget Function(BuildContext context, T item) itemBuilder;

  /// trueを返す項目を並び替え対象外にする（常に先頭側に元の順序で固定）。
  /// 省略時はどの項目も固定しない。
  final bool Function(T item)? isPinned;

  @override
  State<ScrollableChipRow<T>> createState() => _ScrollableChipRowState<T>();
}

class _ScrollableChipRowState<T> extends State<ScrollableChipRow<T>> {
  final _itemScrollController = ItemScrollController();
  late List<T> _order;

  bool _isPinned(T item) => widget.isPinned?.call(item) ?? false;

  List<T> _initialOrder() {
    final pinned = widget.items.where(_isPinned).toList();
    final free = widget.items.where((item) => !_isPinned(item)).toList();
    return [...pinned, ...sortSelectedFirst(free, widget.isSelected)];
  }

  @override
  void initState() {
    super.initState();
    _order = _initialOrder();
  }

  @override
  void didUpdateWidget(covariant ScrollableChipRow<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!listEquals(oldWidget.items, widget.items)) {
      _order = _initialOrder();
      return;
    }
    final newlySelected = widget.items
        .where(
          (item) =>
              !_isPinned(item) &&
              widget.isSelected(item) &&
              !oldWidget.isSelected(item),
        )
        .toList();
    if (newlySelected.isEmpty) return;

    final pinned = _order.where(_isPinned).toList();
    final rest = _order.where((item) => !_isPinned(item)).toList()
      ..removeWhere(newlySelected.contains);
    _order = [...pinned, ...newlySelected, ...rest];
    _scrollToStart();
  }

  void _scrollToStart() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_itemScrollController.isAttached) return;
      _itemScrollController.jumpTo(index: 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: context.scaledChipHeight(44),
      child: ScrollablePositionedList.separated(
        scrollDirection: Axis.horizontal,
        itemScrollController: _itemScrollController,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _order.length,
        separatorBuilder: (_, _) => const SizedBox(width: 7),
        itemBuilder: (context, index) =>
            widget.itemBuilder(context, _order[index]),
      ),
    );
  }
}
