import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../atoms/pill.dart';
import '../tokens.dart';

/// レース行のローディングスケルトン（`shimmer`、screens.md §6）。
class LoadingSkeletonList extends StatelessWidget {
  const LoadingSkeletonList({this.itemCount = 8, super.key});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // PERF-129: 全行が見た目上完全に同一なため、itemBuilderで毎回新規構築せず
    // 1つのWidgetインスタンスを構築して全indexで使い回す
    // （Widgetはimmutableなため同一インスタンスの再利用は安全）。
    final row = Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: ExcludeSemantics(
        child: Pill(
          height: 62,
          borderRadius: 14,
          backgroundColor: colors.surface2,
          padding: EdgeInsets.zero,
          child: const SizedBox.expand(),
        ),
      ),
    );
    // UX-043: シマーアニメーションの速度を既定(1500ms)よりやや緩やかにし、
    // 「視差効果を減らす」設定（reduced motion）時はアニメーションを停止する
    // （他のアニメーション実装と同じ MediaQuery.disableAnimations 連動、A11Y-032）。
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return Semantics(
      label: '読み込み中',
      liveRegion: true,
      child: Shimmer.fromColors(
        baseColor: colors.surface2,
        highlightColor: colors.surface,
        period: const Duration(milliseconds: 1800),
        enabled: !reduceMotion,
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          itemCount: itemCount,
          itemBuilder: (context, index) => row,
        ),
      ),
    );
  }
}
