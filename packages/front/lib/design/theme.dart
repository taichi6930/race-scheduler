import 'package:flutter/material.dart';

import 'tokens.dart';
import 'typography.dart';

/// アプリの `ThemeData` を組み立てる（design-system.md §6）。
///
/// Material のデフォルト青は使わず、[AppColors] の `brand`（緑）を基準にする。
/// 個別ウィジェットは `Theme.of(context).extension<AppColors>()`
/// （`context.colors`）経由でのみ色を参照し、生の `Color(0x...)` を書かない。
class AppTheme {
  AppTheme._();

  // PERF-130: ColorScheme.fromSeed の HCT 色計算を含む _build は入力が不変
  // （AppColors.light/dark は定数）のため、呼び出しのたびに再計算せず一度だけ
  // 構築してキャッシュする。
  static final ThemeData _light = _build(AppColors.light, Brightness.light);
  static final ThemeData _dark = _build(AppColors.dark, Brightness.dark);

  static ThemeData light() => _light;

  static ThemeData dark() => _dark;

  static ThemeData _build(AppColors colors, Brightness brightness) {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: colors.brand,
          brightness: brightness,
        ).copyWith(
          primary: colors.brand,
          onPrimary: Colors.white,
          surface: colors.surface,
          onSurface: colors.ink,
          error: colors.danger,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: colors.bg,
      colorScheme: colorScheme,
      // `AppTypography` を使わない素の `TextStyle` にも同梱フォントを適用する
      // （Web の CanvasKit はOSインストール済みフォントを参照できないため、
      // アプリ全体の既定フォントを同梱済みの Noto Sans JP にする必要がある）。
      fontFamily: 'Noto Sans JP',
      fontFamilyFallback: const ['Hiragino Kaku Gothic ProN', 'Yu Gothic'],
      extensions: [colors],
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: colors.surface,
        foregroundColor: colors.ink,
        centerTitle: false,
        titleTextStyle: AppTypography.appBarDate.copyWith(color: colors.ink),
      ),
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: colors.line),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colors.surface2,
        selectedColor: colors.brand,
        shape: const StadiumBorder(),
        side: BorderSide(color: colors.line2),
        labelStyle: AppTypography.bodySmall.copyWith(color: colors.ink2),
        showCheckmark: false,
      ),
      dividerTheme: DividerThemeData(
        color: colors.line,
        thickness: 1,
        space: 1,
      ),
      textTheme: TextTheme(
        titleLarge: AppTypography.appBarDate.copyWith(color: colors.ink),
        bodyMedium: AppTypography.body.copyWith(color: colors.ink),
        bodySmall: AppTypography.caption.copyWith(color: colors.ink3),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surface,
        indicatorColor: colors.brand.withValues(alpha: 0.14),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return AppTypography.caption.copyWith(
            color: selected ? colors.brand : colors.ink3,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? colors.brand : colors.ink3);
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: colors.surface,
        selectedIconTheme: IconThemeData(color: colors.brand),
        unselectedIconTheme: IconThemeData(color: colors.ink3),
        selectedLabelTextStyle: AppTypography.caption.copyWith(
          color: colors.brand,
        ),
        unselectedLabelTextStyle: AppTypography.caption.copyWith(
          color: colors.ink3,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
      ),
    );
  }
}
