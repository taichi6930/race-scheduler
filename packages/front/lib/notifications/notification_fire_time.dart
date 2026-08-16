import '../core/jst_time.dart';
import '../domain/entities/race_entity.dart';

/// [race] の発走 [leadMinutes] 分前の通知発火時刻を返す。
DateTime notificationFireTime(RaceEntity race, int leadMinutes) {
  final raceTime = parseJstDateTime(race.datetime);
  return raceTime.subtract(Duration(minutes: leadMinutes));
}

/// [fireTime] が [now] より後（まだ発火していない）かどうか。
bool isFireTimeUpcoming(DateTime fireTime, DateTime now) =>
    fireTime.isAfter(now);
