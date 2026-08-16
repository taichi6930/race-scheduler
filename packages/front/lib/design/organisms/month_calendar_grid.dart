import 'package:flutter/material.dart';

import '../atoms/color_dot.dart';
import '../atoms/tappable_card.dart';
import '../google_calendar_colors.dart';
import '../tokens.dart';
import '../typography.dart';
import '../weekday_colors.dart';

const _dowLabels = ['日', '月', '火', '水', '木', '金', '土'];

/// 月カレンダーグリッド（7列×最大6行、screens.md §2）。
///
/// 重賞がある日を、その日の最上位グレードの Google Calendar 配色ドットで
/// マークする。
class MonthCalendarGrid extends StatelessWidget {
  const MonthCalendarGrid({
    required this.month,
    required this.markers,
    required this.selectedDay,
    required this.onSelectDay,
    this.onLongPressDay,
    super.key,
  });

  /// 表示対象の月（月初日）。
  final DateTime month;

  /// 日付(1〜末日) → その日の最上位グレードの Google Calendar 色キー。
  final Map<int, GoogleCalendarColorKey> markers;

  /// 選択中の日（未選択は null）。
  final int? selectedDay;

  final ValueChanged<int> onSelectDay;

  /// 日セルの長押し（UX-010: その日の件数プレビュー表示用）。省略時は無効。
  final ValueChanged<int>? onLongPressDay;

  /// セル間の間隔（旧 GridView の mainAxisSpacing / crossAxisSpacing 相当）。
  static const double _spacing = 4;

  /// 7列（データ）+ 6列（間隔用スペーサー）の計13列。
  ///
  /// [SliverGridDelegateWithFixedCrossAxisCount] と同じ列幅配分になるよう、
  /// データ列は等分の [FlexColumnWidth]、間隔列は固定幅 [FixedColumnWidth]
  /// にしている（間隔列の合計幅を差し引いた残りを7等分する点まで同一）。
  static const Map<int, TableColumnWidth> _columnWidths = {
    0: FlexColumnWidth(),
    1: FixedColumnWidth(_spacing),
    2: FlexColumnWidth(),
    3: FixedColumnWidth(_spacing),
    4: FlexColumnWidth(),
    5: FixedColumnWidth(_spacing),
    6: FlexColumnWidth(),
    7: FixedColumnWidth(_spacing),
    8: FlexColumnWidth(),
    9: FixedColumnWidth(_spacing),
    10: FlexColumnWidth(),
    11: FixedColumnWidth(_spacing),
    12: FlexColumnWidth(),
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // DateTime.weekday: Mon=1...Sun=7。日曜始まりの週にするため Sun=0 に補正。
    final leadingBlanks = DateTime(month.year, month.month, 1).weekday % 7;
    final weekCount = ((leadingBlanks + daysInMonth) / 7).ceil();

    return Column(
      children: [
        Row(
          children: [
            for (var i = 0; i < 7; i++)
              Expanded(
                child: Center(
                  child: Text(
                    _dowLabels[i],
                    style: AppTypography.caption.copyWith(
                      color: i == 0
                          ? colors.danger
                          : i == 6
                          ? colors.saturday
                          : colors.ink3,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Table(
          columnWidths: _columnWidths,
          children: [
            for (var week = 0; week < weekCount; week++) ...[
              if (week > 0) _spacerRow,
              _buildWeekRow(week, leadingBlanks, daysInMonth),
            ],
          ],
        ),
      ],
    );
  }

  /// 週と週の間の縦方向の間隔（mainAxisSpacing相当）を表す空行。
  static final TableRow _spacerRow = TableRow(
    children: List.generate(
      _columnWidths.length,
      (_) => const SizedBox(height: _spacing),
    ),
  );

  /// 1週分（7セル + セル間スペーサー6個 = 計13セル）の行を組み立てる。
  TableRow _buildWeekRow(int week, int leadingBlanks, int daysInMonth) {
    return TableRow(
      children: [
        for (var col = 0; col < 7; col++) ...[
          _buildDataCell(week, col, leadingBlanks, daysInMonth),
          if (col < 6) const SizedBox.shrink(),
        ],
      ],
    );
  }

  /// 日付セル1個分。前後の空白（月初の曜日合わせ・月末以降）は空セルにする。
  ///
  /// [AspectRatio] で正方形に固定するのは、[SliverGridDelegateWithFixedCrossAxisCount]
  /// の既定 childAspectRatio(1.0) と同じ「幅=高さ」のセルサイズを再現するため。
  Widget _buildDataCell(int week, int col, int leadingBlanks, int daysInMonth) {
    final index = week * 7 + col;
    if (index < leadingBlanks) return const SizedBox.shrink();
    final day = index - leadingBlanks + 1;
    if (day > daysInMonth) return const SizedBox.shrink();
    return AspectRatio(
      aspectRatio: 1,
      child: _DayCell(
        date: DateTime(month.year, month.month, day),
        colorKey: markers[day],
        selected: selectedDay == day,
        onTap: () => onSelectDay(day),
        onLongPress: onLongPressDay == null ? null : () => onLongPressDay!(day),
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.colorKey,
    required this.selected,
    required this.onTap,
    this.onLongPress,
  });

  final DateTime date;
  final GoogleCalendarColorKey? colorKey;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final day = date.day;
    return Semantics(
      button: true,
      selected: selected,
      label: colorKey == null ? '$day日' : '$day日、重賞開催あり',
      child: TappableCard(
        borderRadius: 11,
        color: selected ? colors.brand : colors.surface,
        border: Border.all(color: selected ? colors.brand : colors.line),
        onTap: onTap,
        onLongPress: onLongPress,
        child: Align(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 日付の数字自体は、親のSemantics(label:'$day日...')と重複する
              // 情報のため、スクリーンリーダーには除外する（二重読み上げ防止）。
              ExcludeSemantics(
                child: Text(
                  '$day',
                  style: AppTypography.tabular(AppTypography.bodySmall)
                      .copyWith(
                        color: selected
                            ? Colors.white
                            : weekdayAccentColor(colors, date) ?? colors.ink2,
                        fontWeight: colorKey != null
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                ),
              ),
              const SizedBox(height: 2),
              SizedBox(
                height: 5,
                child: colorKey == null
                    ? null
                    : ColorDot(
                        size: 5,
                        color: selected
                            ? Colors.white
                            : GoogleCalendarPalette.background[colorKey!]!,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
