import 'package:flutter/material.dart';

import '../tokens.dart';

/// 「サーフェスカード」共通コンテナ（背景色・角丸14・枠線という装飾を
/// settings_rows.dart/whats_new_screen.dart/trip_group_detail_screen.dart/
/// trip_groups_screen.dart で個別にベタ書きしていたものを統合）。
class SurfaceCard extends StatelessWidget {
  const SurfaceCard({
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    this.margin,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.line),
      ),
      child: child,
    );
  }
}
