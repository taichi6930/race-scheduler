import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pill.dart';

/// 開催情報が未確定（公式発表前に運用者が推測で先行登録した先の予定）である
/// ことを示す小バッジ。
///
/// タイムライン一覧の行（race_row.dart）とレース詳細シート（race_detail_sheet.dart）
/// の両方から使う共通atom（front-design-layers.md: 塗り+角丸を伴う部品を
/// 複数箇所で再実装しない）。
class UnconfirmedBadge extends StatelessWidget {
  const UnconfirmedBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Tooltip(
      message: '開催情報は未確定です（変更の可能性があります）',
      child: Pill(
        backgroundColor: colors.surface2,
        borderRadius: 5,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.help_outline, size: 11, color: colors.ink3),
            const SizedBox(width: 2),
            Text(
              '未確定',
              style: AppTypography.tabular(
                AppTypography.caption,
              ).copyWith(color: colors.ink3, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
