import 'dart:async';

import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

/// API失敗時のエラー表示＋再試行ボタン（screens.md §6、QERR-07）。
///
/// 連打による再試行の連続実行を防ぐため、押下後は短時間ボタンを無効化する。
/// 表示され続けたまま2回以上再試行に失敗した場合は、試行回数をメッセージに追加する。
class ErrorRetryCard extends StatefulWidget {
  const ErrorRetryCard({
    required this.onRetry,
    this.message = 'データの取得に失敗しました',
    super.key,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  State<ErrorRetryCard> createState() => _ErrorRetryCardState();
}

class _ErrorRetryCardState extends State<ErrorRetryCard> {
  static const _retryCooldown = Duration(seconds: 2);

  int _attemptCount = 0;
  bool _isCoolingDown = false;
  Timer? _cooldownTimer;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _handleRetry() {
    setState(() {
      _attemptCount++;
      _isCoolingDown = true;
    });
    widget.onRetry();
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer(_retryCooldown, () {
      if (mounted) {
        setState(() => _isCoolingDown = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final message = _attemptCount >= 2
        ? '${widget.message}（$_attemptCount回目、時間をおいて再度お試しください）'
        : widget.message;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message,
                style: AppTypography.body.copyWith(color: colors.ink),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _isCoolingDown ? null : _handleRetry,
                child: const Text('再試行'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
