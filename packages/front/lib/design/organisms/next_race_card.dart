import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/jst_time.dart';
import '../../domain/entities/race_entity.dart';
import '../../domain/entities/race_type.dart';
import '../google_calendar_colors.dart';
import '../grade_color.dart';
import '../typography.dart';
import '../atoms/discipline_icon.dart';
import '../atoms/gradient_card.dart';
import '../atoms/pill.dart';
import '../atoms/tappable_card.dart';

/// 直近の未発走レースを強調表示するヒーローカード（screens.md §1.1-3）。
///
/// ライブカウントダウン（秒単位）は自身の `Timer` で管理し、画面全体の
/// 再描画を避ける。
class NextRaceCard extends StatefulWidget {
  const NextRaceCard({
    required this.race,
    required this.isFavorite,
    required this.onTap,
    required this.onToggleFavorite,
    super.key,
  });

  final RaceEntity race;
  final bool isFavorite;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;

  @override
  State<NextRaceCard> createState() => _NextRaceCardState();
}

class _NextRaceCardState extends State<NextRaceCard> {
  Timer? _timer;
  late Duration _remaining;

  /// [widget.race.datetime] をパース済みの発走時刻。
  ///
  /// 1秒毎のTimerコールバックの中で`race.datetime`は変化しないため、
  /// ここで一度だけパースして保持し、秒ごとに再パースしないようにする
  /// （PERF-126）。`race`自体が差し替わった場合（[didUpdateWidget]）のみ
  /// 再計算する。
  late DateTime _targetTime;

  @override
  void initState() {
    super.initState();
    _targetTime = parseJstDateTime(widget.race.datetime);
    _remaining = _computeRemaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remaining = _computeRemaining());
    });
  }

  /// 発走1時間以内のレースのみ、秒単位のライブカウントダウンを表示する
  /// （screens.md §1.2のレース行と同じ「60分以内」基準。1時間超先では
  /// 秒単位で刻む意味が薄いため発走時刻のみ表示する）。
  bool get _showCountdown => _remaining.inMinutes <= 60;

  @override
  void didUpdateWidget(covariant NextRaceCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.race.raceId != widget.race.raceId) {
      _targetTime = parseJstDateTime(widget.race.datetime);
      _remaining = _computeRemaining();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration _computeRemaining() {
    final diff = _targetTime.difference(jstNow());
    return diff.isNegative ? Duration.zero : diff;
  }

  @override
  Widget build(BuildContext context) {
    final raceType = RaceType.fromValue(widget.race.raceType);
    final colorKey = googleCalendarColorKeyOf(raceType, widget.race.raceGrade);
    final tierColor = GoogleCalendarPalette.background[colorKey]!;
    // build()内でも二重にパースしないよう、initState/didUpdateWidgetで
    // 計算済みの_targetTimeを再利用する（PERF-126の「ついでに」対応）。
    final startTime = _targetTime;
    final grade = widget.race.raceGrade;

    return GradientCard(
      baseColor: tierColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // カウントダウン表示は以前 Stack + Positioned(top:0, right:0) で
          // ヘッダー/レース名テキストの上に重ね、テキスト側に固定の右
          // マージン（84）を確保することで重なりを避けていた（FEDGE-02）。
          // しかし固定マージンは再フロー計算をしないため、OS/ブラウザの
          // テキストスケール設定を大きくする（例: textScaleFactor 2.0）と
          // カウントダウンの文字サイズも連動して大きくなり、確保した
          // 84px を超えて重なる・クリップされるリスクがあった（A11Y-020）。
          // Row + Expanded に置き換え、ヘッダー/レース名側とカウントダウン
          // 側それぞれの実サイズに応じてFlutterのレイアウトエンジンが幅を
          // 動的に配分するようにすることで、テキストスケールが大きくなっても
          // 重なりが発生しない設計にしている。通常のテキストスケールでは
          // 見た目は変わらない（カウントダウンは引き続き右上に表示される）。
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _NextRaceHeader(
                      grade: grade,
                      raceStage: widget.race.raceStage,
                    ),
                    const SizedBox(height: 7),
                    Text(
                      widget.race.raceName,
                      style: AppTypography.nextRaceName.copyWith(
                        color: Colors.white,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _CountdownDisplay(
                remaining: _remaining,
                startTime: startTime,
                showCountdown: _showCountdown,
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '${DisciplineIcon.emojiFor(raceType)} ${widget.race.raceCourse} ${widget.race.raceNumber}R',
            style: AppTypography.tabular(
              AppTypography.bodySmall,
            ).copyWith(color: Colors.white.withValues(alpha: 0.95)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _CardButton(
                  label: '詳細',
                  solid: true,
                  onTap: widget.onTap,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CardButton(
                  label: widget.isFavorite ? '★ 通知ON' : '☆ 通知する',
                  semanticLabel: widget.isFavorite ? '通知ON' : '通知する',
                  solid: false,
                  // 通知設定を切り替えた結果を確認できるよう、
                  // トグルと合わせてレース詳細も開く。
                  onTap: () {
                    widget.onToggleFavorite();
                    widget.onTap();
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// カード上部の「▶ 次のレース」ラベルと、任意のグレード・ステージピル。
///
/// グレード・ステージピルは白の半透明背景（`GradeBadge` のような Google
/// Calendar 配色は、カード自体の背景（`googleCalendarColorKeyOf` と同じ
/// colorKey の色）と重なってしまいコントラストが失われるため使用しない）。
/// [raceStage]（予選・準決勝・決勝等）はオートレース/競輪/競艇のみ値を持つ。
class _NextRaceHeader extends StatelessWidget {
  const _NextRaceHeader({required this.grade, this.raceStage});

  final String? grade;
  final String? raceStage;

  @override
  Widget build(BuildContext context) {
    final hasGrade = grade != null && grade!.isNotEmpty;
    final hasStage = raceStage != null && raceStage!.isNotEmpty;
    // 長いraceStage文言でも折り返して視認可能な状態を保つため、固定幅の
    // Rowではなく折返し可能なWrapを使う（FEDGE-02）。
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          '▶ 次のレース',
          style: AppTypography.caption.copyWith(
            color: Colors.white,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (hasGrade) _HeaderPill(label: grade!),
        if (hasStage) _HeaderPill(label: raceStage!),
      ],
    );
  }
}

/// [_NextRaceHeader] のグレード・ステージ用の白半透明ピル。
class _HeaderPill extends StatelessWidget {
  const _HeaderPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Pill(
      backgroundColor: Colors.white.withValues(alpha: 0.28),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// 発走までの残り時間（秒単位カウントダウン）と発走時刻の表示。
///
/// [showCountdown] が false（発走1時間超先）の場合は秒単位の数字を出さず、
/// 発走時刻のみ表示する。
class _CountdownDisplay extends StatelessWidget {
  const _CountdownDisplay({
    required this.remaining,
    required this.startTime,
    required this.showCountdown,
  });

  final Duration remaining;
  final DateTime startTime;
  final bool showCountdown;

  static String _formatCountdown(Duration duration) {
    // QLIFE-07: 分の切り捨ては`race_time_utils.dart`の`minutesUntil`
    // （行の「あとN分」表示が使う丸め規則）と同じ`Duration.inMinutes`
    // （0方向への切り捨て＝非負のdurationではfloor相当）に揃える。
    // nowProvider（30秒間隔）とこのカード自身のTimer（1秒間隔）は独立した
    // クロックのため厳密に同時刻を指すとは限らないが、少なくとも丸め方向を
    // 一致させることで、同じ瞬間を基準にした場合に分の値が食い違わないことを
    // 保証する。
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    // 秒単位で更新されるカウントダウン数字をそのまま liveRegion にすると
    // スクリーンリーダーが1秒毎に読み上げてしまい体験を損なう（A11Y-033）。
    // 数字自体はセマンティクスツリーから除外し、更新頻度の低い発走時刻のみを
    // 1つの静的ラベルとして提供する。
    return Semantics(
      label: '${DateFormat('HH:mm').format(startTime)}発走',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (showCountdown)
            ExcludeSemantics(
              child: Text(
                _formatCountdown(remaining),
                style: AppTypography.tabular(
                  AppTypography.countdownLarge,
                ).copyWith(color: Colors.white),
              ),
            ),
          ExcludeSemantics(
            child: Text(
              '${DateFormat('HH:mm').format(startTime)} 発走',
              style: const TextStyle(color: Colors.white70, fontSize: 10),
            ),
          ),
        ],
      ),
    );
  }
}

class _CardButton extends StatelessWidget {
  const _CardButton({
    required this.label,
    required this.solid,
    required this.onTap,
    this.semanticLabel,
  });

  final String label;
  final bool solid;
  final VoidCallback onTap;

  /// スクリーンリーダー向けの読み上げラベル。★/☆等の記号を含む[label]を
  /// そのまま読み上げると不安定なため、記号を含まないクリーンな文言を
  /// 明示的に指定できるようにする（省略時は[label]をそのまま使う、A11Y-028）。
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel ?? label,
      excludeSemantics: true,
      onTap: onTap,
      child: TappableCard(
        borderRadius: 10,
        color: solid ? Colors.white : Colors.white.withValues(alpha: 0.22),
        onTap: onTap,
        // タップターゲット推奨最小サイズ(44)に近づけるため、
        // verticalパディングを9→14へ拡大（A11Y-017）。
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: solid ? const Color(0xFF161C18) : Colors.white,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
