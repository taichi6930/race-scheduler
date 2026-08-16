import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'favorite_ids_provider.dart';

/// お気に入りの登録／解除をハプティックフィードバック付きで切り替える。
///
/// 新規登録（OFF→ON）の場合のみ、取り消し可能なSnackBarを表示する
/// （UX-027・UX-044）。解除の場合は★ボタン自体の見た目変化で
/// 十分伝わるため表示しない。
///
/// QSTATE-02: 永続化はデバウンスされ非同期に完了する（PERF-112）ため、
/// timeline_filter_feedback.dart（QERR-11）と同じパターンで、失敗した
/// 場合のみ後追いでSnackBarを出す（登録直後の成功SnackBarはそれとは別に
/// 即座に表示する。ここまで待って出すと連打時の反応が遅く見えるため）。
void toggleFavoriteWithFeedback(
  BuildContext context,
  WidgetRef ref,
  String raceId,
) {
  final wasFavorite = ref.read(favoriteIdsProvider).contains(raceId);
  HapticFeedback.selectionClick();
  final saveResult = ref.read(favoriteIdsProvider.notifier).toggle(raceId);
  unawaited(
    saveResult.then((succeeded) {
      if (succeeded || !context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('お気に入りの保存に失敗しました')));
    }),
  );
  if (wasFavorite) return;

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: const Text('お気に入りに登録しました'),
      action: SnackBarAction(
        label: '取り消す',
        onPressed: () => ref.read(favoriteIdsProvider.notifier).toggle(raceId),
      ),
    ),
  );
}
