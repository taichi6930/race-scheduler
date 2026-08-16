// TripGroupRepositoryImpl.getAll のデシジョンテーブル
//
// | ID   | 条件                                              | 期待                                                        |
// | ---- | -------------------------------------------------- | ------------------------------------------------------------- |
// | T-01 | fetchAll                                          | tripGroupMasterListと同じ件数を返す                          |
// | T-02 | 単独グループ(mizusawa)、該当開催あり              | heldDatesを返す（candidatesはnull）                          |
// | T-03 | 複数会場グループ(kyushu-1、3raceType混在)          | raceTypeごとに1回ずつgetPlacesByDateRangeを呼び分ける        |
// | T-04 | 2会場が同日開催(kochi)                            | candidatesに1件の候補が入る                                  |
// | T-05 | 該当開催が1件もない                               | 単独グループはheldDates=[]、複数会場グループはcandidates=[]  |
// | T-06 | lookaheadDays/toleranceDaysを指定                 | 指定した検索期間・許容日数がそのまま使われる                  |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/repositories/trip_group_repository_impl.dart';
import 'package:front/domain/entities/place_entity.dart';
import 'package:front/domain/entities/trip_group_master.dart';
import 'package:front/domain/repositories/i_place_repository.dart';

class _CapturedFetch {
  _CapturedFetch({
    required this.startDate,
    required this.finishDate,
    required this.raceTypeList,
    required this.locationList,
  });

  final String startDate;
  final String finishDate;
  final List<String> raceTypeList;
  final List<String>? locationList;
}

class _FakePlaceRepository implements IPlaceRepository {
  _FakePlaceRepository(this._placesByRaceType);

  final Map<String, List<PlaceEntity>> _placesByRaceType;
  final List<_CapturedFetch> capturedFetches = [];

  @override
  Future<List<PlaceEntity>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  }) async {
    capturedFetches.add(
      _CapturedFetch(
        startDate: startDate,
        finishDate: finishDate,
        raceTypeList: raceTypeList,
        locationList: locationList,
      ),
    );
    return _placesByRaceType[raceTypeList.single] ?? [];
  }

  @override
  Future<PlaceEntity?> getPlaceDetail(String placeId) async => null;
}

PlaceEntity _buildPlace({
  required String raceType,
  required String datetime,
  required String locationCode,
}) => PlaceEntity(
  placeId: 'place-$raceType-$locationCode-$datetime',
  raceType: raceType,
  raceCourse: 'テスト場',
  locationCode: locationCode,
  datetime: datetime,
);

void main() {
  group('TripGroupRepositoryImpl.getAll', () {
    test('[T-01] fetchAll_tripGroupMasterListと同じ件数を返す', () async {
      final repository = TripGroupRepositoryImpl(
        placeRepository: _FakePlaceRepository(const {}),
      );

      final result = await repository.getAll(
        lookaheadDays: 180,
        toleranceDays: 2,
      );

      expect(result, hasLength(tripGroupMasterList.length));
    });

    test('[T-02] 単独グループ_該当開催あり_heldDatesを返しcandidatesはnull', () async {
      final placeRepository = _FakePlaceRepository({
        'nar': [
          _buildPlace(
            raceType: 'nar',
            datetime: '2026-08-01T10:00:00+09:00',
            locationCode: '11',
          ),
        ],
      });
      final repository = TripGroupRepositoryImpl(
        placeRepository: placeRepository,
      );

      final result = await repository.getAll(
        lookaheadDays: 180,
        toleranceDays: 2,
      );

      final mizusawa = result.firstWhere((g) => g.id == 'mizusawa');
      expect(mizusawa.heldDates, ['2026-08-01']);
      expect(mizusawa.candidates, isNull);
    });

    test(
      '[T-03] 複数会場グループ_3raceType混在_raceTypeごとに1回ずつ呼び分ける',
      () async {
        final placeRepository = _FakePlaceRepository(const {});
        final repository = TripGroupRepositoryImpl(
          placeRepository: placeRepository,
        );

        await repository.getAll(lookaheadDays: 180, toleranceDays: 2);

        final kyushu1Fetches = placeRepository.capturedFetches
            .where((f) => f.raceTypeList.single == 'jra')
            .toList();
        expect(kyushu1Fetches, isNotEmpty);
        for (final fetch in placeRepository.capturedFetches) {
          expect(fetch.raceTypeList, hasLength(1));
        }
      },
    );

    test('[T-04] 2会場が同日開催(kochi)_candidatesに1件の候補が入る', () async {
      final placeRepository = _FakePlaceRepository({
        'nar': [
          _buildPlace(
            raceType: 'nar',
            datetime: '2026-08-01T10:00:00+09:00',
            locationCode: '31',
          ),
        ],
        'keirin': [
          _buildPlace(
            raceType: 'keirin',
            datetime: '2026-08-01T12:00:00+09:00',
            locationCode: '74',
          ),
        ],
      });
      final repository = TripGroupRepositoryImpl(
        placeRepository: placeRepository,
      );

      final result = await repository.getAll(
        lookaheadDays: 180,
        toleranceDays: 2,
      );

      final kochi = result.firstWhere((g) => g.id == 'kochi');
      expect(kochi.heldDates, isNull);
      expect(kochi.candidates, hasLength(1));
      expect(kochi.candidates!.first.startDate, '2026-08-01');
      expect(kochi.candidates!.first.endDate, '2026-08-01');
      expect(kochi.candidates!.first.courses, hasLength(2));
    });

    test(
      '[T-05] 該当開催が1件もない_単独グループはheldDates空_複数会場はcandidates空',
      () async {
        final repository = TripGroupRepositoryImpl(
          placeRepository: _FakePlaceRepository(const {}),
        );

        final result = await repository.getAll(
          lookaheadDays: 180,
          toleranceDays: 2,
        );

        final mizusawa = result.firstWhere((g) => g.id == 'mizusawa');
        final kochi = result.firstWhere((g) => g.id == 'kochi');
        expect(mizusawa.heldDates, isEmpty);
        expect(kochi.candidates, isEmpty);
      },
    );

    test('[T-06] lookaheadDays_toleranceDaysを指定_検索期間に反映される', () async {
      final placeRepository = _FakePlaceRepository(const {});
      final repository = TripGroupRepositoryImpl(
        placeRepository: placeRepository,
      );

      await repository.getAll(lookaheadDays: 30, toleranceDays: 3);

      final first = placeRepository.capturedFetches.first;
      final start = DateTime.parse(first.startDate);
      final finish = DateTime.parse(first.finishDate);
      expect(finish.difference(start).inDays, 30);
    });
  });
}
