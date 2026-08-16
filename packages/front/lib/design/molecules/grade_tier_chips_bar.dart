import 'package:flutter/material.dart';

import '../../domain/entities/grade_tier.dart';
import '../../domain/entities/race_type.dart';
import '../atoms/sub_filter_chip.dart';
import 'scrollable_chip_row.dart';

/// 「重賞のみ」ON時にのみ表示する、階層（最高峰/上位/重賞）の絞り込みチップ列。
///
/// ラベルは [enabledDisciplines] で有効な競技の実際のグレード名を列挙する
/// （例: 競馬+競輪が有効なら最高峰チップは「GⅠ・JpnⅠ・GP」）。ボートレースの
/// ように「GⅠ」表記の階層が競技ごとに異なる（ボートレースの最高峰は
/// SG/PGⅠで、GⅠはGⅡ相当）ため、固定の「GⅠ」ラベルだけでは階層に何が
/// 含まれるか伝わらない問題への対策（[specifiedGradeNamesOfTier] 参照）。
///
/// 複数選択可・OR結合。未選択（空集合）の場合は絞り込みなし（重賞のみと同じ
/// 全階層表示）。新しく選択したチップは先頭（左端）へ移動して表示する
/// （解除時は位置を変えない、[ScrollableChipRow] 参照）。
class GradeTierChipsBar extends StatelessWidget {
  const GradeTierChipsBar({
    required this.selectedTiers,
    required this.enabledDisciplines,
    required this.onToggleTier,
    super.key,
  });

  final Set<GradeTier> selectedTiers;
  final Set<Discipline> enabledDisciplines;
  final ValueChanged<GradeTier> onToggleTier;

  static const _tiers = [GradeTier.top, GradeTier.high, GradeTier.mid];

  /// フォールバック用の階層名（[enabledDisciplines] が空でグレード名を
  /// 1件も列挙できない場合のみ使う）。
  static const _fallbackLabels = {
    GradeTier.top: 'GⅠ',
    GradeTier.high: 'GⅡ',
    GradeTier.mid: 'GⅢ',
  };

  String _label(GradeTier tier) {
    final names = <String>{};
    for (final discipline in Discipline.all.where(
      enabledDisciplines.contains,
    )) {
      for (final raceType in discipline.raceTypes) {
        names.addAll(specifiedGradeNamesOfTier(raceType, tier));
      }
    }
    return names.isEmpty ? _fallbackLabels[tier]! : names.join('・');
  }

  @override
  Widget build(BuildContext context) {
    return ScrollableChipRow<GradeTier>(
      items: _tiers,
      isSelected: selectedTiers.contains,
      itemBuilder: (context, tier) => SubFilterChip(
        label: _label(tier),
        selected: selectedTiers.contains(tier),
        onTap: () => onToggleTier(tier),
      ),
    );
  }
}
