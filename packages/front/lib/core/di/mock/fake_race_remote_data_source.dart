import '../../../data/datasources/race_remote_data_source.dart';
import '../../../data/models/calendar_event_preview_model.dart';
import '../../../data/models/race_detail_ui_model.dart';
import '../../../data/models/race_model.dart';
import '../../../data/models/race_player_model.dart';
import '../../../design/atoms/discipline_icon.dart';
import '../../../domain/entities/race_detail_ui.dart';
import '../../../domain/entities/race_link.dart';
import '../../../domain/entities/race_type.dart';
import 'mock_network_delay.dart';
import 'mock_race_fixtures.dart';

/// バックエンドに接続せず、固定生成データのみで動作する [IRaceRemoteDataSource]。
///
/// モックモード（`main_mock.dart`）専用。過去30日〜未来60日分のレースを
/// 起動時に一度だけ生成し、以降は日付・種別でフィルタして返す。
class FakeRaceRemoteDataSource implements IRaceRemoteDataSource {
  FakeRaceRemoteDataSource({MockScheduleGenerator? generator})
    : _races = (generator ?? MockScheduleGenerator()).generateRaces(
        startOffset: -30,
        endOffset: 60,
      );

  final List<MockRaceFixture> _races;

  @override
  Future<List<RaceModel>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async {
    await mockNetworkDelay();
    final start = DateTime.parse(startDate);
    final finishExclusive = DateTime.parse(
      finishDate,
    ).add(const Duration(days: 1));
    return _races
        .where(
          (race) =>
              !race.dateTime.isBefore(start) &&
              race.dateTime.isBefore(finishExclusive) &&
              raceTypeList.contains(race.raceType.value),
        )
        .map((race) => race.toRaceModel())
        .toList();
  }

  @override
  Future<CalendarEventPreviewModel> getCalendarEventPreview(
    String raceId,
  ) async {
    await mockNetworkDelay();
    final race = _races.cast<MockRaceFixture?>().firstWhere(
      (r) => r?.raceId == raceId,
      orElse: () => null,
    );
    if (race == null) {
      throw Exception('Failed to load calendar event preview');
    }
    return CalendarEventPreviewModel(
      summary: race.raceName,
      description: '${race.raceCourse} ${race.raceNumber}R（モックデータ）',
      location: race.raceCourse,
      startDateTime: race.dateTime.toIso8601String(),
      endDateTime: race.dateTime
          .add(const Duration(minutes: 10))
          .toIso8601String(),
      links: const [RaceLink(label: '公式サイト（モック）', url: 'https://example.com')],
    );
  }

  @override
  Future<List<RacePlayerModel>> getRacePlayers(String raceId) async {
    await mockNetworkDelay();
    final race = _races.cast<MockRaceFixture?>().firstWhere(
      (r) => r?.raceId == raceId,
      orElse: () => null,
    );
    // KEIRIN以外は出走選手データを持たない（実バックエンドと同じ挙動）。
    if (race == null || race.raceType.value != 'keirin') {
      return const [];
    }
    return const [
      RacePlayerModel(
        carNumber: 1,
        frameNumber: 1,
        playerNo: '000001',
        playerName: '模擬　一郎',
        term: 100,
        branch: '東京',
      ),
      RacePlayerModel(
        carNumber: 2,
        frameNumber: 2,
        playerNo: '000002',
        playerName: '模擬　二郎',
        term: 105,
        branch: '大阪',
      ),
    ];
  }

  @override
  Future<RaceDetailUiModel> getRaceDetailUi(String raceId) async {
    await mockNetworkDelay();
    final race = _races.cast<MockRaceFixture?>().firstWhere(
      (r) => r?.raceId == raceId,
      orElse: () => null,
    );
    if (race == null) {
      throw Exception('Failed to load race detail UI');
    }

    final hour = race.dateTime.hour.toString().padLeft(2, '0');
    final minute = race.dateTime.minute.toString().padLeft(2, '0');
    final timeValue = race.raceType == RaceType.overseas
        ? '$hour:$minute（JST）'
        : '$hour:$minute';
    final isKeirin = race.raceType == RaceType.keirin;

    return RaceDetailUiModel(
      entity: RaceDetailUi(
        schemaVersion: 1,
        sections: [
          RaceDetailKvSection(
            rows: [
              RaceDetailKvRow(label: '発走', value: timeValue),
              RaceDetailKvRow(
                label: '競技',
                value: DisciplineIcon.labelFor(race.raceType),
              ),
              RaceDetailKvRow(label: '会場', value: race.raceCourse),
              RaceDetailKvRow(label: 'レース', value: '${race.raceNumber}R'),
              if (race.raceGrade != null && race.raceGrade!.isNotEmpty)
                RaceDetailKvRow(label: 'グレード', value: race.raceGrade!),
            ],
          ),
          const RaceDetailLinksSection(
            items: [RaceLink(label: '公式サイト（モック）', url: 'https://example.com')],
          ),
          RaceDetailPlayersSection(
            title: '出走選手',
            watchToggle: isKeirin,
            players: isKeirin
                ? const [
                    RacePlayerModel(
                      carNumber: 1,
                      frameNumber: 1,
                      playerNo: '000001',
                      playerName: '模擬　一郎',
                      term: 100,
                      branch: '東京',
                    ),
                    RacePlayerModel(
                      carNumber: 2,
                      frameNumber: 2,
                      playerNo: '000002',
                      playerName: '模擬　二郎',
                      term: 105,
                      branch: '大阪',
                    ),
                  ].map((model) => model.toEntity()).toList()
                : const [],
          ),
        ],
      ),
    );
  }
}
