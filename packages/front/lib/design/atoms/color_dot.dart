import 'package:flutter/material.dart';

/// 色そのものが情報を持つ小さなドット（グレード配色の凡例・カレンダーの開催マーカー）。
///
/// ドット自体は隣接するテキストと重複する装飾情報であることが多いため、
/// スクリーンリーダーからの除外（[ExcludeSemantics]）は呼び出し側の責務とする
/// （凡例では「色＋ラベル」で1項目、カレンダーではセル全体で1項目として
/// 読み上げたいなど、まとめ方が文脈によって異なるため）。
class ColorDot extends StatelessWidget {
  const ColorDot({
    required this.color,
    this.size = 10,
    this.borderRadius = 3,
    super.key,
  });

  final Color color;
  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}
