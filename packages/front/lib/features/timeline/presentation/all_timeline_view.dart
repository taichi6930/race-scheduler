import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/jst_time.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/weekday_colors.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/atoms/now_divider.dart';
import '../../../design/organisms/race_row.dart';
import '../../../domain/entities/race_entity.dart';
import '../../settings/application/settings_provider.dart';
import '../application/all_timeline_provider.dart';
import '../application/now_provider.dart';
import '../application/race_time_utils.dart';
import '../application/timeline_filter_provider.dart';
import '../application/timeline_provider.dart';
import '../application/timeline_row.dart';
import '../application/timeline_view_mode_provider.dart';

const _weekdayLabels = ['月', '火', '水', '木', '金', '土', '日'];

/// 全期間タイムライン本体（screens.md §1.4）。
///
/// 過去〜未来を跨いで双方向無限スクロールする1本のリスト。「今日」を
/// `CustomScrollView` の `center` sliverキーとして固定し、上スクロールで
/// 過去、下スクロールで未来を追加読み込みする（technical-design.md §11.2）。
class AllTimelineBody extends ConsumerStatefulWidget {
  const AllTimelineBody({
    required this.favoriteRaceIds,
    required this.onToggleFavorite,
    required this.onRaceTap,
    super.key,
  });

  final Set<String> favoriteRaceIds;
  final ValueChanged<String> onToggleFavorite;
  final ValueChanged<RaceEntity> onRaceTap;

  @override
  ConsumerState<AllTimelineBody> createState() => _AllTimelineBodyState();
}

class _AllTimelineBodyState extends ConsumerState<AllTimelineBody> {
  static const _centerKey = ValueKey('all-timeline-center');
  static const _jumpButtonThreshold = 400.0;
  // 「今日へ」タップ時の遷移先を見積もるための1行あたりの想定高さ。
  // 行の実高さは種類（見出し／ディバイダ／レース行）で異なり、正確な
  // ピクセル位置ではなく「発走が一番近いレース付近」まで運べれば十分なため、
  // 厳密な計測はせず概算値を使う。
  static const _assumedRowExtent = 70.0;
  // スクロールイベントは1回のフリックで何十回も発火する
  // （`ScrollController` のリスナーはフレーム毎ではなくポインタ移動毎に
  // 呼ばれるため）。先読みロード判定・「今日へ」ボタンの表示切替のどちらも
  // 毎回実行する必要は無く、指を止めてからの短い間隔で1回処理すれば
  // 体感を損なわずに演算・再構築の回数を大きく減らせる（PERF-024）。
  static const _scrollDebounceDuration = Duration(milliseconds: 16);

  final _scrollController = ScrollController();
  final _splitCache = TimelineRowSplitCache();
  Timer? _scrollDebounceTimer;
  bool _showJumpToTodayButton = false;
  int _todayTargetIndexInFuture = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollDebounceTimer?.cancel();
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// `ScrollController` のリスナー本体。実処理は行わず、直近のイベントから
  /// [_scrollDebounceDuration] だけ間を置いてから [_processScroll] を1回だけ
  /// 実行するようデバウンスする。
  void _handleScroll() {
    if (!_scrollController.hasClients) return;
    _scrollDebounceTimer?.cancel();
    _scrollDebounceTimer = Timer(_scrollDebounceDuration, _processScroll);
  }

  void _processScroll() {
    if (!mounted || !_scrollController.hasClients) return;
    final position = _scrollController.position;
    // 画面1枚分手前で先読みを開始する（真の端まで着くのを待つと、取得中の
    // 空白期間が視認できてしまうため。閾値を画面の高さに連動させることで、
    // 端末サイズによらず十分なリードタイムを確保する）。
    final loadMoreThreshold = position.viewportDimension;
    if (position.pixels <= position.minScrollExtent + loadMoreThreshold) {
      ref.read(loadedMonthsProvider.notifier).loadEarlier();
    }
    if (position.pixels >= position.maxScrollExtent - loadMoreThreshold) {
      ref.read(loadedMonthsProvider.notifier).loadLater();
    }
    final showButton = position.pixels.abs() > _jumpButtonThreshold;
    if (showButton != _showJumpToTodayButton) {
      setState(() => _showJumpToTodayButton = showButton);
    }
  }

  /// 「今日へ」ボタンの遷移先（境界からのオフセット）へアニメーションする。
  /// 発走が一番近いレースが無ければ（今日全て未発走／今日レース無し）境界
  /// （offset 0）のままでよい。
  void _jumpToToday() {
    final targetOffset = _todayTargetIndexInFuture * _assumedRowExtent;
    // OS の「視差効果を減らす」設定時は即座に移動する（A11Y-032）。
    // `ScrollController.animateTo` は内部の `DrivenScrollActivity` が
    // `duration > Duration.zero` を前提とする（ゼロを渡すとアサーション
    // 失敗になる）ため、ゼロと判定できた場合はアニメーション無しの
    // `jumpTo` に分岐する。
    final duration = context.effectiveAnimationDuration(
      const Duration(milliseconds: 300),
    );
    if (duration == Duration.zero) {
      _scrollController.jumpTo(targetOffset);
      return;
    }
    _scrollController.animateTo(
      targetOffset,
      duration: duration,
      curve: Curves.easeOut,
    );
  }

  /// 「今日へ」ボタンの長押しで日付選択カレンダーを開き、選んだ日の
  /// 日別タイムラインへ直接遷移する（UX-007）。
  Future<void> _openDatePicker() async {
    final now = ref.read(nowProvider).value ?? jstNow();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 5),
    );
    if (picked == null || !mounted) return;
    ref.read(timelineDateProvider.notifier).setDate(picked);
    ref.read(timelineViewModeProvider.notifier).setMode(TimelineViewMode.day);
  }

  /// フィルタ操作で表示対象レースが変わったときに呼ぶ。「今日へ」ボタンが
  /// 非表示（＝境界付近＝今日の日程が画面内にある）の間だけ、発走が一番
  /// 近いレースの位置へ追従し直す。すでに別の日を見るために遠くへスクロール
  /// している場合は、フィルタ操作のたびに今日へ引き戻すと逆に煩わしいため
  /// 何もしない。
  void _followTodayOnFilterChange() {
    if (_showJumpToTodayButton) return;
    final races = ref.read(allTimelineRacesProvider).races;
    final now = ref.read(nowProvider).value ?? jstNow();
    final future = _splitCache.resolve(races, now).future;
    _todayTargetIndexInFuture = nearestTodayRowIndex(future, now);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      _jumpToToday();
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(allTimelineRacesProvider);

    // フィルタ操作（重賞のみ/お気に入り/階層/競技種別/競走場チップ、対象競技
    // 設定）で表示対象レースの増減が起きると、`center` sliverキー方式では
    // 同じスクロールpx位置が指す内容がずれてしまい、今日を見ていたはずが
    // NOWディバイダが画面外へ流れて見えなくなることがあった。今日付近を
    // 見ている間だけ、フィルタ変更後に発走が一番近いレースの位置へ追従し
    // 直すことで、NOWが画面内に留まるようにする。
    ref.listen(timelineFilterProvider, (_, _) => _followTodayOnFilterChange());
    ref.listen(
      settingsProvider.select((s) => s.enabledDisciplines),
      (_, _) => _followTodayOnFilterChange(),
    );
    // `nowProvider` は30秒毎に発火するが、NOWディバイダの位置・行の
    // isPast/カウントダウンは「今日のレースのうち直近の1件の発走時刻」に
    // `now` が到達するまで変化しない（[TimelineRowSplitCache]）。無条件に
    // `ref.watch` すると意味の無い tick でも全行が再構築されるため
    // （PERF-006/PERF-016）、実際に再構築が必要な tick でだけ `setState`
    // する（[TimelineRowSplitCache.isFreshFor]）。
    ref.listen<AsyncValue<DateTime>>(nowProvider, (_, next) {
      final nextNow = next.value;
      if (nextNow == null || !mounted) return;
      if (!_splitCache.isFreshFor(nextNow)) setState(() {});
    });
    final now = ref.read(nowProvider).value ?? jstNow();

    if (data.races.isEmpty) {
      if (data.isLoadingEarlier || data.isLoadingLater) {
        return const Center(child: CircularProgressIndicator());
      }
      // 読み込み済み月の取得自体が失敗している場合、本当に該当レースが
      // 無いのではなくAPI障害が原因のため、日別モードと同様に
      // ErrorRetryCardで区別する（FEDGE-03）。
      if (data.earliestMonthHasError || data.latestMonthHasError) {
        return ErrorRetryCard(
          message: 'レースの取得に失敗しました',
          onRetry: () {
            final months = ref.read(loadedMonthsProvider);
            ref.invalidate(monthRaceChunkProvider(months.first));
            ref.invalidate(monthRaceChunkProvider(months.last));
          },
        );
      }
      return const SingleChildScrollView(
        child: EmptyState(icon: '🔍', message: '条件に合うレースがありません'),
      );
    }

    final split = _splitCache.resolve(data.races, now);
    _todayTargetIndexInFuture = nearestTodayRowIndex(split.future, now);

    return Stack(
      children: [
        CustomScrollView(
          controller: _scrollController,
          center: _centerKey,
          slivers: [
            if (data.isLoadingEarlier) const _EdgeLoadingSliver(),
            _rowSliver(split.past, now),
            const SliverToBoxAdapter(key: _centerKey, child: SizedBox.shrink()),
            _rowSliver(split.future, now, bottomPadding: 24),
            if (data.isLoadingLater) const _EdgeLoadingSliver(),
          ],
        ),
        if (_showJumpToTodayButton)
          Positioned(
            right: 16,
            bottom: 16,
            // QEMP-06: 長押しで日付ピッカーが開くことは`GestureDetector`側の
            // `onLongPress`にしか無く、UI上の手掛かりが無かった
            // （`RefreshIconButton`が`tooltip: '更新'`を持つのと対照的）。
            // `FloatingActionButton.extended`の`tooltip`引数（既定
            // `TooltipTriggerMode.longPress`）をそのまま使うと、外側の
            // `GestureDetector.onLongPress`と長押しジェスチャーを取り合い、
            // タップ操作の環境では日付ピッカーが開かずtooltipだけが表示される
            // 競合が起きるため、`triggerMode: manual`で長押し/タップによる
            // 表示を無効化し、マウスホバー（デスクトップWeb）・スクリーン
            // リーダー（Semantics経由）でのみ伝わるようにする。
            child: Tooltip(
              message: '今日へ移動（長押しで日付を選択）',
              triggerMode: TooltipTriggerMode.manual,
              child: GestureDetector(
                onLongPress: _openDatePicker,
                child: FloatingActionButton.extended(
                  onPressed: _jumpToToday,
                  icon: const Icon(Icons.today),
                  label: const Text('今日へ'),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _rowSliver(
    List<TimelineRow> rows,
    DateTime now, {
    double bottomPadding = 0,
  }) {
    return SliverPadding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) => _TimelineRowTile(
            row: rows[index],
            now: now,
            favoriteRaceIds: widget.favoriteRaceIds,
            onToggleFavorite: widget.onToggleFavorite,
            onRaceTap: widget.onRaceTap,
          ),
          childCount: rows.length,
        ),
      ),
    );
  }
}

/// [futureRows]（[splitTimelineRows] の `future`。先頭は必ず「今日」の
/// `DateHeaderTimelineRow`）の中で、発走が一番近いレースの行インデックスを返す。
///
/// - 今日の途中（一部発走済み・一部未発走）: NOWディバイダの位置
/// - 今日のレースが全て消化済み: 今日最後のレースの行
/// - 今日のレースが全て未発走、または今日のレースが無い: `0`
///   （[_AllTimelineBodyState._jumpToToday] は現状どおり境界へアニメーションするだけでよい）
@visibleForTesting
int nearestTodayRowIndex(List<TimelineRow> futureRows, DateTime now) {
  if (futureRows.isEmpty) return 0;

  final dividerIndex = futureRows.indexWhere(
    (row) => row is NowDividerTimelineRow,
  );
  if (dividerIndex != -1) return dividerIndex;

  var endOfToday = futureRows.length;
  for (var i = 1; i < futureRows.length; i++) {
    if (futureRows[i] is DateHeaderTimelineRow) {
      endOfToday = i;
      break;
    }
  }
  if (endOfToday <= 1) return 0;

  final firstTodayRow = futureRows[1];
  if (firstTodayRow is RaceTimelineRow &&
      raceDateTime(firstTodayRow.race).isBefore(now)) {
    return endOfToday - 1;
  }
  return 0;
}

class _EdgeLoadingSliver extends StatelessWidget {
  const _EdgeLoadingSliver();

  @override
  Widget build(BuildContext context) {
    return const SliverToBoxAdapter(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
    );
  }
}

class _TimelineRowTile extends StatelessWidget {
  const _TimelineRowTile({
    required this.row,
    required this.now,
    required this.favoriteRaceIds,
    required this.onToggleFavorite,
    required this.onRaceTap,
  });

  final TimelineRow row;
  final DateTime now;
  final Set<String> favoriteRaceIds;
  final ValueChanged<String> onToggleFavorite;
  final ValueChanged<RaceEntity> onRaceTap;

  @override
  Widget build(BuildContext context) {
    return switch (row) {
      DateHeaderTimelineRow(:final date) => _DateHeader(date: date),
      NowDividerTimelineRow(now: final dividerNow) => NowDivider(
        now: dividerNow,
      ),
      RaceTimelineRow(:final race) => _buildRaceRow(race),
    };
  }

  Widget _buildRaceRow(RaceEntity race) {
    final time = raceDateTime(race);
    final isPast = shouldDimPastRace(now, time);
    final minutes = minutesUntil(now, time);
    return RaceRow(
      race: race,
      isPast: isPast,
      isFavorite: favoriteRaceIds.contains(race.raceId),
      countdownMinutes: shouldShowRowCountdown(now, time) ? minutes : null,
      onTap: () => onRaceTap(race),
      onToggleFavorite: () => onToggleFavorite(race.raceId),
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 8),
      child: Row(
        children: [
          Text(
            '${date.month}月${date.day}日',
            style: AppTypography.sectionLabel.copyWith(color: colors.ink),
          ),
          const SizedBox(width: 6),
          Text(
            _weekdayLabels[date.weekday - 1],
            style: AppTypography.caption.copyWith(
              color: weekdayAccentColor(colors, date) ?? colors.ink3,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: colors.line)),
        ],
      ),
    );
  }
}
