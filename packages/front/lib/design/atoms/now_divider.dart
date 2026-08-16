import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../tokens.dart';
import '../typography.dart';

/// 過去/未来の境界に挿入する「NOW hh:mm」ピル＋横線（screens.md §1.1-5）。
class NowDivider extends StatelessWidget {
  const NowDivider({required this.now, super.key});

  final DateTime now;

  /// build毎のDateFormat再生成を避けるため使い回す（PERF-128）。
  static final DateFormat _timeFormat = DateFormat('HH:mm');

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: colors.danger.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'NOW ${_timeFormat.format(now)}',
              style: AppTypography.tabular(
                AppTypography.caption,
              ).copyWith(color: colors.danger, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(
              height: 2,
              color: colors.danger.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}
