import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/jst_time.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../design/atoms/refresh_icon_button.dart';
import '../../../design/atoms/surface_card.dart';
import '../../../domain/entities/release_note_category.dart';
import '../../../domain/entities/release_note_entity.dart';
import '../application/last_seen_release_provider.dart';
import '../application/release_notes_provider.dart';

/// 更新履歴画面（FR-02, FR-03）。設定画面の「更新履歴」行から遷移する。
///
/// リリースごとにバージョン・カテゴリ別の箇条書きを表示する。取得できた
/// 最新リリースのタグを「最後に見たタグ」として記録し（FR-04）、次回以降は
/// 同じリリースについてのお知らせを出さないようにする。
class WhatsNewScreen extends ConsumerWidget {
  const WhatsNewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final releasesAsync = ref.watch(visibleReleaseNotesProvider);

    // 取得に成功するたびに、最新リリースのタグを「最後に見た」ものとして
    // 記録する（FR-04: 更新履歴ページを訪れた時点で既読扱いにする）。
    ref.listen<AsyncValue<List<ReleaseNoteEntity>>>(releaseNotesProvider, (
      previous,
      next,
    ) {
      final releases = next.value;
      if (releases != null && releases.isNotEmpty) {
        ref
            .read(lastSeenReleaseTagProvider.notifier)
            .markSeen(releases.first.tagName);
      }
    });

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          '更新履歴',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
        actions: [
          RefreshIconButton(
            onPressed: () => ref.invalidate(releaseNotesProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(releaseNotesProvider);
          await ref.read(releaseNotesProvider.future);
        },
        child: releasesAsync.when(
          data: (releases) => _WhatsNewBody(releases: releases),
          loading: () => const LoadingSkeletonList(),
          error: (error, stack) => ErrorRetryCard(
            message: '更新履歴の取得に失敗しました',
            onRetry: () => ref.invalidate(releaseNotesProvider),
          ),
        ),
      ),
    );
  }
}

class _WhatsNewBody extends StatelessWidget {
  const _WhatsNewBody({required this.releases});

  final List<ReleaseNoteEntity> releases;

  @override
  Widget build(BuildContext context) {
    if (releases.isEmpty) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: EmptyState(
          icon: '🆕',
          message: '更新履歴がありません。',
          // QEMP-08: GitHub Releases APIの取得結果が空のときにこの空状態が
          // 出るため、GitHubのリリースページを直接開ける導線を用意する
          // （API取得が復旧するまで自己解決できるようにする）。
          action: TextButton(
            onPressed: () => launchUrl(
              Uri.parse('https://github.com/taichi6930/race-schedule/releases'),
              mode: LaunchMode.externalApplication,
            ),
            child: const Text('GitHubのリリースページを開く'),
          ),
        ),
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      itemCount: releases.length,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: _ReleaseCard(release: releases[index]),
      ),
    );
  }
}

/// 1リリース分（バージョン見出し＋カテゴリ別の箇条書き）を表示するカード。
class _ReleaseCard extends StatelessWidget {
  const _ReleaseCard({required this.release});

  final ReleaseNoteEntity release;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                release.name ?? release.tagName,
                style: AppTypography.body.copyWith(
                  color: colors.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatJapaneseDateLabel(release.publishedAt),
                style: AppTypography.caption.copyWith(color: colors.ink3),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final entry in release.categories)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _CategorySection(
                category: entry.category,
                items: entry.items,
              ),
            ),
        ],
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({required this.category, required this.items});

  final ReleaseNoteCategory category;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final info = releaseNoteCategoryInfoOf(category);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(info.emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(
              info.label,
              style: AppTypography.caption.copyWith(color: colors.ink2),
            ),
          ],
        ),
        const SizedBox(height: 4),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(left: 20, top: 2),
            child: Text(
              '• $item',
              style: AppTypography.bodySmall.copyWith(color: colors.ink),
            ),
          ),
      ],
    );
  }
}
