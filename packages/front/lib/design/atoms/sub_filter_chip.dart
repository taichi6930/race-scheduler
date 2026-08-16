import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';
import '../typography.dart';

/// タイムライン画面のセッション内フィルタ（競走場・競馬種別・階層・重賞のみ・
/// お気に入り）が共通で使う選択可能チップ1枚（PERF-125: 複数箇所に同一実装が
/// コピペされていたものを集約）。
class SubFilterChip extends StatelessWidget {
  const SubFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.semanticLabel,
    super.key,
  });

  final String label;

  /// スクリーンリーダー向けの読み上げラベル。★/☆等の記号を含む[label]を
  /// そのまま読み上げると不安定なため、省略時以外はこちらを優先する
  /// （A11Y-028）。
  final String? semanticLabel;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: semanticLabel ?? label,
      selected: selected,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          height: context.scaledChipHeight(44),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? colors.brand : colors.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: selected ? colors.brand : colors.line2),
          ),
          child: ExcludeSemantics(
            child: Text(
              label,
              // 高さを固定している都合上、折り返すと文字が上下に見切れる。
              // 「全期間」のような2語以上のラベルでも1行で描画する
              // （timeline_screen の表示モード切替チップを統合した際に
              // そちら側が持っていた挙動を取り込んだもの）。
              softWrap: false,
              overflow: TextOverflow.visible,
              style: AppTypography.bodySmall.copyWith(
                color: selected ? Colors.white : colors.ink2,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
