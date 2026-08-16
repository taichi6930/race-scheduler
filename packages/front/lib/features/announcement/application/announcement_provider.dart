import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../data/datasources/announcement_remote_data_source.dart';
import '../../../domain/entities/announcement.dart';

/// [IAnnouncementRemoteDataSource] の実装（`getIt` 経由）を提供する。
/// テストではこのプロバイダを [ProviderScope.overrides] で差し替える。
final announcementRemoteDataSourceProvider =
    Provider<IAnnouncementRemoteDataSource>(
      (ref) => getIt<IAnnouncementRemoteDataSource>(),
    );

/// Server-Driven UI PoC: 起動時お知らせバナーの表示要否・内容を判定する。
///
/// api取得が失敗した場合はバナーを表示しない（[whatsNewNoticeProvider] と同様、
/// 補助的なお知らせ機能の不具合でアプリ起動自体を妨げないようにするため）。
/// `enabled:false`（apiからの明示的な非表示指定、または未対応schemaVersionへの
/// フォールバック）の場合も同様に `null` を返す。
///
/// `enabled` の値はapi側の機能フラグ管理画面（`GET /admin/flags`、
/// feature-flag-design.md）で環境ごとに制御されるため、frontは自身の設定に
/// 応じてリクエストを出し分ける必要が無い。[WhatsNewNoticeListener]同様
/// アプリ起動時に一度だけ確認する設計のため、フラグの切り替えは次回起動時から
/// 反映される。
final announcementProvider = FutureProvider<Announcement?>((ref) async {
  final Announcement announcement;
  try {
    announcement = await ref
        .read(announcementRemoteDataSourceProvider)
        .getAnnouncement();
  } on Exception {
    return null;
  }
  return announcement.enabled ? announcement : null;
});
