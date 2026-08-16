// RaceRepositoryImpl.getCalendarEventPreview / getRacePlayers / getRaceDetailUi
// のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                        |
// | ---- | ----------------------------- | ---------------------------------------------- |
// | T-01 | remoteDataSourceが正常に返す  | remoteDataSourceのモデルをtoEntity()した結果を返す |
// | T-02 | getRacePlayers: remoteDataSourceが選手2件を返す | toEntity()した結果を車番順のまま返す |
// | T-03 | getRaceDetailUi: remoteDataSourceが正常に返す | remoteDataSourceのモデルの`entity`をそのまま返す |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/race_remote_data_source.dart';
import 'package:front/data/models/calendar_event_preview_model.dart';
import 'package:front/data/models/race_detail_ui_model.dart';
import 'package:front/data/models/race_model.dart';
import 'package:front/data/models/race_player_model.dart';
import 'package:front/data/repositories/race_repository_impl.dart';

class _FakeRaceRemoteDataSource implements IRaceRemoteDataSource {
  _FakeRaceRemoteDataSource(
    this.calendarEventPreviewModel, {
    this.racePlayerModels = const [],
    this.raceDetailUiModel,
  });

  final CalendarEventPreviewModel calendarEventPreviewModel;
  final List<RacePlayerModel> racePlayerModels;
  final RaceDetailUiModel? raceDetailUiModel;
  String? requestedRaceId;
  String? requestedPlayersRaceId;
  String? requestedDetailUiRaceId;

  @override
  Future<List<RaceModel>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async => [];

  @override
  Future<CalendarEventPreviewModel> getCalendarEventPreview(
    String raceId,
  ) async {
    requestedRaceId = raceId;
    return calendarEventPreviewModel;
  }

  @override
  Future<List<RacePlayerModel>> getRacePlayers(String raceId) async {
    requestedPlayersRaceId = raceId;
    return racePlayerModels;
  }

  @override
  Future<RaceDetailUiModel> getRaceDetailUi(String raceId) async {
    requestedDetailUiRaceId = raceId;
    return raceDetailUiModel!;
  }
}

void main() {
  group('RaceRepositoryImpl.getCalendarEventPreview', () {
    test('[T-01] remoteDataSourceのモデルをtoEntity()した結果を返す', () async {
      final model = CalendarEventPreviewModel.fromJson({
        'summary': '2歳新馬',
        'description': '発走: 10:20',
        'location': '新潟競馬場',
        'start': {'dateTime': '2026-07-25T10:20:00+09:00'},
        'end': {'dateTime': '2026-07-25T10:30:00+09:00'},
        'links': [
          {'label': 'レース情報(netkeiba)', 'url': 'https://netkeiba.example/info'},
        ],
      });
      final fakeDataSource = _FakeRaceRemoteDataSource(model);
      final repository = RaceRepositoryImpl(remoteDataSource: fakeDataSource);

      final result = await repository.getCalendarEventPreview(
        'jra202607250402',
      );

      expect(fakeDataSource.requestedRaceId, 'jra202607250402');
      expect(result.summary, model.summary);
      expect(result.description, model.description);
      expect(result.location, model.location);
      expect(result.startDateTime, model.startDateTime);
      expect(result.endDateTime, model.endDateTime);
      expect(result.links.length, 1);
      expect(result.links.first.label, 'レース情報(netkeiba)');
      expect(result.links.first.url, 'https://netkeiba.example/info');
    });
  });

  group('RaceRepositoryImpl.getRacePlayers', () {
    test('[T-02] remoteDataSourceのモデルをtoEntity()した結果を車番順のまま返す', () async {
      final players = [
        const RacePlayerModel(
          carNumber: 1,
          frameNumber: 1,
          playerNo: '014833',
          playerName: '高久保雄介',
          term: 100,
          branch: '京都',
        ),
        const RacePlayerModel(
          carNumber: 2,
          frameNumber: 2,
          playerNo: '014834',
          playerName: '梁島邦友',
        ),
      ];
      final fakeDataSource = _FakeRaceRemoteDataSource(
        CalendarEventPreviewModel.fromJson({
          'summary': '',
          'description': '',
          'location': '',
          'start': {'dateTime': '2026-08-02T10:00:00+09:00'},
          'end': {'dateTime': '2026-08-02T10:10:00+09:00'},
          'links': [],
        }),
        racePlayerModels: players,
      );
      final repository = RaceRepositoryImpl(remoteDataSource: fakeDataSource);

      final result = await repository.getRacePlayers('keirin202608023601');

      expect(fakeDataSource.requestedPlayersRaceId, 'keirin202608023601');
      expect(result.map((p) => p.carNumber).toList(), [1, 2]);
      expect(result[0].playerName, '高久保雄介');
      expect(result[0].term, 100);
      expect(result[0].branch, '京都');
      expect(result[1].playerName, '梁島邦友');
      expect(result[1].term, isNull);
    });
  });

  group('RaceRepositoryImpl.getRaceDetailUi', () {
    test('[T-03] remoteDataSourceのモデルのentityをそのまま返す', () async {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {
            'type': 'kv',
            'rows': [
              {'label': '発走', 'value': '14:33'},
            ],
          },
        ],
      });
      final fakeDataSource = _FakeRaceRemoteDataSource(
        CalendarEventPreviewModel.fromJson({
          'summary': '',
          'description': '',
          'location': '',
          'start': {'dateTime': '2026-08-02T10:00:00+09:00'},
          'end': {'dateTime': '2026-08-02T10:10:00+09:00'},
          'links': [],
        }),
        raceDetailUiModel: model,
      );
      final repository = RaceRepositoryImpl(remoteDataSource: fakeDataSource);

      final result = await repository.getRaceDetailUi('keirin202608023601');

      expect(fakeDataSource.requestedDetailUiRaceId, 'keirin202608023601');
      expect(result, model.entity);
    });
  });
}
