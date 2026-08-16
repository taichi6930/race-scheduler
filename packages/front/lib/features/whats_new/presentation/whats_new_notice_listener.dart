import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/whats_new_notice_provider.dart';

/// アプリ起動直後、新しいリリースがあればSnackBarでお知らせするラッパー
/// ウィジェット（FR-04）。[AppShell] に1度だけ組み込む想定。
///
/// [child] をそのまま描画しつつ、初回ビルド後（`addPostFrameCallback`）に
/// 一度だけ [whatsNewNoticeProvider] を確認する。`initState` は
/// [StatefulWidget] のライフサイクル上1回しか呼ばれないため、以後の
/// リビルド（タブ切替・テーマ変更等）で重複表示されることはない。
class WhatsNewNoticeListener extends ConsumerStatefulWidget {
  const WhatsNewNoticeListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<WhatsNewNoticeListener> createState() =>
      _WhatsNewNoticeListenerState();
}

class _WhatsNewNoticeListenerState
    extends ConsumerState<WhatsNewNoticeListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkNotice());
  }

  // [whatsNewNoticeProvider] は内部でGitHub API呼び出しの失敗を吸収し、
  // 常に `bool` を返す設計のため（NFR-01）、ここでは追加の try/catch を
  // 持たない（例外の握り潰しどころが重複して分かりにくくなるのを避ける）。
  Future<void> _checkNotice() async {
    final shouldNotify = await ref.read(whatsNewNoticeProvider.future);
    if (!mounted || !shouldNotify) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('新しい更新内容があります'),
        action: SnackBarAction(
          label: '見る',
          onPressed: () => context.push('/whats-new'),
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
