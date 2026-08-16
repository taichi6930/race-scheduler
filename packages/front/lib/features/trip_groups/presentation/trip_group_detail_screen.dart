import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/jst_time.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../design/atoms/surface_card.dart';
import '../../../domain/entities/trip_candidate_period_entity.dart';
import '../../../domain/entities/trip_group_entity.dart';
import '../application/trip_groups_provider.dart';

/// "YYYY-MM-DD" 形式の日付文字列を、日本語ローカライズ形式（`YYYY年M月d日`）に変換する。
///
/// 旅程グループ画面の日付表示だけ `YYYY-MM-DD` のまま不統一だったため統一する（FEDGE-06）。
/// 他画面（timeline/calendar）は「今日」基準の近接日しか表示しないため年を省いた
/// `M月d日`で足りるが、本画面は`kTripLookaheadDaysMax`（365日）まで先の候補日を
/// 表示しうるため、年をまたぐ表示が普通に起こる。年を省略せず含める。
String _formatHeldDateLabel(String yyyyMmDd) {
  return formatJapaneseDateLabel(DateTime.parse(yyyyMmDd));
}

/// 旅程グループ詳細画面（design §4.1・TRIP-07）。
///
/// 単独グループは開催日一覧、複数会場グループは候補期間一覧
/// （期間内の会場ごとの開催日を含む）を表示する。
class TripGroupDetailScreen extends ConsumerWidget {
  const TripGroupDetailScreen({required this.groupId, super.key});

  final String groupId;

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
          groupsAsync.maybeWhen(
            data: (groups) =>
                findTripGroupById(groups, groupId)?.name ?? '旅程グループ',
            orElse: () => '旅程グループ',
          ),
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
      ),
      body: groupsAsync.when(
        data: (groups) {
          final group = findTripGroupById(groups, groupId);
          if (group == null) {
            return const SingleChildScrollView(
              child: EmptyState(icon: '❓', message: '旅程グループが見つかりません。'),
            );
          }
          return _TripGroupDetailBody(group: group);
        },
        loading: () => const LoadingSkeletonList(),
        error: (error, stack) => ErrorRetryCard(
          message: '旅程グループの取得に失敗しました',
          onRetry: () => ref.invalidate(tripGroupsProvider),
        ),
      ),
    );
  }
}

class _TripGroupDetailBody extends StatelessWidget {
  const _TripGroupDetailBody({required this.group});

  final TripGroupEntity group;

  @override
  Widget build(BuildContext context) {
    if (group.isSingleCourseGroup) {
      return _SingleCourseHeldDates(group: group);
    }
    return _CandidatePeriodList(group: group);
  }
}

/// 単独グループ（水沢・帯広ばの想定）の開催日一覧。
class _SingleCourseHeldDates extends StatelessWidget {
  const _SingleCourseHeldDates({required this.group});

  final TripGroupEntity group;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final heldDates = group.heldDates ?? const <String>[];
    if (heldDates.isEmpty) {
      return const SingleChildScrollView(
        child: EmptyState(icon: '📅', message: '検索期間内に開催予定がありません。'),
      );
    }

    final course = group.courses.first;
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      itemCount: heldDates.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '${course.raceType} / ${course.raceCourse}',
              style: AppTypography.caption.copyWith(color: colors.ink3),
            ),
          );
        }
        final date = heldDates[index - 1];
        return _DetailCard(
          child: Text(
            _formatHeldDateLabel(date),
            style: AppTypography.body.copyWith(color: colors.ink),
          ),
        );
      },
    );
  }
}

/// 複数会場グループの候補期間一覧（候補なしの場合は「候補なし」表示）。
class _CandidatePeriodList extends StatelessWidget {
  const _CandidatePeriodList({required this.group});

  final TripGroupEntity group;

  @override
  Widget build(BuildContext context) {
    final candidates = group.candidates ?? const <TripCandidatePeriodEntity>[];
    if (candidates.isEmpty) {
      return const SingleChildScrollView(
        child: EmptyState(icon: '🔍', message: '候補なし\n条件に合う候補期間が見つかりませんでした。'),
      );
    }

    final sorted = [...candidates]
      ..sort((a, b) => a.startDate.compareTo(b.startDate));

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      itemCount: sorted.length,
      itemBuilder: (context, index) =>
          _CandidatePeriodCard(period: sorted[index]),
    );
  }
}

class _CandidatePeriodCard extends StatelessWidget {
  const _CandidatePeriodCard({required this.period});

  final TripCandidatePeriodEntity period;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rangeLabel = period.startDate == period.endDate
        ? _formatHeldDateLabel(period.startDate)
        : '${_formatHeldDateLabel(period.startDate)} 〜 '
              '${_formatHeldDateLabel(period.endDate)}';
    return _DetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            rangeLabel,
            style: AppTypography.body.copyWith(
              color: colors.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          for (final course in period.courses)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                '${course.course.raceType} / ${course.course.raceCourse}: '
                '${course.dates.map(_formatHeldDateLabel).join('、')}',
                style: AppTypography.bodySmall.copyWith(color: colors.ink2),
              ),
            ),
        ],
      ),
    );
  }
}

/// 詳細画面内のカード共通コンテナ（1件分の開催日・候補期間）。
class _DetailCard extends StatelessWidget {
  const _DetailCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(margin: const EdgeInsets.only(bottom: 9), child: child);
  }
}
