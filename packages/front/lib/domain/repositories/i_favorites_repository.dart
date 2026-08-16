/// お気に入り登録レースID集合の永続化インターフェース（technical-design.md §6）。
///
/// 将来のアカウント同期（サーバ側保存）に備え、実装詳細（現状は端末ローカル）を
/// 隠蔽する。読み込みは同期的に完結するため Future を介さないが、保存は
/// 失敗しうる（QSTATE-02）ため `Future<bool>` で結果を返す。
abstract class IFavoritesRepository {
  /// 保存済みのお気に入りレースID集合を読み込む。
  Set<String> loadFavoriteRaceIds();

  /// お気に入りレースID集合を保存し、成功したかどうかを返す（QSTATE-02:
  /// 呼び出し側が保存失敗を検知してUIへ伝えられるようにする）。
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds);
}
