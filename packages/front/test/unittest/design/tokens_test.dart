// resolveAnimationDuration のデシジョンテーブル
//
// | ID   | disableAnimations | duration              | 期待値                 |
// | ---- | ------------------ | ---------------------- | ----------------------- |
// | T-01 | true                | Duration(ms: 300)      | Duration.zero            |
// | T-02 | false               | Duration(ms: 300)      | Duration(ms: 300)（元の値） |
// | T-03 | true                | Duration.zero           | Duration.zero            |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/tokens.dart';

/// WCAG 2.1 のコントラスト比を計算する（`Color.computeLuminance()` は仕様どおりの
/// 相対輝度を返すため、そのまま比率式 (L1+0.05)/(L2+0.05) に用いてよい）。
double _contrastRatio(Color a, Color b) {
  final lumA = a.computeLuminance();
  final lumB = b.computeLuminance();
  final lighter = lumA > lumB ? lumA : lumB;
  final darker = lumA > lumB ? lumB : lumA;
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  // A11Y-007/008: ink3 が背景色（bg/surface/surface2/surface3）に対して
  // WCAG AA基準（本文サイズ相当 4.5:1）を満たすことを固定するリグレッションテスト。
  //
  // | ID   | テーマ | 背景        | 期待               |
  // | ---- | ------ | ----------- | ------------------ |
  // | T-06 | light  | bg/surface/surface2/surface3 | ink3とのコントラスト比 >= 4.5 |
  // | T-07 | dark   | bg/surface/surface2/surface3 | ink3とのコントラスト比 >= 4.5 |
  group('AppColors.ink3 コントラスト（A11Y-007/008）', () {
    test('[T-06] light テーマのink3が全背景でAA基準(4.5:1)を満たす', () {
      const colors = AppColors.light;
      final backgrounds = [
        colors.bg,
        colors.surface,
        colors.surface2,
        colors.surface3,
      ];

      for (final bg in backgrounds) {
        expect(_contrastRatio(colors.ink3, bg), greaterThanOrEqualTo(4.5));
      }
    });

    test('[T-07] dark テーマのink3が全背景でAA基準(4.5:1)を満たす', () {
      const colors = AppColors.dark;
      final backgrounds = [
        colors.bg,
        colors.surface,
        colors.surface2,
        colors.surface3,
      ];

      for (final bg in backgrounds) {
        expect(_contrastRatio(colors.ink3, bg), greaterThanOrEqualTo(4.5));
      }
    });
  });

  group('resolveAnimationDuration', () {
    test('[T-01] disableAnimationsがtrue_Duration.zeroを返す', () {
      const mediaQuery = MediaQueryData(disableAnimations: true);

      final result = resolveAnimationDuration(
        mediaQuery,
        const Duration(milliseconds: 300),
      );

      expect(result, Duration.zero);
    });

    test('[T-02] disableAnimationsがfalse_元のdurationをそのまま返す', () {
      const mediaQuery = MediaQueryData();
      const duration = Duration(milliseconds: 300);

      final result = resolveAnimationDuration(mediaQuery, duration);

      expect(result, duration);
    });

    test('[T-03] disableAnimationsがtrue_元がDuration.zeroでもDuration.zeroを返す', () {
      const mediaQuery = MediaQueryData(disableAnimations: true);

      final result = resolveAnimationDuration(mediaQuery, Duration.zero);

      expect(result, Duration.zero);
    });
  });

  group('A11yMotionContext.effectiveAnimationDuration', () {
    testWidgets('[T-04] MediaQueryでdisableAnimations=trueを指定_Duration.zeroを返す', (
      tester,
    ) async {
      late Duration result;
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (context) {
              result = context.effectiveAnimationDuration(
                const Duration(milliseconds: 300),
              );
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(result, Duration.zero);
    });

    testWidgets('[T-05] MediaQueryでdisableAnimations=falseを指定_元のdurationを返す', (
      tester,
    ) async {
      late Duration result;
      const duration = Duration(milliseconds: 300);
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(),
          child: Builder(
            builder: (context) {
              result = context.effectiveAnimationDuration(duration);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(result, duration);
    });
  });
}
