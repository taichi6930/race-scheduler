// calendarEventPreviewProvider のデシジョンテーブル
//
// | ID   | 対象                        | 条件                                    | 期待                                                    |
// | ---- | --------------------------- | ---------------------------------------- | --------------------------------------------------------- |
// | T-01 | calendarEventPreviewProvider | 正常系                                   | IRaceRepository.getCalendarEventPreviewの戻り値をそのまま返す |
// | T-03 | calendarEventUrlProvider     | 共通providerの取得が失敗                 | クライアント側フォールバックURLを返す（挙動を変更しない）  |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/domain/entities/calendar_event_preview.dart';
import 'package:front/domain/entities/race_detail_ui.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/entities/race_link.dart';
import 'package:front/domain/entities/race_player_entity.dart';
import 'package:front/domain/repositories/i_race_repository.dart';
import 'package:front/features/timeline/application/calendar_event_preview_provider.dart';
import 'package:front/features/timeline/application/calendar_event_url_provider.dart';

class _CountingRaceRepository implements IRaceRepository {
  _CountingRaceRepository(this.preview);

  final CalendarEventPreview preview;
  int callCount = 0;

  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async {
    callCount++;
    return preview;
  }

  @override
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async => [];

  @override
  Future<RaceEntity?> getRaceDetail(String raceId) async => null;

  @override
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId) async => [];

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async =>
      const RaceDetailUi(schemaVersion: 1, sections: []);
}

class _ThrowingRaceRepository implements IRaceRepository {
  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async {
    throw Exception('network error');
  }

  @override
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async => [];

  @override
  Future<RaceEntity?> getRaceDetail(String raceId) async => null;

  @override
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId) async => [];

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async {
    throw Exception('network error');
  }
}

const _preview = CalendarEventPreview(
  summary: 'APIプレビュー タイトル',
  description: '発走: 15:40',
  location: 'API会場',
  startDateTime: '2026-04-19T15:40:00+09:00',
  endDateTime: '2026-04-19T15:50:00+09:00',
  links: [
    RaceLink(label: 'レース情報(netkeiba)', url: 'https://netkeiba.example/info'),
  ],
);

RaceEntity _race({required String id}) => RaceEntity(
  raceId: id,
  raceName: '皐月賞',
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00+09:00',
  raceNumber: 11,
);

void main() {
  tearDown(() {
    if (getIt.isRegistered<IRaceRepository>()) {
      getIt.unregister<IRaceRepository>();
    }
  });

  test('[T-01] 正常系_getCalendarEventPreviewの戻り値をそのまま返す', () async {
    final repo = _CountingRaceRepository(_preview);
    getIt.registerSingleton<IRaceRepository>(repo);
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final result = await container.read(
      calendarEventPreviewProvider('race-001').future,
    );

    expect(result, _preview);
    expect(repo.callCount, 1);
  });

  test('[T-03] calendarEventUrlProvider_共通providerの取得が失敗_'
      'クライアント側フォールバックURLを返す', () async {
    getIt.registerSingleton<IRaceRepository>(_ThrowingRaceRepository());
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final race = _race(id: 'race-002');

    final url = await container.read(
      calendarEventUrlProvider(CalendarEventRaceKey(race)).future,
    );

    expect(url.host, 'calendar.google.com');
    expect(url.queryParameters['text'], race.raceName);
    expect(url.queryParameters['location'], race.raceCourse);
  });
}
