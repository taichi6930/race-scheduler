import 'package:flutter/material.dart';

import '../../domain/entities/race_type.dart';
import '../atoms/sub_filter_chip.dart';
import 'scrollable_chip_row.dart';

/// 「競馬」種目ON時にのみ表示する、JRA/地方(NAR)/海外の絞り込みチップ列。
///
/// タイムライン画面限定のセッション内フィルタで、設定画面で永続化される
/// [Discipline] とは独立（screens.md §1.2 の方針に倣う）。
/// 複数選択可・OR結合。未選択（空集合）の場合は絞り込みなし。新しく選択した
/// チップは先頭（左端）へ移動して表示する（解除時は位置を変えない、
/// [ScrollableChipRow] 参照）。
class KeibaTypeChipsBar extends StatelessWidget {
  const KeibaTypeChipsBar({
    required this.selectedTypes,
    required this.onToggleType,
    super.key,
  });

  final Set<RaceType> selectedTypes;
  final ValueChanged<RaceType> onToggleType;

  static const _types = [RaceType.jra, RaceType.nar, RaceType.overseas];
  static const _labels = {
    RaceType.jra: 'JRA',
    RaceType.nar: '地方',
    RaceType.overseas: '海外',
  };

  @override
  Widget build(BuildContext context) {
    return ScrollableChipRow<RaceType>(
      items: _types,
      isSelected: selectedTypes.contains,
      itemBuilder: (context, type) => SubFilterChip(
        label: _labels[type]!,
        selected: selectedTypes.contains(type),
        onTap: () => onToggleType(type),
      ),
    );
  }
}
