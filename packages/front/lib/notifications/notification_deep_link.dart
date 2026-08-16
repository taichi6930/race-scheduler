import '../core/jst_time.dart';
import '../domain/entities/race_entity.dart';

/// 通知タップ時の遷移先URL（QNTF-07で日付を追加した経緯があり、ここではraceIdも追加する）。
///
/// モバイル（`MobileNotificationScheduler`）・Web
/// （`WebNotificationScheduler`）の両実装が同じ形式で `app_router.dart` の
/// `/timeline` ルートへ渡すため、ここに集約する。`raceId` を含めることで、
/// タップ時に対象レースの詳細まで自動で開ける
/// （`_TimelineRouteEntry`・`pending_race_deep_link_provider.dart` 参照）。
String notificationDeepLinkFor(RaceEntity race) {
  final date = formatDateForApi(parseJstDateTime(race.datetime));
  final raceId = Uri.encodeQueryComponent(race.raceId);
  return '/timeline?date=$date&raceId=$raceId';
}
