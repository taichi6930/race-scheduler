import 'package:flutter/material.dart';

/// AppBarに置く手動更新ボタン（各画面共通）。
///
/// キャッシュTTL（[scheduleTtlInvalidate]）が切れる前でも、押した時点で
/// 最新のデータへ即座に更新したい場合に使う。
class RefreshIconButton extends StatelessWidget {
  const RefreshIconButton({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '更新',
      child: IconButton(
        onPressed: onPressed,
        icon: const Icon(Icons.refresh),
        tooltip: '更新',
      ),
    );
  }
}
