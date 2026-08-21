// filterUpcomingFavoriteRaces / UpcomingFavoritesCache のデシジョンテーブル
//
// | ID   | 対象                    | 条件                                          | 期待                     |
// | ---- | ----------------------- | --------------------------------------------- | -------------------------- |
// | T-01 | filterUpcomingFavoriteRaces | お気に入り登録済み＋未発走                | 結果に含まれる            |
// | T-02 | filterUpcomingFavoriteRaces | お気に入り登録済み＋発走済み（過去）      | 結果に含まれない          |
// | T-03 | filterUpcomingFavoriteRaces | お気に入り未登録                          | 結果に含まれない          |
// | T-04 | filterUpcomingFavoriteRaces | 複数のお気に入り                          | 発走時刻昇順で返る        |
// | T-05 | UpcomingFavoritesCache      | races・favoriteIds同一・先頭の発走時刻未到達 | 同一インスタンスを再利用   |
// | T-06 | UpcomingFavoritesCache      | racesが変化                               | 再計算される              |
// | T-07 | UpcomingFavoritesCache      | favoriteIdsが変化                         | 再計算される              |
// | T-08 | UpcomingFavoritesCache      | nowが結果先頭の発走時刻に到達             | 再計算される              |
// | T-09 | UpcomingFavoritesCache      | 結果が空（該当お気に入り無し）            | nowが進んでも再利用される  |
// | T-10 | filterUpcomingFavoriteRaces | isWatched=trueだがfavoriteIdsに未登録（KPLAYER-07） | 結果に含まれる |
// | T-11 | filterUpcomingFavoriteRaces | isWatched=false・favoriteIdsにも未登録    | 結果に含まれない          |
// | T-12 | favoriteRacesRawProvider     | 未ログイン                                | 空リストを返しAPIを呼ばない |
// | T-13 | favoriteRacesRawProvider     | ログイン済み                              | APIを呼び結果を返す       |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/calendar_event_preview.dart';
import 'package:front/domain/entities/race_detail_ui.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/entities/race_player_entity.dart';
import 'package:front/domain/repositories/i_race_repository.dart';
import 'package:front/domain/usecases/get_races_by_date_range.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_races_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../support/session_test_overrides.dart';

final _now = DateTime(2026, 4, 19, 15, 35);

class _FixedFavoriteIdsNotifier extends FavoriteIdsNotifier {
  _FixedFavoriteIdsNotifier(this._initial);

  final Set<String> _initial;

  @override
  Set<String> build() => _initial;
}

class _CountingRaceRepository implements IRaceRepository {
  int callCount = 0;

  @override
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async {
    callCount++;
    return [_race(id: 'a', offsetFromNow: const Duration(minutes: 5))];
  }

  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async {
    throw UnimplementedError();
  }

  @override
  Future<RaceEntity?> getRaceDetail(String raceId) async => null;

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async {
    throw UnimplementedError();
  }

  @override
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId) async => [];
}

RaceEntity _race({
  required String id,
  required Duration offsetFromNow,
  bool? isWatched,
}) => RaceEntity(
  raceId: id,
  raceName: 'レース$id',
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: _now.add(offsetFromNow).toIso8601String(),
  raceNumber: 11,
  isWatched: isWatched,
);

void main() {
  group('filterUpcomingFavoriteRaces', () {
    test('[T-01] お気に入り登録済み_未発走_結果に含まれる', () {
      final upcoming = _race(
        id: 'a',
        offsetFromNow: const Duration(minutes: 5),
      );

      final result = filterUpcomingFavoriteRaces([upcoming], {'a'}, _now);

      expect(result.map((r) => r.raceId), ['a']);
    });

    test('[T-02] お気に入り登録済み_発走済み_結果に含まれない', () {
      final past = _race(id: 'a', offsetFromNow: const Duration(hours: -1));

      final result = filterUpcomingFavoriteRaces([past], {'a'}, _now);

      expect(result, isEmpty);
    });

    test('[T-03] お気に入り未登録_結果に含まれない', () {
      final upcoming = _race(
        id: 'a',
        offsetFromNow: const Duration(minutes: 5),
      );

      final result = filterUpcomingFavoriteRaces([upcoming], {}, _now);

      expect(result, isEmpty);
    });

    test('[T-04] 複数のお気に入り_発走時刻昇順で返る', () {
      final later = _race(id: 'later', offsetFromNow: const Duration(hours: 2));
      final sooner = _race(
        id: 'sooner',
        offsetFromNow: const Duration(minutes: 10),
      );

      final result = filterUpcomingFavoriteRaces(
        [later, sooner],
        {'later', 'sooner'},
        _now,
      );

      expect(result.map((r) => r.raceId).toList(), ['sooner', 'later']);
    });

    test('[T-10] isWatched=trueだがfavoriteIdsに未登録_結果に含まれる', () {
      final watched = _race(
        id: 'w',
        offsetFromNow: const Duration(minutes: 5),
        isWatched: true,
      );

      final result = filterUpcomingFavoriteRaces([watched], {}, _now);

      expect(result.map((r) => r.raceId), ['w']);
    });

    test('[T-11] isWatched=false_favoriteIdsにも未登録_結果に含まれない', () {
      final plain = _race(
        id: 'p',
        offsetFromNow: const Duration(minutes: 5),
        isWatched: false,
      );

      final result = filterUpcomingFavoriteRaces([plain], {}, _now);

      expect(result, isEmpty);
    });
  });

  group('UpcomingFavoritesCache', () {
    test('[T-05] races_favoriteIds同一_先頭の発走時刻未到達_同一インスタンスを再利用する', () {
      final races = [
        _race(id: 'a', offsetFromNow: const Duration(minutes: 30)),
      ];
      final favoriteIds = {'a'};
      final cache = UpcomingFavoritesCache();

      final first = cache.resolve(races, favoriteIds, _now);
      final second = cache.resolve(
        races,
        favoriteIds,
        _now.add(const Duration(seconds: 30)),
      );

      expect(identical(first, second), isTrue);
    });

    test('[T-06] racesが変化_再計算される', () {
      final racesA = [
        _race(id: 'a', offsetFromNow: const Duration(minutes: 30)),
      ];
      final racesB = [
        _race(id: 'a', offsetFromNow: const Duration(minutes: 30)),
      ];
      final favoriteIds = {'a'};
      final cache = UpcomingFavoritesCache();

      final first = cache.resolve(racesA, favoriteIds, _now);
      final second = cache.resolve(racesB, favoriteIds, _now);

      expect(identical(first, second), isFalse);
    });

    test('[T-07] favoriteIdsが変化_再計算される', () {
      final races = [
        _race(id: 'a', offsetFromNow: const Duration(minutes: 30)),
        _race(id: 'b', offsetFromNow: const Duration(minutes: 40)),
      ];
      final cache = UpcomingFavoritesCache();

      final first = cache.resolve(races, {'a'}, _now);
      final second = cache.resolve(races, {'a', 'b'}, _now);

      expect(identical(first, second), isFalse);
      expect(second.map((r) => r.raceId), ['a', 'b']);
    });

    test('[T-08] nowが結果先頭の発走時刻に到達_再計算される', () {
      final races = [
        _race(id: 'a', offsetFromNow: const Duration(minutes: 5)),
      ];
      final favoriteIds = {'a'};
      final cache = UpcomingFavoritesCache();

      final first = cache.resolve(races, favoriteIds, _now);
      final second = cache.resolve(
        races,
        favoriteIds,
        _now.add(const Duration(minutes: 5, seconds: 1)),
      );

      expect(identical(first, second), isFalse);
      expect(second, isEmpty); // 発走時刻を過ぎたため対象から外れる
    });

    test('[T-09] 結果が空_該当お気に入り無し_nowが進んでも再利用される', () {
      final races = [
        _race(id: 'other', offsetFromNow: const Duration(minutes: 5)),
      ];
      final favoriteIds = {'a'};
      final cache = UpcomingFavoritesCache();

      final first = cache.resolve(races, favoriteIds, _now);
      final second = cache.resolve(
        races,
        favoriteIds,
        _now.add(const Duration(days: 1)),
      );

      expect(identical(first, second), isTrue);
      expect(first, isEmpty);
    });
  });

  group('favoriteRacesRawProvider', () {
    late SharedPreferences prefs;
    late _CountingRaceRepository repository;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
      repository = _CountingRaceRepository();
      if (getIt.isRegistered<GetRacesByDateRangeUseCase>()) {
        getIt.unregister<GetRacesByDateRangeUseCase>();
      }
      getIt.registerSingleton<GetRacesByDateRangeUseCase>(
        GetRacesByDateRangeUseCase(repository),
      );
    });

    tearDown(() {
      getIt.unregister<GetRacesByDateRangeUseCase>();
    });

    test('[T-12] 未ログイン_空リストを返しAPIを呼ばない', () async {
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      final races = await container.read(favoriteRacesRawProvider.future);

      expect(races, isEmpty);
      expect(repository.callCount, 0);
    });

    test('[T-13] ログイン済み_APIを呼び結果を返す', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          loggedInSessionOverride(),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier({'a'}),
          ),
        ],
      );
      addTearDown(container.dispose);

      final races = await container.read(favoriteRacesRawProvider.future);

      expect(races.map((r) => r.raceId), ['a']);
      expect(repository.callCount, 1);
    });
  });
}
