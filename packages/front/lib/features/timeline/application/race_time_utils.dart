import '../../../core/jst_time.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../integrations/google_calendar_link.dart';

/// レースの発走時刻を JST 壁時計の [DateTime] として取得する。
DateTime raceDateTime(RaceEntity race) => parseJstDateTime(race.datetime);

/// 発走済みレースを一覧上で薄く（[isPast]）表示してよいかどうか。
///
/// 発走時刻を過ぎた直後に薄くすると、まだレース中の可能性が高いレースまで
/// 「終わった」ように見えてしまうため、実際のレース時間データを持たない
/// 制約の中で[assumedRaceDuration]（カレンダー登録時と同じ仮定値）分の
/// レース時間＋5分の猶予を置いてから薄く表示する。
bool shouldDimPastRace(DateTime now, DateTime target) => now.isAfter(
  target.add(assumedRaceDuration).add(const Duration(minutes: 5)),
);

/// [now] から [target] までの経過分数（負値は過去）。
int minutesUntil(DateTime now, DateTime target) =>
    target.difference(now).inMinutes;

/// 行に「あとN分」を表示すべきかどうか（screens.md §1.2: 60分以内の未発走行のみ）。
bool shouldShowRowCountdown(DateTime now, DateTime target) {
  final minutes = minutesUntil(now, target);
  return minutes >= 0 && minutes <= 60;
}

/// レース一覧のうち、[now] より後（未発走）の最初のレースのインデックスを返す。
///
/// 全件が過去、または全件が未来（境界が無い）場合は `null`
/// （NOWディバイダを表示しない）。
int? nowDividerIndex(List<RaceEntity> races, DateTime now) {
  if (races.isEmpty) return null;
  final firstUpcoming = races.indexWhere(
    (race) => !raceDateTime(race).isBefore(now),
  );
  if (firstUpcoming <= 0) return null;
  return firstUpcoming;
}
