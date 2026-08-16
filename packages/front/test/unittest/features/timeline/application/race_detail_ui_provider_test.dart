// raceDetailUiProvider のデシジョンテーブル
//
// | ID   | 条件                        | 期待                                                |
// | ---- | --------------------------- | ------------------------------------------------------ |
// | T-01 | 正常系                      | IRaceRepository.getRaceDetailUiの戻り値をそのまま返す |
//
// 備考: repositoryが例外をスローするケースを対象外とする理由は
// race_players_provider_test.dart（削除前）と同じ
// （autoDisposeプロバイダのdispose競合でテストが不安定になるため）。
// エラー時の実際の挙動（取得失敗を「セクション無し」として扱う）は
// _RaceDetailSections（race_detail_sheet.dart）側の`.value?.sections ?? const []`
// というAsyncValueの扱いで担保されており、raceDetailUiProvider自体は
// getIt経由の薄い委譲のため、そちらに委ねる。

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/domain/entities/calendar_event_preview.dart';
import 'package:front/domain/entities/race_detail_ui.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/entities/race_player_entity.dart';
import 'package:front/domain/repositories/i_race_repository.dart';
import 'package:front/features/timeline/application/race_detail_ui_provider.dart';

class _FakeRaceRepository implements IRaceRepository {
  _FakeRaceRepository({required this.detail});

  final RaceDetailUi detail;

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async => detail;

  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async {
    throw UnimplementedError();
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
}

void main() {
  tearDown(() {
    if (getIt.isRegistered<IRaceRepository>()) {
      getIt.unregister<IRaceRepository>();
    }
  });

  test('[T-01] 正常系_getRaceDetailUiの戻り値をそのまま返す', () async {
    const detail = RaceDetailUi(
      schemaVersion: 1,
      sections: [
        RaceDetailKvSection(
          rows: [RaceDetailKvRow(label: '発走', value: '14:33')],
        ),
      ],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(detail: detail),
    );
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final result = await container.read(
      raceDetailUiProvider('keirin202608023601').future,
    );

    expect(result, detail);
  });
}
