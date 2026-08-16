import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../domain/entities/race_type.dart';
import '../tokens.dart';

/// 競技（[Discipline]）のON/OFFを切り替えるトグルチップ1枚。
///
/// [DisciplineIcon]（atoms/discipline_icon.dart）は選択状態を持たない静止表示用の
/// アイコンのため、選択中/非選択で見た目が変わる（非選択時は薄く表示する）
/// フィルタ用途にはこちらを使う。
class DisciplineToggleChip extends StatelessWidget {
  const DisciplineToggleChip({
    required this.discipline,
    required this.selected,
    required this.onTap,
    this.size = 44,
    super.key,
  });

  final Discipline discipline;
  final bool selected;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: discipline.label,
      selected: selected,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? colors.ink : colors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? colors.ink : colors.line2),
          ),
          child: Opacity(
            opacity: selected ? 1 : 0.32,
            child: ExcludeSemantics(
              child: Text(
                discipline.emoji,
                style: const TextStyle(fontSize: 16),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
