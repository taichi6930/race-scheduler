import '../core/jst_time.dart';
import '../domain/entities/race_entity.dart';

/// レース発走の [leadMinutes] 分前を、Web Push サーバへ送る発火時刻
/// （UTC epoch millis）として計算する。
///
/// `race.datetime` から得たJST壁時計を、
/// `integrations/google_calendar_link.dart` と同じ変換（-9時間）で UTC 化する
/// （web-push-design.md §3「発火時刻の扱い」参照）。
int webPushFireAtMs(RaceEntity race, int leadMinutes) {
  final jstWall = parseJstDateTime(race.datetime);
  final raceTimeUtc = DateTime.utc(
    jstWall.year,
    jstWall.month,
    jstWall.day,
    jstWall.hour,
    jstWall.minute,
    jstWall.second,
  ).subtract(const Duration(hours: 9));
  return raceTimeUtc
      .subtract(Duration(minutes: leadMinutes))
      .millisecondsSinceEpoch;
}
