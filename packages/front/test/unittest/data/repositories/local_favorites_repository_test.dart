// LocalFavoritesRepository のデシジョンテーブル
//
// | ID   | 操作                                | 期待                                    |
// | ---- | ----------------------------------- | ---------------------------------------- |
// | T-01 | 未保存状態で loadFavoriteRaceIds    | 空集合を返す                            |
// | T-02 | saveFavoriteRaceIds → loadFavoriteRaceIds | 保存した集合がそのまま読み出せる  |
// | T-03 | 空集合を saveFavoriteRaceIds        | 保存後の load は空集合                  |
//
// QSTATE-02: 保存結果の返り値のデシジョンテーブル
//
// | ID   | 操作                                          | 期待                     |
// | ---- | --------------------------------------------- | -------------------------- |
// | T-04 | 書き込み成功時に saveFavoriteRaceIds          | true を返す                |
// | T-05 | 書き込み失敗時（ストレージ書き込み不可）に saveFavoriteRaceIds | false を返す（例外にはしない） |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/repositories/local_favorites_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';

/// [SharedPreferencesStorePlatform] の書き込みが常に失敗する状況を再現する
/// フェイク（QSTATE-02の回帰テスト用）。setMockInitialValuesが使う
/// InMemorySharedPreferencesStore をベースに setValue のみ失敗させる。
class _WriteFailingSharedPreferencesStore
    extends InMemorySharedPreferencesStore {
  _WriteFailingSharedPreferencesStore() : super.empty();

  @override
  Future<bool> setValue(String valueType, String key, Object value) async =>
      false;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('LocalFavoritesRepository', () {
    test('[T-01] 未保存状態_loadFavoriteRaceIdsは空集合を返す', () async {
      final prefs = await SharedPreferences.getInstance();
      final repository = LocalFavoritesRepository(prefs);

      expect(await repository.loadFavoriteRaceIds(), isEmpty);
    });

    test('[T-02] 保存した集合がそのまま読み出せる', () async {
      final prefs = await SharedPreferences.getInstance();
      final repository = LocalFavoritesRepository(prefs);

      await repository.saveFavoriteRaceIds({'race-001', 'race-002'});

      expect(
        await repository.loadFavoriteRaceIds(),
        equals({'race-001', 'race-002'}),
      );
    });

    test('[T-03] 空集合を保存_loadは空集合を返す', () async {
      final prefs = await SharedPreferences.getInstance();
      final repository = LocalFavoritesRepository(prefs);

      await repository.saveFavoriteRaceIds({'race-001'});
      await repository.saveFavoriteRaceIds({});

      expect(await repository.loadFavoriteRaceIds(), isEmpty);
    });

    test('[T-04] 書き込み成功時_trueを返す', () async {
      final prefs = await SharedPreferences.getInstance();
      final repository = LocalFavoritesRepository(prefs);

      final succeeded = await repository.saveFavoriteRaceIds({'race-001'});

      expect(succeeded, isTrue);
    });

    test('[T-05] 書き込み失敗時_falseを返す', () async {
      // QSTATE-02回帰: 以前は persistWrite の結果を捨てて void を返していた
      // ため、この失敗が呼び出し側に一切伝わらなかった。
      SharedPreferencesStorePlatform.instance =
          _WriteFailingSharedPreferencesStore();
      final prefs = await SharedPreferences.getInstance();
      final repository = LocalFavoritesRepository(prefs);

      final succeeded = await repository.saveFavoriteRaceIds({'race-001'});

      expect(succeeded, isFalse);
    });
  });
}
