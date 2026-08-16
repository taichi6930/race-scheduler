import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/jst_time.dart';
import '../../domain/entities/race_entity.dart';
import '../../domain/entities/race_type.dart';
import '../google_calendar_colors.dart';
import '../grade_color.dart';
import '../tokens.dart';
import '../typography.dart';
import '../atoms/discipline_icon.dart';
import '../atoms/grade_badge.dart';
import '../atoms/pill.dart';
import '../atoms/tappable_card.dart';
import '../atoms/unconfirmed_badge.dart';

/// タイムライン1行（発走時刻＋レースカード＋★、screens.md §1.1-6）。
class RaceRow extends StatelessWidget {
  const RaceRow({
    required this.race,
    required this.isPast,
    required this.isFavorite,
    required this.onTap,
    required this.onToggleFavorite,
    this.countdownMinutes,
    this.time,
    super.key,
  });

  final RaceEntity race;
  final bool isPast;
  final bool isFavorite;
  final int? countdownMinutes;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;

  /// 発走時刻（呼び出し元ですでに [race.datetime] をパース済みの場合はそれを渡す）。
  ///
  /// タイムライン一覧は行ごとに `isPast`/`countdownMinutes` を計算する際、
  /// 既に発走時刻を1回パース済みであることが多い。未指定時は
  /// [race.datetime] から都度パースする（後方互換）が、渡せる場合は
  /// 渡すことで `build()` 毎の二重パースを避けられる（PERF-019）。
  final DateTime? time;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final raceType = RaceType.fromValue(race.raceType);
    final colorKey = googleCalendarColorKeyOf(raceType, race.raceGrade);
    final time = this.time ?? parseJstDateTime(race.datetime);

    return Opacity(
      opacity: isPast ? 0.5 : 1,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TimeLabel(time: time),
            const SizedBox(width: 11),
            Expanded(
              child: TappableCard(
                borderRadius: 14,
                color: colors.surface,
                border: Border.all(color: colors.line),
                clipBehavior: Clip.antiAlias,
                onTap: onTap,
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // グレードバッジのテキストと重複する補助的な色情報の
                      // ため、装飾として扱いスクリーンリーダーからは除外する
                      // （A11Y-031）。
                      ExcludeSemantics(
                        child: Container(
                          width: 4,
                          color: GoogleCalendarPalette.background[colorKey],
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                          child: Row(
                            children: [
                              DisciplineIcon(raceType: raceType, size: 30),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _RaceCardBody(
                                  race: race,
                                  raceType: raceType,
                                ),
                              ),
                              _TrailingInfo(
                                countdownMinutes: countdownMinutes,
                                isFavorite: isFavorite,
                                onToggleFavorite: onToggleFavorite,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 発走時刻ラベル（`HH:mm`）。
///
/// 固定幅ではなくテキストの自然な幅で描画する（A11Y-019）。`HH:mm`は常に
/// 5文字・等幅数字（tabular figures）のため、行ごとの幅は揃ったまま、
/// テキストスケール拡大時の折返し・はみ出しを避けられる。
class _TimeLabel extends StatelessWidget {
  const _TimeLabel({required this.time});

  final DateTime time;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 11),
      child: Text(
        DateFormat('HH:mm').format(time),
        style: AppTypography.tabular(
          AppTypography.bodySmall,
        ).copyWith(color: colors.ink, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// レースカード本体（開催地・レース番号・グレード・レース名）。
class _RaceCardBody extends StatelessWidget {
  const _RaceCardBody({required this.race, required this.raceType});

  final RaceEntity race;
  final RaceType raceType;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          // 競輪の長いraceStage文言（例:
          // 「Ａ級チャレンジ予選」等）を含むGradeBadgeが狭い画面幅で
          // 開催地名・Rバッジと衝突しオーバーフローするのを避けるため、
          // 固定幅のRowではなくWrapで折り返し可能にする（FEDGE-01）。
          spacing: 7,
          runSpacing: 2,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              race.raceCourse,
              style: AppTypography.bodySmall.copyWith(
                color: colors.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            Pill(
              backgroundColor: colors.surface2,
              borderRadius: 5,
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              child: Text(
                '${race.raceNumber}R',
                style: AppTypography.tabular(
                  AppTypography.caption,
                ).copyWith(color: colors.ink3),
              ),
            ),
            GradeBadge(
              raceType: raceType,
              grade: race.raceGrade,
              raceStage: race.raceStage,
            ),
            if (race.isWatched ?? false) const _WatchedBadge(),
            if (race.isConfirmed == false) const UnconfirmedBadge(),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          race.raceName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.caption.copyWith(
            color: colors.ink2,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// 注目選手が出走するレースであることを示す小バッジ（KPLAYER-07）。
///
/// 「⭐お気に入り」フィルタON時、ローカルお気に入りと注目選手由来のレースが
/// 混ざって表示されるため（timeline_filter_provider.dart参照）、
/// このレースが「なぜ表示されているか」を視覚的に区別できるようにする。
class _WatchedBadge extends StatelessWidget {
  const _WatchedBadge();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Tooltip(
      message: '注目選手が出走',
      child: Pill(
        backgroundColor: colors.favorite.withValues(alpha: 0.16),
        borderRadius: 5,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person, size: 11, color: colors.favorite),
            const SizedBox(width: 2),
            Text(
              '注目選手',
              style: AppTypography.tabular(
                AppTypography.caption,
              ).copyWith(color: colors.favorite, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

/// カウントダウン表示＋お気に入りトグル（右端列）。
class _TrailingInfo extends StatelessWidget {
  const _TrailingInfo({
    required this.countdownMinutes,
    required this.isFavorite,
    required this.onToggleFavorite,
  });

  final int? countdownMinutes;
  final bool isFavorite;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final minutes = countdownMinutes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (minutes != null)
          Text(
            minutes <= 0 ? 'まもなく' : 'あと$minutes分',
            style: AppTypography.tabular(
              AppTypography.caption,
            ).copyWith(color: colors.brandInk, fontWeight: FontWeight.w800),
          ),
        Semantics(
          button: true,
          container: true,
          label: isFavorite ? 'お気に入り解除' : 'お気に入り登録',
          child: IconButton(
            onPressed: onToggleFavorite,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            icon: ExcludeSemantics(
              child: Icon(
                isFavorite ? Icons.star : Icons.star_border,
                size: 16,
                color: isFavorite ? colors.favorite : colors.ink3,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
