import 'package:flutter/foundation.dart';

import '../../../domain/entities/race_entity.dart';
import 'race_time_utils.dart';
import 'timeline_provider.dart';

/// 全期間タイムラインの1行（日付見出し／レース／NOWディバイダ）。
sealed class TimelineRow {
  const TimelineRow();
}

class DateHeaderTimelineRow extends TimelineRow {
  const DateHeaderTimelineRow(this.date);

  final DateTime date;
}

class RaceTimelineRow extends TimelineRow {
  const RaceTimelineRow(this.race);

  final RaceEntity race;
}

class NowDividerTimelineRow extends TimelineRow {
  const NowDividerTimelineRow(this.now);

  final DateTime now;
}

/// [races]（`datetime` 昇順）を日付見出し・レース行・NOWディバイダ行に組み立てる。
///
/// 当日（[now] の日付）のグループにのみ、既存の [nowDividerIndex] と同じ判定で
/// NOWディバイダを挿入する（それ以前の日は全件過去、それ以降の日は全件未来の
/// ため、境界は当日にしか生まれない）。
List<TimelineRow> buildTimelineRows(List<RaceEntity> races, DateTime now) {
  final rows = <TimelineRow>[];
  final today = dateOnly(now);
  var index = 0;
  while (index < races.length) {
    final date = dateOnly(raceDateTime(races[index]));
    final dayRaces = <RaceEntity>[];
    // PERF-026: 各日グループの先頭要素はループ突入前にdateとして既に計算済み
    // のため、ループ内では2件目以降のみ計算する（先頭の重複計算を回避）。
    while (index < races.length &&
        (dayRaces.isEmpty || dateOnly(raceDateTime(races[index])) == date)) {
      dayRaces.add(races[index]);
      index++;
    }
    rows.add(DateHeaderTimelineRow(date));
    final dividerIndex = date == today ? nowDividerIndex(dayRaces, now) : null;
    for (var i = 0; i < dayRaces.length; i++) {
      if (dividerIndex == i) rows.add(NowDividerTimelineRow(now));
      rows.add(RaceTimelineRow(dayRaces[i]));
    }
  }
  return rows;
}

/// [buildTimelineRows] の結果を当日境界で過去/未来に分割したもの。
///
/// [past] は「直近の過去が先頭」になるよう降順（`CustomScrollView` の
/// `center` sliverキーパターンで、過去側リストの index:0 が中央に最も近い
/// 要素になる仕様に合わせるため。technical-design.md §11.2）。
class TimelineRowSplit {
  const TimelineRowSplit({required this.past, required this.future});

  final List<TimelineRow> past;
  final List<TimelineRow> future;
}

TimelineRowSplit splitTimelineRows(List<RaceEntity> races, DateTime now) {
  final today = dateOnly(now);
  final pastRaces = <RaceEntity>[];
  final futureRaces = <RaceEntity>[];
  for (final race in races) {
    if (dateOnly(raceDateTime(race)).isBefore(today)) {
      pastRaces.add(race);
    } else {
      futureRaces.add(race);
    }
  }
  return TimelineRowSplit(
    past: buildTimelineRows(pastRaces, now).reversed.toList(),
    future: buildTimelineRows(futureRaces, now),
  );
}

/// [split] の中で NOW ディバイダの位置が次に変わりうる時刻を返す（PERF-006）。
///
/// NOW ディバイダは「今日」のレースの中にしか存在しない（それ以前の日は
/// 全件過去、それ以降の日は全件未来のため）。したがって [splitTimelineRows]
/// の結果は、以下のどちらかが起きるまで意味的に変化しない:
///
/// - 日付が変わる（`dateOnly(now)` が変化する。呼び出し側で判定する）
/// - 今日のレースのうち、現在のディバイダ直後（未挿入なら今日最初）の
///   レースの発走時刻に `now` が到達する
///
/// 今日のレースが無い、または今日のレースが全て消化済みの場合、その日の
/// 残り時間は位置が変わらないため `null` を返す。
@visibleForTesting
DateTime? nextDividerBoundary(TimelineRowSplit split, DateTime now) {
  final future = split.future;
  if (future.isEmpty) return null;

  final todayHeader = future.first;
  if (todayHeader is! DateHeaderTimelineRow ||
      todayHeader.date != dateOnly(now)) {
    return null; // 今日のレースが無い
  }

  RaceEntity? firstRaceToday;
  var afterDivider = false;
  for (final row in future.skip(1)) {
    if (row is DateHeaderTimelineRow) break; // 今日のグループ終端
    if (row is NowDividerTimelineRow) {
      afterDivider = true;
      continue;
    }
    if (row is RaceTimelineRow) {
      firstRaceToday ??= row.race;
      if (afterDivider) return raceDateTime(row.race);
    }
  }

  if (afterDivider) return null; // ディバイダより後に今日のレースが無い（今日最後）
  if (firstRaceToday == null) return null; // 今日のレースが無い（防御的フォールバック）

  final firstRaceTime = raceDateTime(firstRaceToday);
  // ディバイダ未挿入 = 今日の全レースが未発走（→ 最初のレース時刻が次の境界）
  // または全レースが消化済み（→ これ以上変化しない）のいずれか。
  return firstRaceTime.isAfter(now) ? firstRaceTime : null;
}

/// [splitTimelineRows] の結果をメモ化するキャッシュ（PERF-006）。
///
/// `now`（`nowProvider` により30秒毎に発火）が変わっても、実データ
/// （[races]）が同一で、かつ NOW ディバイダの位置が変わりうる次の境界時刻
/// （[nextDividerBoundary]）にまだ到達していなければ、前回の計算結果を
/// そのまま返す。全期間タイムライン（複数月分のレースを保持しうる）で、
/// 意味のある変化が無いのに毎tick O(n) の再構築が走るのを避けるための
/// 仕組み（呼び出し側の再構築要否判定にも [isFreshFor] として利用できる。
/// PERF-016）。
class TimelineRowSplitCache {
  List<RaceEntity>? _races;
  DateTime? _today;
  DateTime? _validUntil;
  TimelineRowSplit? _split;

  /// [races]・[now] に対して現在のキャッシュがそのまま使えるか
  /// （＝[resolve] を呼んでも再計算が発生しないか）を返す。
  bool isFresh(List<RaceEntity> races, DateTime now) {
    return _split != null &&
        identical(_races, races) &&
        _today == dateOnly(now) &&
        (_validUntil == null || now.isBefore(_validUntil!));
  }

  /// 直前に [resolve] した時点のキャッシュが、データはそのままで [now] だけ
  /// 進んだ場合にまだ有効かどうか。[races] を保持していない呼び出し元
  /// （データ変化自体は別経路で検知できる場合）向けの軽量版。
  bool isFreshFor(DateTime now) {
    return _split != null &&
        _today == dateOnly(now) &&
        (_validUntil == null || now.isBefore(_validUntil!));
  }

  /// [races]・[now] に対応する分割結果を返す。可能な限りキャッシュを再利用する。
  TimelineRowSplit resolve(List<RaceEntity> races, DateTime now) {
    if (isFresh(races, now)) return _split!;

    final split = splitTimelineRows(races, now);
    _races = races;
    _today = dateOnly(now);
    _split = split;
    _validUntil = nextDividerBoundary(split, now);
    return split;
  }
}
