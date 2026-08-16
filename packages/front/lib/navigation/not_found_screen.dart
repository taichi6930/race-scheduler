import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/tokens.dart';
import '../design/typography.dart';
import '../design/molecules/empty_state.dart';

/// 存在しないパスへアクセスした際のエラー画面（NAV-02）。
///
/// go_router の `errorBuilder` 未設定時は技術的なデフォルトエラーページ
/// （`Exception`のスタックトレース等）がそのまま表示されるため、アプリの
/// デザインに沿った画面で置き換える。
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          'ページが見つかりません',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const EmptyState(
                icon: '🔍',
                message: 'お探しのページが見つかりませんでした',
              ),
              FilledButton(
                onPressed: () => context.go('/timeline'),
                child: const Text('タイムラインへ戻る'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
