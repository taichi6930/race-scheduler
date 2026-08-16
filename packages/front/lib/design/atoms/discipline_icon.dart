import 'package:flutter/material.dart';

import '../../domain/entities/race_type.dart';
import '../tokens.dart';

/// 公営競技を識別するアイコン。
///
/// 色の意味はグレード階層のみに一本化するため、このアイコンは
/// 低彩度（`surface3`/`ink3` 系）で統一し、競技ごとの色分けは行わない
/// （design-system.md §1・#5）。
class DisciplineIcon extends StatelessWidget {
  const DisciplineIcon({required this.raceType, this.size = 30, super.key});

  final RaceType raceType;
  final double size;

  /// 競技を表す絵文字。チップ等、コンテナ無しで再利用する場合に使う。
  static String emojiFor(RaceType type) => Discipline.of(type).emoji;

  /// 競技を表すベクターアイコン（PERF-013: 絵文字の色付きフォント解決コストを
  /// 避けるため、行を大量に描画するタイムライン等では絵文字ではなくこちらを使う）。
  static IconData iconFor(RaceType type) => switch (Discipline.of(type)) {
    Discipline.keiba => Icons.emoji_events,
    Discipline.keirin => Icons.pedal_bike,
    Discipline.boatrace => Icons.directions_boat,
    Discipline.autorace => Icons.two_wheeler,
  };

  static String labelFor(RaceType type) => switch (type) {
    RaceType.jra => 'JRA',
    RaceType.nar => '地方競馬',
    RaceType.overseas => '海外競馬',
    RaceType.keirin => '競輪',
    RaceType.boatrace => '競艇',
    RaceType.autorace => 'オートレース',
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      label: labelFor(raceType),
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.surface3,
          borderRadius: BorderRadius.circular(size * 0.3),
        ),
        child: ExcludeSemantics(
          child: Icon(iconFor(raceType), size: size * 0.6, color: colors.ink3),
        ),
      ),
    );
  }
}
