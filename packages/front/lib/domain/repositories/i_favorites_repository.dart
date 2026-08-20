/// お気に入り登録レースID集合の永続化インターフェース（technical-design.md §6）。
///
/// アカウント同期（サーバー側保存、[RemoteFavoritesRepository]）と端末ローカル
/// （[LocalFavoritesRepository]）の両方を同じ形で扱えるよう、実装詳細を隠蔽する。
/// サーバー保存は必ず非同期のため、読み込みも `Future` で統一する。保存は
/// 失敗しうる（QSTATE-02）ため `Future<bool>` で結果を返す。
abstract class IFavoritesRepository {
  /// 保存済みのお気に入りレースID集合を読み込む。
  Future<Set<String>> loadFavoriteRaceIds();

  /// お気に入りレースID集合を保存し、成功したかどうかを返す（QSTATE-02:
  /// 呼び出し側が保存失敗を検知してUIへ伝えられるようにする）。
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds);
}
