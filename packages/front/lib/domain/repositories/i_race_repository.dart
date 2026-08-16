import '../entities/calendar_event_preview.dart';
import '../entities/race_detail_ui.dart';
import '../entities/race_entity.dart';
import '../entities/race_player_entity.dart';

abstract class IRaceRepository {
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  });

  Future<RaceEntity?> getRaceDetail(String raceId);

  /// カレンダー登録イベントプレビューを取得する。
  /// calendar Workerが実際にGoogle Calendarへ登録する内容と同一の内容を返す。
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId);

  /// 出走選手一覧（車番順）を取得する（KPLAYER-07）。
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId);

  /// レース詳細画面のセクション型UIスキーマを取得する
  /// （race-detail-sdui-design.md）。
  Future<RaceDetailUi> getRaceDetailUi(String raceId);
}
