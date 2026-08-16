import 'package:flutter/material.dart';

/// タップに反応する「塗り + 角丸」のサーフェス（リップル付き）。
///
/// レース行のカード・カレンダーの日セル・詳細シートのリンクチップ／アクション
/// ボタン・お気に入り画面のサブタブなど、「押せる角丸の面」はアプリ全体に
/// 散在しており、以前は各所で `Material(color:, borderRadius:) > InkWell(...)`
/// を個別にベタ書きしていた（同じ見た目のチップが3箇所に別実装されていた原因）。
/// 装飾の指定をこのatomへ一本化する（レイヤー規約は
/// `.claude/docs/front-design-layers.md`、機械チェックは
/// `scripts/check-design-layers.ts`）。
///
/// タップしない純粋な表示用バッジ・タグには [Pill] を使う。
class TappableCard extends StatelessWidget {
  const TappableCard({
    required this.child,
    required this.borderRadius,
    this.color,
    this.border,
    this.padding,
    this.onTap,
    this.onLongPress,
    this.clipBehavior = Clip.none,
    super.key,
  });

  final Widget child;
  final double borderRadius;

  /// サーフェスの塗り。null の場合は透明（枠線のみのボタン等）。
  final Color? color;

  /// 枠線。[Material] は枠線を直接持てないため、内側の [DecoratedBox] で描画する。
  final BoxBorder? border;

  final EdgeInsetsGeometry? padding;

  /// null の場合はタップ不可（リップルも出ない）。
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// 子が角を越えて描画される場合（左端のアクセント帯など）に
  /// [Clip.antiAlias] を指定して角丸で切り抜く。
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    Widget content = child;
    if (padding != null) {
      content = Padding(padding: padding!, child: content);
    }
    if (border != null) {
      content = DecoratedBox(
        decoration: BoxDecoration(borderRadius: radius, border: border),
        child: content,
      );
    }
    return Material(
      color: color ?? Colors.transparent,
      borderRadius: radius,
      clipBehavior: clipBehavior,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: radius,
        child: content,
      ),
    );
  }
}
