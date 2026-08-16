import 'package:flutter/material.dart';

import '../domain/entities/japanese_holiday.dart';
import 'tokens.dart';

/// [date]の曜日・祝日に応じた強調色を返す（design-system.md準拠の配色ルール）。
///
/// - 日曜日・祝日: [AppColors.danger]（赤）
/// - 土曜日（祝日を除く）: [AppColors.saturday]（青）
/// - それ以外の平日: null（呼び出し側の既定色をそのまま使うことを示す）
///
/// 祝日判定を優先する（[isJapaneseHoliday]）ため、祝日が土曜日と重なった
/// 場合も赤になる。
Color? weekdayAccentColor(AppColors colors, DateTime date) {
  if (date.weekday == DateTime.sunday || isJapaneseHoliday(date)) {
    return colors.danger;
  }
  if (date.weekday == DateTime.saturday) {
    return colors.saturday;
  }
  return null;
}
