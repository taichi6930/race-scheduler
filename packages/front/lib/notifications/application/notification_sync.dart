import '../../domain/entities/grade_tier.dart';
import '../../domain/entities/race_entity.dart';
import '../../domain/entities/race_type.dart';

/// [races] のうち、重賞（`isCalendarSpecified`）のレースだけを返す。
///
/// 「重賞は自動で通知」（screens.md §5-1）の対象抽出に使う。
/// 重賞判定はAPI算出値（`RaceEntity.isCalendarSpecified`）を優先し、
/// 未設定の場合のみグレード文字列からのフォールバック判定を行う。
List<RaceEntity> specifiedGradeRacesFor(List<RaceEntity> races) {
  return races.where((race) {
    final raceType = RaceType.fromValue(race.raceType);
    return race.isCalendarSpecified ??
        isCalendarSpecifiedGrade(raceType, race.raceGrade, race.raceStage);
  }).toList();
}

/// [races] のうち、前回の通知スケジュール時（[previousRaces]）から
/// 新規追加された、または内容が変わったレースだけを返す（PERF-029/030）。
///
/// お気に入り一覧・「重賞は自動で通知」対象一覧は、内容が変わっていなくても
/// 元データのproviderが再emitされるたびに全件が渡ってくる。無条件で
/// 毎回 `scheduleRaceNotification` を呼ぶとネイティブ通知チャネルへの
/// 無駄な呼び出しが多発するため、`raceId` で対応付けた上で
/// [RaceEntity]（Freezed生成の全フィールド比較 `==`）が変化した
/// レースだけに絞り込む。[previousRaces] が null（初回）の場合は
/// 全件を「新規」として返す。
List<RaceEntity> racesNeedingReschedule(
  List<RaceEntity> races,
  List<RaceEntity>? previousRaces,
) {
  if (previousRaces == null) return races;
  final previousById = {for (final race in previousRaces) race.raceId: race};
  return races.where((race) => previousById[race.raceId] != race).toList();
}
