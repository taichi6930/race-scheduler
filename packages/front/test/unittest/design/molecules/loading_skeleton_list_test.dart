// LoadingSkeletonList のアクセシビリティに関するデシジョンテーブル（A11Y-034）
//
// | ID   | 条件     | 期待                                                |
// | ---- | -------- | ------------------------------------------------------ |
// | T-01 | 通常描画 | 「読み込み中」がSemanticsラベルとして読み上げられる |
//
// シマーアニメーション（UX-043）のデシジョンテーブル
//
// | ID   | disableAnimations | 期待                              |
// | ---- | ------------------ | --------------------------------- |
// | T-02 | false               | Shimmerのenabledがtrue           |
// | T-03 | true                | Shimmerのenabledがfalse（停止）  |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/loading_skeleton_list.dart';
import 'package:shimmer/shimmer.dart';

void main() {
  testWidgets('[T-01] 通常描画_読み込み中がSemanticsラベルとして読み上げられる', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(body: LoadingSkeletonList()),
      ),
    );

    expect(find.bySemanticsLabel('読み込み中'), findsOneWidget);
  });

  testWidgets('[T-02] disableAnimationsがfalse_Shimmerのenabledがtrue', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const MediaQuery(
          data: MediaQueryData(),
          child: Scaffold(body: LoadingSkeletonList()),
        ),
      ),
    );

    final shimmer = tester.widget<Shimmer>(find.byType(Shimmer));
    expect(shimmer.enabled, isTrue);
  });

  testWidgets('[T-03] disableAnimationsがtrue_Shimmerのenabledがfalse', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: Scaffold(body: LoadingSkeletonList()),
        ),
      ),
    );

    final shimmer = tester.widget<Shimmer>(find.byType(Shimmer));
    expect(shimmer.enabled, isFalse);
  });
}
