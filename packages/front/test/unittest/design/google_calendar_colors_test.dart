// GoogleCalendarPalette のコントラスト比 デシジョンテーブル（A11Y-010）
//
// 「AA基準は満たすがレンダリング次第で体感不足の可能性」という指摘に対し、
// 自動コントラスト検証で実際のコントラスト比を裏取りする。
//
// | ID   | 条件                                          | 期待                                          |
// | ---- | --------------------------------------------- | ---------------------------------------------- |
// | T-01 | 全11色の background/foreground ペア           | 全てWCAG AA基準（通常テキスト4.5:1）以上を満たす |
// | T-02 | grape（白文字）の実測コントラスト比           | 4.5以上                                        |
// | T-03 | lavender（ink文字）の実測コントラスト比       | 4.5以上                                        |

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/google_calendar_colors.dart';

/// WCAG 2.1 の相対輝度計算式（sRGB各チャンネルをlinearize後、加重和）。
/// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
double _relativeLuminance(Color color) {
  double linearize(double channel) {
    return channel <= 0.03928
        ? channel / 12.92
        : math.pow((channel + 0.055) / 1.055, 2.4).toDouble();
  }

  final r = linearize(color.r);
  final g = linearize(color.g);
  final b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// WCAG 2.1 のコントラスト比計算式:
/// (L1 + 0.05) / (L2 + 0.05)（L1が明るい方の相対輝度）
/// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
double _contrastRatio(Color a, Color b) {
  final la = _relativeLuminance(a);
  final lb = _relativeLuminance(b);
  final lighter = la > lb ? la : lb;
  final darker = la > lb ? lb : la;
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  const wcagAaNormalTextThreshold = 4.5;

  test('[T-01] 全11色のbackground/foregroundペアがWCAG AA基準(4.5:1)以上を満たす', () {
    for (final key in GoogleCalendarColorKey.values) {
      final background = GoogleCalendarPalette.background[key]!;
      final foreground = GoogleCalendarPalette.foreground[key]!;
      final ratio = _contrastRatio(background, foreground);

      expect(
        ratio,
        greaterThanOrEqualTo(wcagAaNormalTextThreshold),
        reason:
            '$key: background=$background, foreground=$foreground, '
            'ratio=${ratio.toStringAsFixed(2)} が AA基準未達',
      );
    }
  });

  test('[T-02] grape（白文字）の実測コントラスト比が4.5以上', () {
    final ratio = _contrastRatio(
      GoogleCalendarPalette.background[GoogleCalendarColorKey.grape]!,
      GoogleCalendarPalette.foreground[GoogleCalendarColorKey.grape]!,
    );

    expect(ratio, greaterThanOrEqualTo(wcagAaNormalTextThreshold));
  });

  test('[T-03] lavender（ink文字）の実測コントラスト比が4.5以上', () {
    final ratio = _contrastRatio(
      GoogleCalendarPalette.background[GoogleCalendarColorKey.lavender]!,
      GoogleCalendarPalette.foreground[GoogleCalendarColorKey.lavender]!,
    );

    expect(ratio, greaterThanOrEqualTo(wcagAaNormalTextThreshold));
  });
}
