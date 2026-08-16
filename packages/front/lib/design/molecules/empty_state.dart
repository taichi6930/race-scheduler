import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

/// 空状態（フィルタ結果0件・お気に入り未登録など）の共通表示。
///
/// QEMP-01: [action] は任意の回復導線（「タイムラインを見る」ボタン等）を
/// 差し込むための拡張ポイント。指定しなければ従来どおりアイコン＋文言のみ。
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.message,
    this.action,
    super.key,
  });

  final String icon;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
      child: Column(
        children: [
          ExcludeSemantics(
            child: Text(
              icon,
              style: TextStyle(
                fontSize: 40,
                color: colors.ink3.withValues(alpha: 0.6),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall.copyWith(color: colors.ink3),
          ),
          if (action case final action?) ...[
            const SizedBox(height: 12),
            action,
          ],
        ],
      ),
    );
  }
}
