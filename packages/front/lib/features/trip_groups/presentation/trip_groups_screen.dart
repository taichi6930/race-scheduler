import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/jst_time.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../design/atoms/refresh_icon_button.dart';
import '../../../design/atoms/surface_card.dart';
import '../../../domain/entities/trip_candidate_period_entity.dart';
import '../../../domain/entities/trip_group_entity.dart';
import '../application/trip_groups_provider.dart';

/// 旅程グループ一覧画面（design §4.1・TRIP-07）。
///
/// 各グループについて、単独グループは開催日件数を、複数会場グループは
/// 直近の候補期間の要約（または「候補なし」）を表示する。
class TripGroupsScreen extends ConsumerWidget {
  const TripGroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final groupsAsync = ref.watch(tripGroupsProvider);

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          '旅程グループ',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
        actions: [
          RefreshIconButton(
            onPressed: () => ref.invalidate(tripGroupsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(tripGroupsProvider);
          await ref.read(tripGroupsProvider.future);
        },
        child: groupsAsync.when(
          data: (groups) => _TripGroupsBody(groups: groups),
          loading: () => const LoadingSkeletonList(),
          error: (error, stack) => ErrorRetryCard(
            message: '旅程グループの取得に失敗しました',
            onRetry: () => ref.invalidate(tripGroupsProvider),
          ),
        ),
      ),
    );
  }
}

class _TripGroupsBody extends StatelessWidget {
  const _TripGroupsBody({required this.groups});

  final List<TripGroupEntity> groups;

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) {
      return const SingleChildScrollView(
        physics: AlwaysScrollableScrollPhysics(),
        child: EmptyState(icon: '🚃', message: '表示できる旅程グループがありません。'),
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      itemCount: groups.length,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.only(bottom: 9),
        child: _TripGroupRow(group: groups[index]),
      ),
    );
  }
}

/// [group] の要約を1件分表示するタップ可能な行（詳細画面への導線）。
class _TripGroupRow extends StatelessWidget {
  const _TripGroupRow({required this.group});

  final TripGroupEntity group;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: () => context.push('/trip-groups/${group.id}'),
      borderRadius: BorderRadius.circular(14),
      child: SurfaceCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.name,
                    style: AppTypography.body.copyWith(color: colors.ink),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    describeTripGroupSummary(group),
                    style: AppTypography.caption.copyWith(color: colors.ink3),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}

/// 一覧行・詳細画面の見出しに使う、[group] の要約テキストを組み立てる（純粋関数）。
///
/// - 単独グループ: 開催日件数
/// - 複数会場グループ・候補なし: 「候補なし」
/// - 複数会場グループ・候補あり: 直近の候補期間（開始日〜終了日）と件数
String describeTripGroupSummary(TripGroupEntity group) {
  if (group.isSingleCourseGroup) {
    final count = group.heldDates?.length ?? 0;
    return '開催日 $count件';
  }

  final candidates = group.candidates ?? const <TripCandidatePeriodEntity>[];
  if (candidates.isEmpty) {
    return '候補なし';
  }

  final nearest = _nearestCandidate(candidates);
  final rangeLabel = nearest.startDate == nearest.endDate
      ? _formatHeldDateLabel(nearest.startDate)
      : '${_formatHeldDateLabel(nearest.startDate)}〜'
            '${_formatHeldDateLabel(nearest.endDate)}';
  return '直近候補: $rangeLabel（他${candidates.length - 1}件）'.replaceAll(
    '（他0件）',
    '',
  );
}

/// "YYYY-MM-DD" 形式の日付文字列を、日本語ローカライズ形式（`YYYY年M月d日`）に変換する。
///
/// 旅程グループ画面の日付表示だけ `YYYY-MM-DD` のまま不統一だったため統一する（FEDGE-06）。
/// 他画面（timeline/calendar）は「今日」基準の近接日しか表示しないため年を省いた
/// `M月d日`で足りるが、本画面は`kTripLookaheadDaysMax`（365日）まで先の候補日を
/// 表示しうるため、年をまたぐ表示が普通に起こる。年を省略せず含める。
String _formatHeldDateLabel(String yyyyMmDd) {
  return formatJapaneseDateLabel(DateTime.parse(yyyyMmDd));
}

/// [candidates] のうち、開始日が最も早い候補期間を返す。
TripCandidatePeriodEntity _nearestCandidate(
  List<TripCandidatePeriodEntity> candidates,
) {
  return candidates.reduce(
    (earliest, candidate) =>
        candidate.startDate.compareTo(earliest.startDate) < 0
        ? candidate
        : earliest,
  );
}
