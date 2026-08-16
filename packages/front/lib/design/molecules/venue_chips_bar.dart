import 'package:flutter/material.dart';

import '../atoms/sub_filter_chip.dart';
import 'scrollable_chip_row.dart';

/// 表示中の日付・全期間に開催のある競走場の絞り込みチップ列
/// （タイムライン画面限定のセッション内フィルタ）。
///
/// [venues] は選択肢一覧（登場順、[Discipline]・[TimelineFilterState] の他の
/// 軸によっては絞り込まない）。複数選択可・OR結合。未選択（空集合）の場合は
/// 絞り込みなし。[venues] が空の場合は呼び出し側でこのウィジェット自体を
/// 描画しないこと。
///
/// 新しく選択したチップは先頭（左端）へ移動して表示する（解除時は位置を
/// 変えない、[ScrollableChipRow] 参照）。
class VenueChipsBar extends StatelessWidget {
  const VenueChipsBar({
    required this.venues,
    required this.selectedVenues,
    required this.onToggleVenue,
    super.key,
  });

  final List<String> venues;
  final Set<String> selectedVenues;
  final ValueChanged<String> onToggleVenue;

  @override
  Widget build(BuildContext context) {
    return ScrollableChipRow<String>(
      items: venues,
      isSelected: selectedVenues.contains,
      itemBuilder: (context, venue) => SubFilterChip(
        label: venue,
        selected: selectedVenues.contains(venue),
        onTap: () => onToggleVenue(venue),
      ),
    );
  }
}
