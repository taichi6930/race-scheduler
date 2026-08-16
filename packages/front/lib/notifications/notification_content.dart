import 'package:intl/intl.dart';

import '../core/jst_time.dart';
import '../domain/entities/race_entity.dart';
import '../domain/entities/race_type.dart';

/// 通知のタイトル・本文。
class NotificationContent {
  const NotificationContent({required this.title, required this.body});

  final String title;
  final String body;
}

/// 通知本文を組み立てる（technical-design.md §5:
/// 「{競技アイコン} {レース名}（{grade}）まもなく発走 — {会場} {R}R、{lead}分後」）。
///
/// 発走時刻（`HH:mm`）を先頭に含める。通知の配信が遅れて「まもなく発走」
/// だけが届くと、実際にはもう発走済みなのか判断できないため（ユーザー報告）。
NotificationContent buildRaceNotificationContent(
  RaceEntity race,
  int leadMinutes,
) {
  final raceType = RaceType.fromValue(race.raceType);
  final discipline = Discipline.of(raceType);
  final grade = race.raceGrade;
  final gradeSuffix = grade != null && grade.isNotEmpty ? '（$grade）' : '';
  final timeLabel = DateFormat('HH:mm').format(parseJstDateTime(race.datetime));
  final leadLabel = leadMinutes <= 0 ? 'まもなく発走' : '発走 $leadMinutes分前';

  return NotificationContent(
    title: '${discipline.emoji} ${race.raceName}$gradeSuffix',
    body: '${race.raceCourse} ${race.raceNumber}R ・ $timeLabel $leadLabel',
  );
}
