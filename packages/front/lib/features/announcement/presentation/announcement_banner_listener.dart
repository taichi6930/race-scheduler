import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../application/announcement_provider.dart';

/// Server-Driven UI PoC: 起動時、api（`GET /ui/announcement`）から取得した
/// お知らせがあればSnackBarで表示するラッパーウィジェット。
///
/// [WhatsNewNoticeListener]（新バージョンお知らせ）とは別軸の仕組みで、
/// こちらは「front を再デプロイせずAPI側だけで文言・表示有無を変更できる」
/// ことの実証が目的（バージョン差分判定ロジックは持たない、単純な
/// enabledフラグ＋文言の配信）。
///
/// [child] をそのまま描画しつつ、初回ビルド後（`addPostFrameCallback`）に
/// 一度だけ [announcementProvider] を確認する。
class AnnouncementBannerListener extends ConsumerStatefulWidget {
  const AnnouncementBannerListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AnnouncementBannerListener> createState() =>
      _AnnouncementBannerListenerState();
}

class _AnnouncementBannerListenerState
    extends ConsumerState<AnnouncementBannerListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkAnnouncement());
  }

  Future<void> _checkAnnouncement() async {
    final announcement = await ref.read(announcementProvider.future);
    if (!mounted || announcement == null) {
      return;
    }

    final actionLabel = announcement.actionLabel;
    final actionUrl = announcement.actionUrl;
    final hasAction = actionLabel != null && actionUrl != null;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(announcement.message),
        action: hasAction
            ? SnackBarAction(
                label: actionLabel,
                onPressed: () => launchUrl(
                  Uri.parse(actionUrl),
                  mode: LaunchMode.externalApplication,
                ),
              )
            : null,
        duration: const Duration(seconds: 6),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
