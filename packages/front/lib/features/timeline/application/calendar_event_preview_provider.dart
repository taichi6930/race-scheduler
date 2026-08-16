import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../domain/entities/calendar_event_preview.dart';
import '../../../domain/repositories/i_race_repository.dart';

/// [raceId] のレースの `GET /race/calendar-event` プレビュー内容を取得する。
///
/// [raceLinksProvider]（外部リンク表示）と [calendarEventUrlProvider]
/// （Googleカレンダー追加URL）の**両方**がこの同一エンドポイント/戻り値を
/// 必要とするため、`IRaceRepository.getCalendarEventPreview` の呼び出しを
/// この共通providerに集約する（PERF-118）。
///
/// familyキーが `raceId`（String）で揃っているため、同一raceIdに対して
/// 両providerが watch すると、Riverpodが自動的に1回のfetch・1つの
/// [AsyncValue] キャッシュへ集約する（無駄な重複HTTPリクエストの防止）。
final calendarEventPreviewProvider = FutureProvider.autoDispose
    .family<CalendarEventPreview, String>((ref, raceId) {
      return getIt<IRaceRepository>().getCalendarEventPreview(raceId);
    });
