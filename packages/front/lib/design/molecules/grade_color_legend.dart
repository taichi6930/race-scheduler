import 'package:flutter/material.dart';

import '../atoms/color_dot.dart';
import '../google_calendar_colors.dart';
import '../tokens.dart';
import '../typography.dart';

/// グレード色（Google Calendar配色）の凡例（design-system.md §2.2）。
///
/// タイムライン・カレンダーの両画面で、色のみに依存せず「色→重要度」の
/// 対応を明示するために共通利用する（A11Y-030）。ドット自体は隣接するテキスト
/// と重複する装飾情報のため、スクリーンリーダーには除外して1項目ずつの
/// テキストのみを読み上げさせる。
class GradeColorLegend extends StatelessWidget {
  const GradeColorLegend({super.key});

  static const _entries = [
    (GoogleCalendarColorKey.blueberry, 'GⅠ/SG/GP'),
    (GoogleCalendarColorKey.tomato, 'GⅡ/G1'),
    (GoogleCalendarColorKey.basil, 'GⅢ/G2'),
    (GoogleCalendarColorKey.banana, 'G3/OP'),
    (GoogleCalendarColorKey.graphite, '無印'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    Widget dot(Color color, String label) => Semantics(
      label: label,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: ColorDot(color: color)),
          const SizedBox(width: 5),
          ExcludeSemantics(
            child: Text(
              label,
              style: AppTypography.caption.copyWith(color: colors.ink3),
            ),
          ),
        ],
      ),
    );

    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: 'グレード配色の凡例',
      child: Wrap(
        spacing: 14,
        runSpacing: 8,
        children: [
          for (final (colorKey, label) in _entries)
            dot(GoogleCalendarPalette.background[colorKey]!, label),
        ],
      ),
    );
  }
}
