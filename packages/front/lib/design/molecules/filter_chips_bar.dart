import 'package:flutter/material.dart';

import '../../domain/entities/race_type.dart';
import '../../domain/entities/timeline_filter.dart';
import '../atoms/discipline_toggle_chip.dart';
import '../atoms/sub_filter_chip.dart';
import '../tokens.dart';
import 'scrollable_chip_row.dart';

/// タイムラインの絞り込みチップ列（横スクロール、screens.md §1.1-2）。
///
/// 「重賞のみ」「★ お気に入り」は独立にON/OFFでき、両方ONの場合は
/// 「重賞 または お気に入り」のOR結合で絞り込む（同時押下可）。
/// 競技チップ4つ（[enabledDisciplines]）は設定画面と連動する永続化済みの値。
/// 新しく選択した競技チップは先頭（左端）へ移動して表示する（解除時は位置を
/// 変えない、[ScrollableChipRow] 参照）。モードチップ2つは並び替えの対象外
/// （常に先頭固定）。
class FilterChipsBar extends StatelessWidget {
  const FilterChipsBar({
    required this.state,
    required this.enabledDisciplines,
    required this.onToggleMode,
    required this.onToggleDiscipline,
    super.key,
  });

  final TimelineFilterState state;
  final Set<Discipline> enabledDisciplines;
  final ValueChanged<TimelineFilterMode> onToggleMode;
  final ValueChanged<Discipline> onToggleDiscipline;

  @override
  Widget build(BuildContext context) {
    final items = [
      (mode: TimelineFilterMode.grade, discipline: null),
      (mode: TimelineFilterMode.favorite, discipline: null),
      ...Discipline.all.map((d) => (mode: null, discipline: d)),
    ];
    return ScrollableChipRow<_FilterChipEntry>(
      items: items,
      isPinned: (entry) => entry.mode != null,
      isSelected: (entry) => switch (entry.mode) {
        TimelineFilterMode.grade => state.gradeOnly,
        TimelineFilterMode.favorite => state.favoriteOnly,
        null => enabledDisciplines.contains(entry.discipline),
      },
      itemBuilder: (context, entry) => switch (entry.mode) {
        TimelineFilterMode.grade => SubFilterChip(
          label: '重賞のみ',
          selected: state.gradeOnly,
          onTap: () => onToggleMode(TimelineFilterMode.grade),
        ),
        TimelineFilterMode.favorite => SubFilterChip(
          label: '★ お気に入り',
          semanticLabel: 'お気に入り',
          selected: state.favoriteOnly,
          onTap: () => onToggleMode(TimelineFilterMode.favorite),
        ),
        null => DisciplineToggleChip(
          discipline: entry.discipline!,
          selected: enabledDisciplines.contains(entry.discipline),
          onTap: () => onToggleDiscipline(entry.discipline!),
          size: context.scaledChipHeight(44),
        ),
      },
    );
  }
}

/// [FilterChipsBar] の1チップ分を表す。[mode] がnullでなければモードチップ、
/// nullなら [discipline] が指す競技チップを表す。Recordの構造的等価性を
/// [ScrollableChipRow] の並び替え（`List.remove`）にそのまま使う。
typedef _FilterChipEntry = ({TimelineFilterMode? mode, Discipline? discipline});
