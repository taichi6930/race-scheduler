import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/jst_time.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../design/organisms/race_row.dart';
import '../../../design/atoms/refresh_icon_button.dart';
import '../../../design/atoms/tappable_card.dart';
import '../../../domain/entities/race_entity.dart';
import '../../players/presentation/players_tab.dart';
import '../../timeline/application/now_provider.dart';
import '../../timeline/application/race_time_utils.dart';
import '../../timeline/presentation/race_detail_sheet.dart';
import '../application/favorite_ids_provider.dart';
import '../application/favorite_races_provider.dart';
import '../application/favorite_toggle_feedback.dart';
import '../application/favorites_sub_tab_provider.dart';

/// お気に入り画面（screens.md §3）。
///
/// 登録済みレースを発走時刻順（当日〜将来）にリスト表示する。
/// 過去に発走したお気に入りは常に非表示（切り替える設定は無い）。
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final subTab = ref.watch(favoritesSubTabProvider);
    final racesAsync = ref.watch(favoriteRacesProvider);
    final isRacesTab = subTab == FavoritesSubTab.races;

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          'お気に入り',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
        actions: [
          if (isRacesTab) ...[
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  racesAsync.maybeWhen(
                    data: (races) => '${races.length}件',
                    orElse: () => '',
                  ),
                  style: AppTypography.tabular(
                    AppTypography.caption,
                  ).copyWith(color: colors.ink3),
                ),
              ),
            ),
            RefreshIconButton(
              onPressed: () => ref.invalidate(favoriteRacesRawProvider),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          const _FavoritesSubTabBar(),
          Expanded(
            child: isRacesTab
                ? RefreshIndicator(
                    onRefresh: () async {
                      HapticFeedback.mediumImpact();
                      ref.invalidate(favoriteRacesRawProvider);
                      await ref.read(favoriteRacesRawProvider.future);
                    },
                    child: racesAsync.when(
                      data: (races) => _FavoritesBody(races: races),
                      loading: () => const LoadingSkeletonList(),
                      error: (error, stack) => ErrorRetryCard(
                        message: 'お気に入りの取得に失敗しました',
                        onRetry: () => ref.invalidate(favoriteRacesRawProvider),
                      ),
                    ),
                  )
                : const PlayersTab(),
          ),
        ],
      ),
    );
  }
}

/// 「レース／選手」サブタブの切り替えUI（KPLAYER-07）。
class _FavoritesSubTabBar extends ConsumerWidget {
  const _FavoritesSubTabBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final selected = ref.watch(favoritesSubTabProvider);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.line)),
      ),
      child: Row(
        children: [
          _SubTabChip(
            label: 'レース',
            selected: selected == FavoritesSubTab.races,
            onTap: () => ref
                .read(favoritesSubTabProvider.notifier)
                .select(FavoritesSubTab.races),
          ),
          const SizedBox(width: 8),
          _SubTabChip(
            label: '選手',
            selected: selected == FavoritesSubTab.players,
            onTap: () => ref
                .read(favoritesSubTabProvider.notifier)
                .select(FavoritesSubTab.players),
          ),
        ],
      ),
    );
  }
}

class _SubTabChip extends StatelessWidget {
  const _SubTabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: TappableCard(
        borderRadius: 999,
        color: selected ? colors.brand : colors.surface2,
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Text(
          label,
          style: AppTypography.bodySmall.copyWith(
            color: selected ? Colors.white : colors.ink2,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// お気に入り一覧本体。
///
/// `now`（`nowProvider` により30秒毎に発火）は行ごと（[_FavoriteRaceRow]）に
/// 個別配布し、この階層では watch しない。ここで watch すると
/// `AppBar`／`ListView` の構造ごと画面全体が毎tick再構築されてしまうため
/// （PERF-110）。
class _FavoritesBody extends StatelessWidget {
  const _FavoritesBody({required this.races});

  final List<RaceEntity> races;

  @override
  Widget build(BuildContext context) {
    if (races.isEmpty) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: EmptyState(
          icon: '☆',
          message: 'お気に入りはまだありません。\nレースの★で登録すると、発走前に通知します。',
          action: FilledButton(
            onPressed: () => context.go('/timeline'),
            child: const Text('タイムラインを見る'),
          ),
        ),
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      itemCount: races.length,
      itemBuilder: (context, index) => _FavoriteRaceRow(race: races[index]),
    );
  }
}

/// お気に入り一覧の1行。
///
/// `now` はこの行だけで watch する（PERF-110）。[favoriteRacesProvider] は
/// 発走済みのレースを除外済みのため、この画面に表示されるレースは常に
/// 未発走（`isPast: false` 固定）であり、`now` はカウントダウン表示にのみ
/// 使う。
class _FavoriteRaceRow extends ConsumerWidget {
  const _FavoriteRaceRow({required this.race});

  final RaceEntity race;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider).value ?? jstNow();
    final time = raceDateTime(race);
    // KPLAYER-07: このレースはローカルお気に入り(favoriteIdsProvider)ではなく
    // 注目選手由来(isWatched)で表示されている場合がある。星の見た目は
    // 実際にローカル登録されているかどうかで正しく出し分ける。
    final isFavorite = ref.watch(
      favoriteIdsProvider.select((ids) => ids.contains(race.raceId)),
    );
    return RaceRow(
      race: race,
      isPast: false,
      isFavorite: isFavorite,
      countdownMinutes: shouldShowRowCountdown(now, time)
          ? minutesUntil(now, time)
          : null,
      onTap: () => showRaceDetailSheet(context, race),
      onToggleFavorite: () =>
          toggleFavoriteWithFeedback(context, ref, race.raceId),
    );
  }
}
