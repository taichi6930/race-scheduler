import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../../../core/jst_time.dart';
import '../../../design/breakpoints.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/weekday_colors.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/filter_chips_bar.dart';
import '../../../design/molecules/grade_color_legend.dart';
import '../../../design/molecules/grade_tier_chips_bar.dart';
import '../../../design/molecules/keiba_type_chips_bar.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../design/organisms/next_race_card.dart';
import '../../../design/atoms/now_divider.dart';
import '../../../design/organisms/race_row.dart';
import '../../../design/atoms/refresh_icon_button.dart';
import '../../../design/atoms/sub_filter_chip.dart';
import '../../../design/molecules/venue_chips_bar.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../notifications/application/notification_scheduler_provider.dart';
import '../../../notifications/application/notification_sync.dart';
import '../../favorites/application/favorite_ids_provider.dart';
import '../../favorites/application/favorite_toggle_feedback.dart';
import '../../settings/application/settings_provider.dart';
import '../application/all_timeline_provider.dart';
import '../application/now_provider.dart';
import '../application/pending_race_deep_link_provider.dart';
import '../application/race_time_utils.dart';
import '../application/selected_race_provider.dart';
import '../application/swipe_hint_provider.dart';
import '../application/timeline_filter_feedback.dart';
import '../application/timeline_filter_provider.dart';
import '../application/timeline_provider.dart';
import '../application/timeline_view_mode_provider.dart';
import 'all_timeline_view.dart';
import 'race_detail_sheet.dart';

const _weekdayLabels = ['月', '火', '水', '木', '金', '土', '日'];

/// 横スワイプで日付を切り替える判定に用いる最小速度（論理px/秒）。
/// 小さすぎると通常の縦スクロール操作の斜めブレでも誤発火するため、
/// ある程度の速さを要求する。
const _swipeVelocityThreshold = 200.0;

/// 「重賞は自動で通知」（screens.md §5-1）: [races] のうち重賞レースへ通知を
/// スケジュールする（technical-design.md §5）。設定でOFFの場合は何もしない。
///
/// [previousRaces] は直前にこの日付表示で通知スケジュール済みだったレース一覧
/// （PERF-030）。内容が変わっていないレースまで日付表示のたびに毎回
/// スケジュールし直すとネイティブ通知チャネルへの無駄な呼び出しが多発するため、
/// 新規・変化したレースだけに絞り込む。
Future<void> _scheduleAutoGradeNotifications(
  WidgetRef ref,
  List<RaceEntity>? races, {
  List<RaceEntity>? previousRaces,
}) async {
  final settings = ref.read(settingsProvider);
  if (!settings.notificationsEnabled || !settings.autoNotifySpecifiedGrades) {
    return;
  }
  if (races == null) return;
  final scheduler = ref.read(notificationSchedulerProvider);
  final gradedRaces = specifiedGradeRacesFor(races);
  final previousGradedRaces = previousRaces == null
      ? null
      : specifiedGradeRacesFor(previousRaces);
  // PERF-031: awaitせず並行発火するとプラットフォームチャネルが輻輳し、
  // エラーも握りつぶされる（fire-and-forgetのFutureは呼び出し元が捕捉できない）
  // ため、1件ずつawaitし失敗しても他のレースの登録を継続する。
  for (final race in racesNeedingReschedule(gradedRaces, previousGradedRaces)) {
    try {
      await scheduler.scheduleRaceNotification(
        race,
        leadMinutes: settings.notificationLeadMinutes,
      );
    } on Exception {
      // 1件の通知登録失敗で他のレースの登録を止めない。
    }
  }
}

/// 全期間タイムラインで現在読み込み済みの月を、すべて手動で再取得させる。
void _refreshAllTimeline(WidgetRef ref) {
  for (final month in ref.read(loadedMonthsProvider)) {
    ref.invalidate(monthRaceChunkProvider(month));
  }
}

/// 横スワイプでの日付切り替えをハプティック＋取り消し可能なSnackBarと共に行う
/// （UX-044・UX-046）。
void _changeDateWithFeedback(
  BuildContext context,
  WidgetRef ref,
  DateTime previousDate, {
  required bool goToNext,
}) {
  HapticFeedback.lightImpact();
  final notifier = ref.read(timelineDateProvider.notifier);
  if (goToNext) {
    notifier.goToNextDay();
  } else {
    notifier.goToPrevDay();
  }
  final newDate = ref.read(timelineDateProvider);
  // QERR-10: 連続スワイプ時、直前のSnackBarを残したまま次を積むと
  // キューに溜まり続け、操作を終えた後も古い日付のトーストが順番に
  // 流れてしまう（「取り消す」がどの世代の日付を指すかも分からなくなる）。
  // 表示前に現在のSnackBarを除去し、常に最新の1件だけにする。
  ScaffoldMessenger.of(context).removeCurrentSnackBar();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('${newDate.month}月${newDate.day}日に移動しました'),
      action: SnackBarAction(
        label: '取り消す',
        onPressed: () =>
            ref.read(timelineDateProvider.notifier).setDate(previousDate),
      ),
    ),
  );
}

/// wide レイアウトの詳細パネルに表示するレースを選出する（純粋関数）。
/// [selectedId] に一致するレースがあればそれを優先し、無ければ現在時刻以降で
/// 最初に発走するレース（無ければ先頭のレース）を既定候補とする。
///
/// PERF-018: 従来は selectedId の一致有無に関わらず defaultRace 探索
/// （firstWhere）も毎回行っていたため、selectedRace が見つかる通常時にも
/// 無駄な2回目の全件走査が発生していた。selectedId 一致を先に1回だけ走査し、
/// 見つからない場合のみ defaultRace の走査を行う（worst caseの走査回数は
/// 変わらないが、選択済みレースが見つかる場合の走査回数を半減する）。
RaceEntity? _resolvePanelRace(
  List<RaceEntity> races,
  DateTime now,
  String? selectedId,
) {
  if (races.isEmpty) return null;
  if (selectedId != null) {
    for (final race in races) {
      if (race.raceId == selectedId) return race;
    }
  }
  return races.firstWhere(
    (race) => !raceDateTime(race).isBefore(now),
    orElse: () => races.first,
  );
}

/// [races] から [raceId] に一致するレースを探す（通知タップからの
/// 詳細遷移用）。[races] が未読み込み（null）の場合は null。
RaceEntity? _findRaceById(List<RaceEntity>? races, String raceId) {
  if (races == null) return null;
  for (final race in races) {
    if (race.raceId == raceId) return race;
  }
  return null;
}

/// タイムライン画面（既定タブ、screens.md §1）。
///
/// その日の全公営競技のレースを発走時刻順の1本のタイムラインとして表示する。
class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final viewMode = ref.watch(timelineViewModeProvider);
    final date = ref.watch(timelineDateProvider);
    final racesAsync = ref.watch(visibleTimelineRacesProvider(date));
    final filterState = ref.watch(timelineFilterProvider);
    final enabledDisciplines = ref.watch(
      settingsProvider.select((s) => s.enabledDisciplines),
    );
    final favorites = ref.watch(favoriteIdsProvider);
    final now = ref.watch(nowProvider).value ?? jstNow();
    final venues = viewMode == TimelineViewMode.day
        ? ref.watch(visibleTimelineVenuesProvider(date))
        : ref.watch(allTimelineVenuesProvider);

    // この日のデータ取得のたびに重賞レースへ通知をスケジュールする。
    ref.listen<AsyncValue<List<RaceEntity>>>(timelineProvider(date), (
      previous,
      next,
    ) {
      _scheduleAutoGradeNotifications(
        ref,
        next.value,
        previousRaces: previous?.value,
      );
    });

    // 通知タップで開きたいレースID（app_router.dartの
    // _TimelineRouteEntryが日付遷移とあわせてセットする）が、この日の
    // レース一覧読み込み完了後に見つかり次第、詳細を開く。
    final pendingRaceId = ref.watch(pendingRaceDeepLinkProvider);
    final pendingRace = pendingRaceId == null
        ? null
        : _findRaceById(racesAsync.value, pendingRaceId);
    if (pendingRace != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (ref.read(pendingRaceDeepLinkProvider) != pendingRaceId) return;
        ref.read(pendingRaceDeepLinkProvider.notifier).clear();
        if (!context.mounted) return;
        if (AppBreakpoints.isWide(MediaQuery.sizeOf(context).width)) {
          ref.read(selectedRaceIdProvider.notifier).select(pendingRace.raceId);
        } else {
          showRaceDetailSheet(context, pendingRace);
        }
      });
    }

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: viewMode == TimelineViewMode.day
          ? _TimelineAppBar(
              date: date,
              isToday: _isSameDate(date, now),
              subtitle: racesAsync.maybeWhen(
                data: (races) => '${races.length}件',
                orElse: () => '',
              ),
              onPrevDay: () =>
                  ref.read(timelineDateProvider.notifier).goToPrevDay(),
              onNextDay: () =>
                  ref.read(timelineDateProvider.notifier).goToNextDay(),
              onToday: () =>
                  ref.read(timelineDateProvider.notifier).setDate(now),
              onRefresh: () => ref.invalidate(timelineProvider(date)),
            )
          : _AllTimelineAppBar(
              subtitle: '${ref.watch(allTimelineRacesProvider).races.length}件',
              onRefresh: () => _refreshAllTimeline(ref),
            ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = AppBreakpoints.isWide(constraints.maxWidth);
          final races = viewMode == TimelineViewMode.day
              ? racesAsync.value ?? const <RaceEntity>[]
              : ref.watch(allTimelineRacesProvider).races;

          void onRaceTap(RaceEntity race) => isWide
              ? ref.read(selectedRaceIdProvider.notifier).select(race.raceId)
              : showRaceDetailSheet(context, race);
          void onToggleFavorite(String raceId) =>
              toggleFavoriteWithFeedback(context, ref, raceId);

          final timelineColumn = Column(
            children: [
              const SizedBox(height: 10),
              _ViewModeToggle(
                mode: viewMode,
                onChanged: (next) =>
                    ref.read(timelineViewModeProvider.notifier).setMode(next),
              ),
              const SizedBox(height: 6),
              FilterChipsBar(
                state: filterState,
                enabledDisciplines: enabledDisciplines,
                onToggleMode: (mode) => reportTimelineFilterPersistFailure(
                  context,
                  ref.read(timelineFilterProvider.notifier).toggle(mode),
                ),
                onToggleDiscipline: (type) =>
                    ref.read(settingsProvider.notifier).toggleDiscipline(type),
              ),
              _AnimatedFilterRows(
                rows: [
                  _FilterRowSpec(
                    visible: filterState.gradeOnly,
                    topSpacing: 6,
                    child: GradeTierChipsBar(
                      selectedTiers: filterState.gradeTiers,
                      enabledDisciplines: enabledDisciplines,
                      onToggleTier: (tier) =>
                          reportTimelineFilterPersistFailure(
                            context,
                            ref
                                .read(timelineFilterProvider.notifier)
                                .toggleGradeTier(tier),
                          ),
                    ),
                  ),
                  _FilterRowSpec(
                    visible: enabledDisciplines.contains(Discipline.keiba),
                    topSpacing: 6,
                    child: KeibaTypeChipsBar(
                      selectedTypes: filterState.keibaTypes,
                      onToggleType: (type) =>
                          reportTimelineFilterPersistFailure(
                            context,
                            ref
                                .read(timelineFilterProvider.notifier)
                                .toggleKeibaType(type),
                          ),
                    ),
                  ),
                  _FilterRowSpec(
                    visible: venues.isNotEmpty,
                    topSpacing: 6,
                    child: VenueChipsBar(
                      venues: venues,
                      selectedVenues: filterState.venues,
                      onToggleVenue: (venue) =>
                          reportTimelineFilterPersistFailure(
                            context,
                            ref
                                .read(timelineFilterProvider.notifier)
                                .toggleVenue(venue),
                          ),
                    ),
                  ),
                  _FilterRowSpec(
                    visible: hasActiveTimelineFilter(
                      filterState,
                      enabledDisciplines,
                    ),
                    topSpacing: 4,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // UX-021: フィルタ操作の結果件数はアプリバーの
                          // サブタイトルにも出るが、広画面や日別モードで
                          // スクロールした際に見えなくなる。チップ操作の
                          // 直下（絞り込み解除ボタンの隣）にも表示し、
                          // 操作結果をその場で確認できるようにする。
                          Text(
                            '該当 ${races.length}件',
                            style: AppTypography.caption.copyWith(
                              color: colors.ink2,
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () => reportTimelineFilterPersistFailure(
                              context,
                              ref
                                  .read(timelineFilterProvider.notifier)
                                  .clearAll(),
                            ),
                            icon: const Icon(Icons.filter_alt_off, size: 16),
                            label: const Text('絞り込みを解除'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (viewMode == TimelineViewMode.day &&
                  !ref.watch(swipeHintSeenProvider)) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Icon(Icons.swipe, size: 16, color: colors.ink3),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '左右にスワイプすると前日・翌日に移動できます',
                          style: AppTypography.caption.copyWith(
                            color: colors.ink3,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, size: 16, color: colors.ink3),
                        tooltip: '閉じる',
                        onPressed: () =>
                            ref.read(swipeHintSeenProvider.notifier).markSeen(),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Expanded(
                child: viewMode == TimelineViewMode.day
                    ? CallbackShortcuts(
                        bindings: {
                          const SingleActivator(
                            LogicalKeyboardKey.arrowLeft,
                          ): () => ref
                              .read(timelineDateProvider.notifier)
                              .goToPrevDay(),
                          const SingleActivator(
                            LogicalKeyboardKey.arrowRight,
                          ): () => ref
                              .read(timelineDateProvider.notifier)
                              .goToNextDay(),
                        },
                        child: Focus(
                          autofocus: true,
                          child: Semantics(
                            container: true,
                            label: 'タイムライン本体',
                            hint: '左右にスワイプすると前日・翌日に移動します',
                            child: GestureDetector(
                              onHorizontalDragEnd: (details) {
                                final velocity = details.primaryVelocity ?? 0;
                                if (velocity > _swipeVelocityThreshold) {
                                  ref
                                      .read(swipeHintSeenProvider.notifier)
                                      .markSeen();
                                  _changeDateWithFeedback(
                                    context,
                                    ref,
                                    date,
                                    goToNext: false,
                                  );
                                } else if (velocity <
                                    -_swipeVelocityThreshold) {
                                  ref
                                      .read(swipeHintSeenProvider.notifier)
                                      .markSeen();
                                  _changeDateWithFeedback(
                                    context,
                                    ref,
                                    date,
                                    goToNext: true,
                                  );
                                }
                              },
                              child: racesAsync.when(
                                data: (races) => RefreshIndicator(
                                  onRefresh: () async {
                                    HapticFeedback.mediumImpact();
                                    ref.invalidate(timelineProvider(date));
                                    await ref.read(
                                      timelineProvider(date).future,
                                    );
                                  },
                                  child: _TimelineBody(
                                    date: date,
                                    races: races,
                                    now: now,
                                    favoriteRaceIds: favorites,
                                    onToggleFavorite: onToggleFavorite,
                                    onRaceTap: onRaceTap,
                                  ),
                                ),
                                loading: () => const LoadingSkeletonList(),
                                error: (error, stack) => ErrorRetryCard(
                                  message: 'レースの取得に失敗しました',
                                  onRetry: () =>
                                      ref.invalidate(timelineProvider(date)),
                                ),
                              ),
                            ),
                          ),
                        ),
                      )
                    : AllTimelineBody(
                        favoriteRaceIds: favorites,
                        onToggleFavorite: onToggleFavorite,
                        onRaceTap: onRaceTap,
                      ),
              ),
            ],
          );

          if (!isWide) return timelineColumn;

          final selectedId = ref.watch(selectedRaceIdProvider);
          final panelRace = _resolvePanelRace(races, now, selectedId);

          return Row(
            children: [
              Expanded(child: timelineColumn),
              VerticalDivider(width: 1, color: colors.line),
              SizedBox(
                width: 340,
                child: Material(
                  color: colors.surface,
                  child: panelRace == null
                      ? const EmptyState(icon: '🏇', message: '表示するレースがありません')
                      : SingleChildScrollView(
                          child: RaceDetailContent(race: panelRace),
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TimelineAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _TimelineAppBar({
    required this.date,
    required this.isToday,
    required this.subtitle,
    required this.onPrevDay,
    required this.onNextDay,
    required this.onToday,
    required this.onRefresh,
  });

  final DateTime date;
  final bool isToday;
  final String subtitle;
  final VoidCallback onPrevDay;
  final VoidCallback onNextDay;
  final VoidCallback onToday;
  final VoidCallback onRefresh;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppBar(
      backgroundColor: colors.surface,
      elevation: 0,
      titleSpacing: 12,
      actions: [
        // 今日を表示中はタップしても意味が無いため、他の日付を見ている間だけ出す。
        if (!isToday)
          Semantics(
            button: true,
            label: '今日に移動',
            child: IconButton(
              onPressed: onToday,
              icon: const Icon(Icons.today),
              tooltip: '今日に移動',
            ),
          ),
        RefreshIconButton(onPressed: onRefresh),
      ],
      title: Row(
        children: [
          Semantics(
            button: true,
            label: '前日',
            child: IconButton(
              onPressed: onPrevDay,
              icon: const Icon(Icons.chevron_left),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${date.month}月${date.day}日',
                style: AppTypography.appBarDate.copyWith(color: colors.ink),
              ),
              const SizedBox(width: 4),
              Text(
                _weekdayLabels[date.weekday - 1],
                style: AppTypography.body.copyWith(
                  color: weekdayAccentColor(colors, date) ?? colors.ink2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          Semantics(
            button: true,
            label: '翌日',
            child: IconButton(
              onPressed: onNextDay,
              icon: const Icon(Icons.chevron_right),
            ),
          ),
          const Spacer(),
          Text(
            subtitle,
            style: AppTypography.tabular(
              AppTypography.caption,
            ).copyWith(color: colors.ink3),
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}

/// 全期間モードのアプリバー（screens.md §1.4）。日付送りは意味を持たないため
/// タイトルと読み込み済み件数のみ表示する。
class _AllTimelineAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  const _AllTimelineAppBar({required this.subtitle, required this.onRefresh});

  final String subtitle;
  final VoidCallback onRefresh;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppBar(
      backgroundColor: colors.surface,
      elevation: 0,
      titleSpacing: 16,
      actions: [RefreshIconButton(onPressed: onRefresh)],
      title: Row(
        children: [
          Text(
            'タイムライン',
            style: AppTypography.appBarDate.copyWith(color: colors.ink),
          ),
          const Spacer(),
          Text(
            subtitle,
            style: AppTypography.tabular(
              AppTypography.caption,
            ).copyWith(color: colors.ink3),
          ),
        ],
      ),
    );
  }
}

/// 「日別／全期間」表示モード切替（screens.md §1.4）。フィルタ列の直上に常設する。
class _ViewModeToggle extends StatelessWidget {
  const _ViewModeToggle({required this.mode, required this.onChanged});

  final TimelineViewMode mode;
  final ValueChanged<TimelineViewMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 表示モードの切替も見た目はフィルタチップと同一のため、専用の
          // `_ViewModeChip`（SubFilterChipの3つ目の複製だった）を廃して
          // atomをそのまま使う。
          SubFilterChip(
            label: '日別',
            selected: mode == TimelineViewMode.day,
            onTap: () => onChanged(TimelineViewMode.day),
          ),
          const SizedBox(width: 7),
          SubFilterChip(
            label: '全期間',
            selected: mode == TimelineViewMode.all,
            onTap: () => onChanged(TimelineViewMode.all),
          ),
        ],
      ),
    );
  }
}

bool _isSameDate(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// [_AnimatedFilterRows] の1行分（条件付きで表示する行とその上マージン）。
class _FilterRowSpec {
  const _FilterRowSpec({
    required this.visible,
    required this.topSpacing,
    required this.child,
  });

  final bool visible;
  final double topSpacing;
  final Widget child;
}

/// フィルタ操作で条件付き行（等級ティア/競馬種別/開催地/絞り込み件数）が
/// 現れたり消えたりする際の高さ変化をアニメーションさせる。
///
/// スマホは画面が縦に短く、行の出現・消滅で下のレース一覧が一瞬で大きく
/// ジャンプする（PCでは同じ絶対量でも画面に占める割合が小さく気づきにくい）。
/// [AnimatedSize] で高さ変化を滑らかにし、体感の「画面が動く」量を抑える。
///
/// [rows] を1つずつ個別の[AnimatedSize]でラップせず、まとめて1つの
/// [AnimatedSize]でラップしている点に注意。同一フレームで複数行が同時に
/// 出現/消滅する操作（例:「重賞のみ」ONで等級ティア行と該当件数行が同時に
/// 現れる）で個別ラップにすると、`RenderAnimatedSize`が自分自身のlayout中に
/// 別の`RenderAnimatedSize`のアニメーション再始動を誘発し
/// 「A RenderAnimatedSize was mutated in its own performLayout
/// implementation」で例外になるため、単一の[AnimatedSize]に集約している。
///
/// reduced motion時（[Duration.zero]）は[AnimatedSize]自体を使わない。
/// `AnimatedSize`は親（この画面では[LayoutBuilder]）のlayout中に自分自身の
/// アニメーションをdurationゼロで即座に完了させようとし、その完了通知が
/// 同じlayoutパス中に自身へ`markNeedsLayout`を呼ぶ形になって上記と同種の
/// 例外を引き起こすため（`scrollable_chip_row.dart`の`_scrollIntoView`が
/// durationゼロ時に`scrollTo`ではなく`jumpTo`へ分岐するのと同じ理由）。
class _AnimatedFilterRows extends StatelessWidget {
  const _AnimatedFilterRows({required this.rows});

  final List<_FilterRowSpec> rows;

  Widget _rowsColumn() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (final row in rows)
        if (row.visible)
          Padding(
            padding: EdgeInsets.only(top: row.topSpacing),
            child: row.child,
          ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final duration = context.effectiveAnimationDuration(
      const Duration(milliseconds: 200),
    );
    if (duration == Duration.zero) return _rowsColumn();
    return AnimatedSize(
      duration: duration,
      alignment: Alignment.topCenter,
      curve: Curves.easeOut,
      child: _rowsColumn(),
    );
  }
}

class _TimelineBody extends StatefulWidget {
  const _TimelineBody({
    required this.date,
    required this.races,
    required this.now,
    required this.favoriteRaceIds,
    required this.onToggleFavorite,
    required this.onRaceTap,
  });

  final DateTime date;
  final List<RaceEntity> races;
  final DateTime now;
  final Set<String> favoriteRaceIds;
  final ValueChanged<String> onToggleFavorite;
  final ValueChanged<RaceEntity> onRaceTap;

  @override
  State<_TimelineBody> createState() => _TimelineBodyState();
}

class _TimelineBodyState extends State<_TimelineBody> {
  final _itemScrollController = ItemScrollController();

  @override
  void didUpdateWidget(covariant _TimelineBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_isSameDate(oldWidget.date, widget.date)) {
      _scheduleScrollToNearestRace();
    }
  }

  /// 今日を表示している場合、発走が一番近いレースが見える位置までスクロール
  /// する（日付を送る・画面を開き直すたびにリスト先頭へ戻ってしまうのを防ぐ）。
  ///
  /// レース数が多い日は対象行が画面外はるか先にあり得るため、[ListView] の
  /// `GlobalKey`＋`Scrollable.ensureVisible` では未構築行に届かない。indexベース
  /// で任意行へ確実にジャンプできる [ScrollablePositionedList] を使う理由。
  void _scheduleScrollToNearestRace() {
    final targetIndex = _nearestRaceItemIndex(
      widget.date,
      widget.races,
      widget.now,
    );
    if (targetIndex == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_itemScrollController.isAttached) return;
      _itemScrollController.jumpTo(index: targetIndex, alignment: 0.1);
    });
  }

  /// リスト先頭へスクロールする（UX-011: 「先頭へ戻る」FAB）。
  ///
  /// ダブルタップでの発火（UX-008）は見送った: レース行は個別にタップで
  /// 詳細シートを開く操作を持つため、リスト全体をダブルタップ判定でラップすると
  /// ジェスチャーアリーナ上でシングルタップの確定が
  /// `kDoubleTapTimeout`（既定300ms）分遅延し、詳細シートを開く主要動線を
  /// 損なうため（`aidlc-docs/ux-operability-backlog.md` 参照）。
  void _scrollToTop() {
    if (!_itemScrollController.isAttached) return;
    // OS の「視差効果を減らす」設定時は即座に先頭へ移動する（A11Y-032）。
    // `ItemScrollController.scrollTo` は `duration > Duration.zero` が
    // 前提（ゼロ時は `jumpTo` を使うようAPIドキュメントで明示されている）
    // のため、ゼロと判定できた場合はアニメーション無しの `jumpTo` に分岐する。
    final duration = context.effectiveAnimationDuration(
      const Duration(milliseconds: 300),
    );
    if (duration == Duration.zero) {
      _itemScrollController.jumpTo(index: 0);
      return;
    }
    _itemScrollController.scrollTo(
      index: 0,
      duration: duration,
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final races = widget.races;
    final now = widget.now;

    if (races.isEmpty) {
      return const SingleChildScrollView(
        child: EmptyState(icon: '🔍', message: '条件に合うレースがありません'),
      );
    }

    final nextRace = races.firstWhere(
      (race) => !raceDateTime(race).isBefore(now),
      orElse: () => races.first,
    );
    final showNextRaceCard = !raceDateTime(nextRace).isBefore(now);
    final dividerIndex = nowDividerIndex(races, now);
    // ヘッダー（NextRaceCard・セクション見出し）の件数。NextRaceCardの表示有無
    // は _nearestRaceItemIndex と同じ「dividerIndex!=null」ではなく
    // showNextRaceCard 自身で判定する（両者は実質等価だが、表示するウィジェット
    // 自体の条件をそのまま使う方が意図が明確なため）。
    final headerItemCount = (showNextRaceCard ? 1 : 0) + 1;
    // ヘッダー＋レース行（間にNOWディバイダを高々1つ挿入）＋末尾の凡例。
    final itemCount =
        headerItemCount + races.length + (dividerIndex != null ? 1 : 0) + 1;

    return Stack(
      children: [
        ScrollablePositionedList.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          itemScrollController: _itemScrollController,
          itemCount: itemCount,
          itemBuilder: (context, index) => _buildTimelineItem(
            index: index,
            races: races,
            now: now,
            nextRace: nextRace,
            showNextRaceCard: showNextRaceCard,
            dividerIndex: dividerIndex,
            headerItemCount: headerItemCount,
            itemCount: itemCount,
          ),
          initialScrollIndex:
              _nearestRaceItemIndex(widget.date, races, now) ?? 0,
          initialAlignment: 0.1,
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: FloatingActionButton.small(
            heroTag: 'timelineScrollToTopFab',
            tooltip: '先頭へ戻る',
            onPressed: _scrollToTop,
            child: const Icon(Icons.arrow_upward),
          ),
        ),
      ],
    );
  }

  /// [index] に対応する1件分の表示アイテムを都度構築する（PERF-015）。
  ///
  /// 従来は表示順に `List<Widget>` を一度全件組み立ててから
  /// [ScrollablePositionedList.builder] の `itemBuilder` へ渡していたが、
  /// レース数が多い日でも未表示行まで毎回事前構築してしまい、オンデマンド
  /// 構築の恩恵が無かった。表示順（NextRaceCard→セクション見出し→
  /// レース行[間にNOWディバイダを高々1つ]→末尾の凡例）自体は変えず、
  /// index からどのアイテムかを直接算出することで都度構築にする。
  Widget _buildTimelineItem({
    required int index,
    required List<RaceEntity> races,
    required DateTime now,
    required RaceEntity nextRace,
    required bool showNextRaceCard,
    required int? dividerIndex,
    required int headerItemCount,
    required int itemCount,
  }) {
    if (index < headerItemCount) {
      if (showNextRaceCard && index == 0) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: NextRaceCard(
            race: nextRace,
            isFavorite: widget.favoriteRaceIds.contains(nextRace.raceId),
            onTap: () => widget.onRaceTap(nextRace),
            onToggleFavorite: () => widget.onToggleFavorite(nextRace.raceId),
          ),
        );
      }
      return _SectionLabel(count: races.length);
    }
    if (index == itemCount - 1) {
      return const _TierLegend();
    }

    final relativeIndex = index - headerItemCount;
    if (dividerIndex != null && relativeIndex == dividerIndex) {
      return NowDivider(now: now);
    }
    final raceIndex = (dividerIndex != null && relativeIndex > dividerIndex)
        ? relativeIndex - 1
        : relativeIndex;
    final race = races[raceIndex];
    final time = raceDateTime(race);
    final isPast = shouldDimPastRace(now, time);
    final minutes = minutesUntil(now, time);
    return RaceRow(
      race: race,
      time: time,
      isPast: isPast,
      isFavorite: widget.favoriteRaceIds.contains(race.raceId),
      countdownMinutes: shouldShowRowCountdown(now, time) ? minutes : null,
      onTap: () => widget.onRaceTap(race),
      onToggleFavorite: () => widget.onToggleFavorite(race.raceId),
    );
  }
}

/// [_TimelineBody] のアイテム一覧（NextRaceCard・セクション見出し・NOWディバイダ・
/// レース行を1本にまとめたもの）における、発走が一番近いレースの表示位置。
///
/// 今日を表示していない場合は `null`（先頭のままでよい：未来の日は先頭が最も
/// 近い未来のレース、過去の日は日付を切り替えて見る用途のため）。
int? _nearestRaceItemIndex(
  DateTime date,
  List<RaceEntity> races,
  DateTime now,
) {
  if (races.isEmpty || !_isSameDate(date, now)) return null;

  final dividerIndex = nowDividerIndex(races, now);
  final allRacesPast = raceDateTime(races.last).isBefore(now);
  final nearestRaceIndex =
      dividerIndex ?? (allRacesPast ? races.length - 1 : null);
  if (nearestRaceIndex == null) return null;

  // NextRaceCard（NOWディバイダがある＝未発走レースがある場合のみ表示）と
  // セクション見出しの分だけ、対象行より前にアイテムがある。NOWディバイダが
  // ある場合はその位置自体をスクロール先にする（直後のレース行に加えて、
  // 直前の消化済みレースも少し見える状態になる）。
  final headerItemCount = (dividerIndex != null ? 1 : 0) + 1;
  return headerItemCount + nearestRaceIndex;
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          Text(
            'タイムライン',
            style: AppTypography.sectionLabel.copyWith(color: colors.ink2),
          ),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: colors.line)),
          const SizedBox(width: 8),
          Text(
            '$count件',
            style: AppTypography.tabular(
              AppTypography.caption,
            ).copyWith(color: colors.ink3),
          ),
        ],
      ),
    );
  }
}

class _TierLegend extends StatelessWidget {
  const _TierLegend();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 10),
      child: GradeColorLegend(),
    );
  }
}
