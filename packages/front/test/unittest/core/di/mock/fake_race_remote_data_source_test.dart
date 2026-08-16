// FakeRaceRemoteDataSource のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                       |
// | ---- | ------------------------------------------- | -------------------------------------------- |
// | T-01 | getRacesByDateRange, 単日・raceTypeList=all | 指定日のレースのみ返す（範囲外は含まない）  |
// | T-02 | getRacesByDateRange, raceTypeListを1種別に絞る | 指定種別以外のレースが含まれない          |
// | T-03 | getCalendarEventPreview, 実在するraceId     | レース名・開催地を含むプレビューを返す      |
// | T-04 | getCalendarEventPreview, 存在しないraceId   | 例外を送出する                              |
// | T-05 | getRaceDetailUi, 実在するJRAのraceId        | kv/links/playersセクションを含み、playersは空 |
// | T-06 | getRaceDetailUi, 存在しないraceId           | 例外を送出する                              |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/mock/fake_race_remote_data_source.dart';
import 'package:front/core/di/mock/mock_race_fixtures.dart';
import 'package:front/domain/entities/race_detail_ui.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  final anchor = DateTime(2026, 4, 19);
  late FakeRaceRemoteDataSource dataSource;

  setUp(() {
    dataSource = FakeRaceRemoteDataSource(
      generator: MockScheduleGenerator(anchor: anchor),
    );
  });

  test('[T-01] 単日・raceTypeList=all_指定日のレースのみ返す', () async {
    final races = await dataSource.getRacesByDateRange(
      startDate: '2026-04-19',
      finishDate: '2026-04-19',
      raceTypeList: RaceType.all.map((t) => t.value).toList(),
    );

    expect(races, isNotEmpty);
    for (final race in races) {
      final dateTime = DateTime.parse(race.datetime);
      expect(dateTime.year, 2026);
      expect(dateTime.month, 4);
      expect(dateTime.day, 19);
    }
  });

  test('[T-02] raceTypeListを1種別に絞る_指定種別以外が含まれない', () async {
    final races = await dataSource.getRacesByDateRange(
      startDate: '2026-04-01',
      finishDate: '2026-04-30',
      raceTypeList: const ['jra'],
    );

    expect(races, isNotEmpty);
    expect(races.every((race) => race.raceType == 'jra'), isTrue);
  });

  test('[T-03] 実在するraceId_レース名・開催地を含むプレビューを返す', () async {
    final races = await dataSource.getRacesByDateRange(
      startDate: '2026-04-19',
      finishDate: '2026-04-19',
      raceTypeList: const ['jra'],
    );
    final raceId = races.first.raceId;

    final preview = await dataSource.getCalendarEventPreview(raceId);

    expect(preview.summary, races.first.raceName);
    expect(preview.location, races.first.raceCourse);
  });

  test('[T-04] 存在しないraceId_例外を送出する', () async {
    expect(
      () => dataSource.getCalendarEventPreview('no-such-race-id'),
      throwsA(isA<Exception>()),
    );
  });

  test(
    '[T-05] getRaceDetailUi_実在するJRAのraceId_kv_links_playersを含みplayersは空',
    () async {
      final races = await dataSource.getRacesByDateRange(
        startDate: '2026-04-19',
        finishDate: '2026-04-19',
        raceTypeList: const ['jra'],
      );
      final raceId = races.first.raceId;

      final model = await dataSource.getRaceDetailUi(raceId);

      expect(model.entity.schemaVersion, 1);
      expect(model.entity.sections, hasLength(3));
      final kvSection = model.entity.sections[0] as RaceDetailKvSection;
      expect(kvSection.rows.any((row) => row.label == '会場'), isTrue);
      final playersSection =
          model.entity.sections[2] as RaceDetailPlayersSection;
      expect(playersSection.watchToggle, isFalse);
      expect(playersSection.players, isEmpty);
    },
  );

  test('[T-06] getRaceDetailUi_存在しないraceId_例外を送出する', () async {
    expect(
      () => dataSource.getRaceDetailUi('no-such-race-id'),
      throwsA(isA<Exception>()),
    );
  });
}
