import 'package:flutter/material.dart';

import '../../domain/entities/race_type.dart';
import '../google_calendar_colors.dart';
import '../grade_color.dart';
import '../tokens.dart';
import '../typography.dart';

/// グレード文字列を Google Calendar と同じ配色のピルバッジで、
/// ステージ（予選・準決勝・決勝等、オートレース/競輪/競艇のみ）を
/// ニュートラル配色のピルバッジで並べて表示する。
///
/// `grade`・`raceStage` がともに無いレースはバッジ自体を表示しない。
/// 競馬（JRA/NAR/OVERSEAS）は `raceStage` を持たないため、グレードのみ表示される。
class GradeBadge extends StatelessWidget {
  const GradeBadge({
    required this.raceType,
    required this.grade,
    this.raceStage,
    super.key,
  });

  final RaceType raceType;
  final String? grade;
  final String? raceStage;

  @override
  Widget build(BuildContext context) {
    final hasGrade = grade != null && grade!.isNotEmpty;
    final hasStage = raceStage != null && raceStage!.isNotEmpty;
    if (!hasGrade && !hasStage) return const SizedBox.shrink();

    final colors = context.colors;
    final colorKey = googleCalendarColorKeyOf(raceType, grade);
    return Wrap(
      spacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (hasGrade)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: BoxDecoration(
              color: GoogleCalendarPalette.background[colorKey],
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              grade!,
              // A11Y-011: 10px固定はコントラスト不足の影響が増幅されやすいため、
              // captionの既定サイズ(11px)まで引き上げる。
              style: AppTypography.caption.copyWith(
                color: GoogleCalendarPalette.foreground[colorKey],
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        if (hasStage)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: BoxDecoration(
              color: colors.surface2,
              border: Border.all(color: colors.line2),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              raceStage!,
              style: AppTypography.caption.copyWith(
                color: colors.ink2,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
      ],
    );
  }
}
