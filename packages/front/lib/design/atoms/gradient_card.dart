import 'package:flutter/material.dart';

import '../tokens.dart';

/// 1色を基準にグラデーションと影を付けたヒーローカード（「次のレース」カード）。
///
/// 呼び出し側はグレード階層の色（[baseColor]）だけを渡し、そこから左上→右下の
/// グラデーション（同色→28%黒寄せ）と落ち影を作る配合はこのatomが持つ。
/// 配合を呼び出し側に散らすと、同じヒーロー表現を別画面で作るときに
/// 微妙に違う値で再実装される（本atom新設の経緯となった問題）ため。
class GradientCard extends StatelessWidget {
  const GradientCard({
    required this.child,
    required this.baseColor,
    this.borderRadius = 18,
    this.padding = const EdgeInsets.fromLTRB(16, 14, 16, 14),
    super.key,
  });

  final Widget child;

  /// グラデーションの基準色（明るい側）。
  final Color baseColor;

  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [baseColor, Color.lerp(baseColor, Colors.black, 0.28)!],
        ),
        boxShadow: [
          BoxShadow(
            color: colors.ink.withValues(alpha: 0.16),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}
