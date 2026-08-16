import 'dart:async';

import 'package:flutter/material.dart';

/// フィルタ条件の永続化に失敗した場合のみSnackBarで知らせる（QERR-11）。
///
/// 絞り込みの効果自体はレース一覧に即座に反映されるため、設定画面のトグル
/// （FEDGE-04）と異なり成功時のSnackBarは表示しない（他の見た目の変化で
/// 十分に伝わるため）。ただし永続化に失敗すると次回起動時に黙って元の条件
/// へ戻ってしまい気づけないため、失敗のみ必ず知らせる。
void reportTimelineFilterPersistFailure(
  BuildContext context,
  Future<bool> result,
) {
  unawaited(
    result.then((succeeded) {
      if (succeeded || !context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('絞り込み条件の保存に失敗しました')));
    }),
  );
}
