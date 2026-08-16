import 'package:flutter/material.dart';

/// 塗り + 角丸を持つ小片（バッジ・タグ・セグメント等）の共通コンテナ。
///
/// グレードバッジ・レース番号・注目選手バッジ・設定画面のアイコンバッジなど、
/// 「短いラベルを塗りつぶした角丸の箱に入れる」表現はアプリ全体に散在しており、
/// 以前は各所で `Container(decoration: BoxDecoration(...))` を個別にベタ書き
/// していた。同じ見た目が何度も再実装されるのを防ぐため、装飾の指定を
/// このatomへ一本化する（レイヤー規約は `.claude/docs/front-design-layers.md`、
/// 機械チェックは `scripts/check-design-layers.ts`）。
///
/// タップに反応させたい場合はこのatomではなく [TappableCard] を使う
/// （こちらはInkWellのリップルを持たない純粋な表示用）。
class Pill extends StatelessWidget {
  const Pill({
    required this.child,
    this.backgroundColor,
    this.borderRadius = 6,
    this.border,
    this.padding = const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
    this.width,
    this.height,
    this.alignment,
    super.key,
  });

  final Widget child;

  /// 背景色。null の場合は塗りなし（枠線のみ、または領域確保のみ）。
  final Color? backgroundColor;

  final double borderRadius;
  final BoxBorder? border;
  final EdgeInsetsGeometry padding;

  /// 正方形バッジ等、内容に依らずサイズを固定したい場合に指定する。
  final double? width;
  final double? height;
  final AlignmentGeometry? alignment;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      alignment: alignment,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border,
      ),
      child: child,
    );
  }
}
