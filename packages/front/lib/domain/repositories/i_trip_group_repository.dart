import '../entities/trip_group_entity.dart';

/// 旅程グループ候補日検出結果（`GET /trip-group`）を取得するリポジトリ。
abstract class ITripGroupRepository {
  /// 全旅程グループ分の候補日検出結果を取得する。
  ///
  /// [lookaheadDays] は検索対象期間（今日から何日先まで）、
  /// [toleranceDays] は「連日」とみなす最大日数差。
  /// いずれも省略時はバックエンド側のデフォルト値（180日・2日）が使われる。
  Future<List<TripGroupEntity>> getAll({
    int? lookaheadDays,
    int? toleranceDays,
  });
}
