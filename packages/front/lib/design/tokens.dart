import 'package:flutter/material.dart';

/// アプリ全体のカラートークン（design-system.md §2）。
///
/// ニュートラルは緑みを帯びた紙色。グレード別の色は Google Calendar 配色を
/// そのまま踏襲するため [GoogleCalendarPalette]（`google_calendar_colors.dart`）
/// を直接参照する（テーマの明暗によらず固定色）。個別ウィジェットは
/// 生の `Color(0x...)` を書かず、必ずこのトークン（`context.colors`）経由で参照する。
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.surface3,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.line,
    required this.line2,
    required this.brand,
    required this.brandInk,
    required this.danger,
    required this.saturday,
    required this.favorite,
    required this.favoriteText,
  });

  final Color bg;
  final Color surface;
  final Color surface2;
  final Color surface3;
  final Color ink;
  final Color ink2;
  final Color ink3;
  final Color line;
  final Color line2;
  final Color brand;
  final Color brandInk;

  /// 日曜表示・祝日表示・エラー・現在時刻ラインなど、グレードとは無関係な赤系アクセント。
  final Color danger;

  /// 土曜表示など、グレードとは無関係な青系アクセント。
  final Color saturday;

  /// お気に入り★・通知ONハイライトなど、グレードとは無関係な金系アクセント。
  final Color favorite;
  final Color favoriteText;

  static const light = AppColors(
    bg: Color(0xFFEBEEE9),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFF1F3EF),
    surface3: Color(0xFFE7EAE4),
    ink: Color(0xFF171B18),
    ink2: Color(0xFF4A524C),
    // A11Y-007: WCAG AA(4.5:1)未達（旧 0xFF8A928B は bg 背景で約2.7:1）だったため暗色化
    ink3: Color(0xFF646A65),
    line: Color(0xFFE4E7E0),
    line2: Color(0xFFD4D9CE),
    brand: Color(0xFF1E6E4C),
    brandInk: Color(0xFF0E4A31),
    danger: Color(0xFFD50000),
    saturday: Color(0xFF1565C0),
    favorite: Color(0xFFF6BF26),
    favoriteText: Color(0xFF4A3A00),
  );

  static const dark = AppColors(
    bg: Color(0xFF0C100D),
    surface: Color(0xFF161C18),
    surface2: Color(0xFF1D2420),
    surface3: Color(0xFF252D27),
    ink: Color(0xFFE9EFE9),
    ink2: Color(0xFFA6AFA8),
    // A11Y-008: WCAG AA(4.5:1)未達（旧 0xFF727C74 は surface3 背景で約3.3:1）だったため明色化
    ink3: Color(0xFF8E9A90),
    line: Color(0xFF28312B),
    line2: Color(0xFF39463C),
    brand: Color(0xFF52B487),
    brandInk: Color(0xFF8FD3B2),
    danger: Color(0xFFFF5A5A),
    saturday: Color(0xFF64B5F6),
    favorite: Color(0xFFF6C544),
    favoriteText: Color(0xFF2A2100),
  );

  @override
  AppColors copyWith({
    Color? bg,
    Color? surface,
    Color? surface2,
    Color? surface3,
    Color? ink,
    Color? ink2,
    Color? ink3,
    Color? line,
    Color? line2,
    Color? brand,
    Color? brandInk,
    Color? danger,
    Color? saturday,
    Color? favorite,
    Color? favoriteText,
  }) {
    return AppColors(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      surface2: surface2 ?? this.surface2,
      surface3: surface3 ?? this.surface3,
      ink: ink ?? this.ink,
      ink2: ink2 ?? this.ink2,
      ink3: ink3 ?? this.ink3,
      line: line ?? this.line,
      line2: line2 ?? this.line2,
      brand: brand ?? this.brand,
      brandInk: brandInk ?? this.brandInk,
      danger: danger ?? this.danger,
      saturday: saturday ?? this.saturday,
      favorite: favorite ?? this.favorite,
      favoriteText: favoriteText ?? this.favoriteText,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surface3: Color.lerp(surface3, other.surface3, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      ink2: Color.lerp(ink2, other.ink2, t)!,
      ink3: Color.lerp(ink3, other.ink3, t)!,
      line: Color.lerp(line, other.line, t)!,
      line2: Color.lerp(line2, other.line2, t)!,
      brand: Color.lerp(brand, other.brand, t)!,
      brandInk: Color.lerp(brandInk, other.brandInk, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      saturday: Color.lerp(saturday, other.saturday, t)!,
      favorite: Color.lerp(favorite, other.favorite, t)!,
      favoriteText: Color.lerp(favoriteText, other.favoriteText, t)!,
    );
  }
}

/// `context.colors` で [AppColors] トークンに直接アクセスするための拡張。
extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}

/// テキストスケール設定に応じて固定高さを拡大するための拡張（A11Y-018）。
///
/// チップ等の固定`height`は、ユーザーが文字サイズを拡大した場合にラベルが
/// クリップされる可能性がある。`textScaler`に応じて[base]を拡大することで、
/// 見た目の変化を最小限にしつつ拡大時のクリップを避ける（上限は極端な
/// レイアウト崩れを防ぐため1.5倍にクランプ）。
extension A11ySizingContext on BuildContext {
  double scaledChipHeight(double base) {
    final scale = MediaQuery.textScalerOf(this).scale(1);
    return base * scale.clamp(1.0, 1.5);
  }
}

/// OS の「視差効果を減らす」「アニメーション削減」設定（reduced motion）に
/// 連動したアニメーション時間を求める（A11Y-032）。
///
/// [MediaQueryData.disableAnimations] が有効な場合は [Duration.zero] を返し、
/// スクロールアニメーション等を実質的にスキップさせる。無効時は [duration] を
/// そのまま返すため、既存の挙動・既存テスト（固定の `pump` 時間を前提にする
/// もの等）には影響しない。
///
/// [BuildContext] を直接使わず [MediaQueryData] を受け取る設計にしているのは、
/// 単体テストで `MediaQueryData(disableAnimations: true)` を組み立てるだけで
/// 検証でき、`WidgetTester` を介したビルドが不要になるため。
Duration resolveAnimationDuration(
  MediaQueryData mediaQuery,
  Duration duration,
) {
  return mediaQuery.disableAnimations ? Duration.zero : duration;
}

/// `context.effectiveAnimationDuration(duration)` で
/// [resolveAnimationDuration] に直接アクセスするための拡張。
extension A11yMotionContext on BuildContext {
  Duration effectiveAnimationDuration(Duration duration) {
    return resolveAnimationDuration(MediaQuery.of(this), duration);
  }
}
