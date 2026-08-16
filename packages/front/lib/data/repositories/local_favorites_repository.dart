import 'package:shared_preferences/shared_preferences.dart';

import '../../core/persist_write.dart';
import '../../domain/repositories/i_favorites_repository.dart';

/// SharedPreferences に保存するキー。
const kFavoriteRaceIdsPrefsKey = 'favorite_race_ids';

/// [IFavoritesRepository] の端末ローカル実装（`shared_preferences`）。
class LocalFavoritesRepository implements IFavoritesRepository {
  LocalFavoritesRepository(this._prefs);

  final SharedPreferences _prefs;

  @override
  Set<String> loadFavoriteRaceIds() {
    return (_prefs.getStringList(kFavoriteRaceIdsPrefsKey) ?? const <String>[])
        .toSet();
  }

  @override
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds) {
    // QSTATE-02: persistWrite の結果（成功/失敗）を握りつぶさずそのまま返す。
    // 以前は捨てていたため、保存失敗（ストレージ容量不足等）が誰にも
    // 気づかれず、★の表示だけがONのまま実際には永続化されていなかった。
    return persistWrite(
      () => _prefs.setStringList(kFavoriteRaceIdsPrefsKey, raceIds.toList()),
    );
  }
}
