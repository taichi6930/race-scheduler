import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/race_entity.dart';
import '../../../integrations/google_calendar_link.dart';
import 'calendar_event_preview_provider.dart';

/// [calendarEventUrlProvider] の family キー。
///
/// フォールバックURL生成（[buildGoogleCalendarEventUrl]）に [RaceEntity] 全体が
/// 必要なため保持しつつ、familyキーとしての同一性判定は [raceId] だけで行う
/// （Freezedエンティティ全体の `==`/`hashCode` は全フィールド比較のため重い。PERF-004）。
class CalendarEventRaceKey {
  const CalendarEventRaceKey(this.race);

  final RaceEntity race;

  String get raceId => race.raceId;

  @override
  bool operator ==(Object other) =>
      other is CalendarEventRaceKey && other.raceId == raceId;

  @override
  int get hashCode => raceId.hashCode;
}

/// [race] の Google カレンダー予定追加URLを取得する。
///
/// OAuth連携は行わず、Google カレンダーの Quick Add 画面に事前入力した
/// 状態で開くだけの軽量なMVP実装（ユーザーがそこで保存を確定する）。
///
/// `GET /race/calendar-event` から、calendar Workerが実際にGoogle Calendarへ
/// 登録するのと同じ内容（発走時刻・netkeiba/YouTubeリンク等）を取得して使う。
/// 取得自体は [calendarEventPreviewProvider] に集約されており（PERF-118）、
/// raceLinksProvider と同一raceIdであればfetchが1回に共有される。
/// API取得に失敗した場合（オフライン等）は、従来のクライアント側のみの
/// 簡易URL（[buildGoogleCalendarEventUrl]）にフォールバックする。
final calendarEventUrlProvider = FutureProvider.autoDispose
    .family<Uri, CalendarEventRaceKey>((ref, key) async {
      final race = key.race;
      try {
        final preview = await ref.watch(
          calendarEventPreviewProvider(race.raceId).future,
        );
        return buildGoogleCalendarEventUrlFromPreview(preview);
      } catch (_) {
        return buildGoogleCalendarEventUrl(race);
      }
    });
