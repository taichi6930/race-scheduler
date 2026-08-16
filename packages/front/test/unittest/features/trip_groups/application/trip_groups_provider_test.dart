// tripGroupsProvider / findTripGroupById のデシジョンテーブル
//
// | ID   | 条件                                              | 期待                                    |
// | ---- | ------------------------------------------------- | ------------------------------------------ |
// | T-01 | repositoryが正常にグループ一覧を返す               | providerの結果に反映される               |
// | T-02 | settingsのtripToleranceDays/tripLookaheadDays      | repository.getAllにそのまま渡される      |
// | T-03 | settings変更後                                     | repositoryへ再度、新しい値で問い合わせる |
// | T-04 | findTripGroupById: 該当グループが存在する          | そのグループを返す                       |
// | T-05 | findTripGroupById: 該当グループが存在しない        | nullを返す                               |
// | T-06 | findTripGroupById: groupsがnull（未取得）          | nullを返す                               |
// | T-07 | TTL（15分）経過                                    | settingsが変わらなくても再度問い合わせる |

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/trip_group_course_entity.dart';
import 'package:front/domain/entities/trip_group_entity.dart';
import 'package:front/domain/repositories/i_trip_group_repository.dart';
import 'package:front/features/settings/application/settings_provider.dart';
import 'package:front/features/trip_groups/application/trip_groups_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeTripGroupRepository implements ITripGroupRepository {
  _FakeTripGroupRepository(this.groups);

  final List<TripGroupEntity> groups;
  int? requestedLookaheadDays;
  int? requestedToleranceDays;
  int callCount = 0;

  @override
  Future<List<TripGroupEntity>> getAll({
    int? lookaheadDays,
    int? toleranceDays,
  }) async {
    callCount++;
    requestedLookaheadDays = lookaheadDays;
    requestedToleranceDays = toleranceDays;
    return groups;
  }
}

TripGroupEntity _group(String id) => TripGroupEntity(
  id: id,
  name: 'グループ$id',
  courses: const [
    TripGroupCourseEntity(raceType: 'nar', raceCourse: '水沢', placeCode: '11'),
  ],
  heldDates: const ['2026-08-01'],
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer(
    _FakeTripGroupRepository fakeRepository,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        tripGroupRepositoryProvider.overrideWithValue(fakeRepository),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('tripGroupsProvider', () {
    test('[T-01] repositoryが正常に返す_providerの結果に反映される', () async {
      final fakeRepository = _FakeTripGroupRepository([_group('mizusawa')]);
      final container = await buildContainer(fakeRepository);

      final result = await container.read(tripGroupsProvider.future);

      expect(result.map((g) => g.id), ['mizusawa']);
    });

    test('[T-02] settingsの値がrepository.getAllにそのまま渡される', () async {
      final fakeRepository = _FakeTripGroupRepository([]);
      final container = await buildContainer(fakeRepository);

      await container.read(tripGroupsProvider.future);

      expect(fakeRepository.requestedLookaheadDays, kDefaultTripLookaheadDays);
      expect(fakeRepository.requestedToleranceDays, kDefaultTripToleranceDays);
    });

    test('[T-03] settings変更後_新しい値で再度問い合わせる', () async {
      final fakeRepository = _FakeTripGroupRepository([]);
      final container = await buildContainer(fakeRepository);
      await container.read(tripGroupsProvider.future);
      expect(fakeRepository.callCount, 1);

      container.read(settingsProvider.notifier).setTripToleranceDays(5);
      final result = await container.read(tripGroupsProvider.future);

      expect(result, isEmpty);
      expect(fakeRepository.callCount, 2);
      expect(fakeRepository.requestedToleranceDays, 5);
    });

    test('[T-07] TTL（15分）経過_settingsが変わらなくても再度問い合わせる', () async {
      final prefs = await SharedPreferences.getInstance();
      final fakeRepository = _FakeTripGroupRepository([]);

      fakeAsync((async) {
        final container = ProviderContainer(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            tripGroupRepositoryProvider.overrideWithValue(fakeRepository),
          ],
        );
        addTearDown(container.dispose);

        container.read(tripGroupsProvider);
        async.flushMicrotasks();
        expect(fakeRepository.callCount, 1);

        async.elapse(const Duration(minutes: 15));
        container.read(tripGroupsProvider);
        async.flushMicrotasks();

        expect(fakeRepository.callCount, 2);
      });
    });
  });

  group('findTripGroupById', () {
    test('[T-04] 該当グループが存在する_そのグループを返す', () {
      final groups = [_group('a'), _group('b')];

      final found = findTripGroupById(groups, 'b');

      expect(found?.id, 'b');
    });

    test('[T-05] 該当グループが存在しない_nullを返す', () {
      final groups = [_group('a')];

      final found = findTripGroupById(groups, 'unknown');

      expect(found, isNull);
    });

    test('[T-06] groupsがnull_nullを返す', () {
      final found = findTripGroupById(null, 'a');

      expect(found, isNull);
    });
  });
}
