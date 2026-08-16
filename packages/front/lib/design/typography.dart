import 'package:flutter/material.dart';

/// アプリのタイプスケール（design-system.md §3）。
///
/// 色は含まない。呼び出し側で `AppTypography.xxx.copyWith(color: context.colors.ink)`
/// のように `context.colors` の色を適用する。
class AppTypography {
  AppTypography._();

  /// Display（明朝）: アプリ名・日付見出し・レース名。
  ///
  /// Web（CanvasKitレンダラー）はOSインストール済みフォントを参照できないため、
  /// `Hiragino Mincho ProN` 等のOS依存フォント名だけを指定すると、Web/PCでのみ
  /// フォールバック描画になり文字が崩れる。全プラットフォームで同一の見た目・
  /// 完全なグリフを保証するため、同梱済みの `Noto Serif JP` を第一候補にする。
  static const TextStyle _displayBase = TextStyle(
    fontFamily: 'Noto Serif JP',
    fontFamilyFallback: ['Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho'],
  );

  /// Body（ゴシック）: 本文・ラベル・ボタン。
  ///
  /// 同梱済みの `Noto Sans JP` を第一候補にする（理由は [_displayBase] 参照）。
  static const TextStyle _bodyBase = TextStyle(
    fontFamily: 'Noto Sans JP',
    fontFamilyFallback: ['Hiragino Kaku Gothic ProN', 'Yu Gothic'],
  );

  /// アプリバーの日付見出し（明朝 19–20 / 600）。
  static final TextStyle appBarDate = _displayBase.copyWith(
    fontSize: 20,
    fontWeight: FontWeight.w600,
  );

  /// Next Race カードのレース名（明朝 24 / 600）。
  static final TextStyle nextRaceName = _displayBase.copyWith(
    fontSize: 24,
    fontWeight: FontWeight.w600,
  );

  /// 詳細シートの見出し（明朝 23 / 600）。
  static final TextStyle sheetHeading = _displayBase.copyWith(
    fontSize: 23,
    fontWeight: FontWeight.w600,
  );

  /// セクションラベル（12 / 700、letter-spacing 広め）。
  static final TextStyle sectionLabel = _bodyBase.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.6,
  );

  /// 本文（14 / 500）。
  static final TextStyle body = _bodyBase.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w500,
  );

  /// 補助本文（13.5 / 400）。
  static final TextStyle bodySmall = _bodyBase.copyWith(
    fontSize: 13.5,
    fontWeight: FontWeight.w400,
  );

  /// キャプション・メタ情報（11 / 600）。
  static final TextStyle caption = _bodyBase.copyWith(
    fontSize: 11,
    fontWeight: FontWeight.w600,
  );

  /// Next Race カードのライブカウントダウン（等幅数字 23 / 800）。
  static final TextStyle countdownLarge = tabular(
    _bodyBase.copyWith(fontSize: 23, fontWeight: FontWeight.w800),
  );

  /// 行内の「あとN分」（等幅数字 14 / 700）。
  static final TextStyle countdownSmall = tabular(
    _bodyBase.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
  );

  /// 発走時刻・距離・レース番号など、桁を揃えたい数値表示に付与する。
  static TextStyle tabular(TextStyle base) =>
      base.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
}
