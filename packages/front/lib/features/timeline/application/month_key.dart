import '../../../core/jst_time.dart';

/// 月キー（`yyyy-MM`）を組み立てる。
String monthKeyOf(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$year-$month';
}

({int year, int month}) _parseMonthKey(String monthKey) {
  final parts = monthKey.split('-');
  return (year: int.parse(parts[0]), month: int.parse(parts[1]));
}

/// [monthKey] から [offset] ヶ月ずらした月キーを返す（負値で過去方向）。
String offsetMonthKey(String monthKey, int offset) {
  final parsed = _parseMonthKey(monthKey);
  final totalMonths = parsed.year * 12 + (parsed.month - 1) + offset;
  final year = totalMonths ~/ 12;
  final month = totalMonths % 12 + 1;
  return monthKeyOf(DateTime(year, month));
}

/// [monthKey] の月初・月末を API 用の日付文字列（`yyyy-MM-dd`）で返す。
(String start, String finish) monthDateRange(String monthKey) {
  final parsed = _parseMonthKey(monthKey);
  final firstDay = DateTime(parsed.year, parsed.month);
  final lastDay = DateTime(parsed.year, parsed.month + 1, 0);
  return (formatDateForApi(firstDay), formatDateForApi(lastDay));
}
