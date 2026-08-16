import 'package:dio/dio.dart';

import '../../domain/entities/announcement.dart';
import 'dio_call_handler.dart';

/// サポートしているUIスキーマのバージョン（`packages/core` の
/// `announcementSchema` の `schemaVersion` と対応）。front側が未対応の
/// バージョンを受け取った場合は、解釈できない構造を無理に描画しようとせず
/// 何も表示しない（安全側のフォールバック）。
const _supportedSchemaVersion = 1;

/// Server-Driven UI PoC: `GET /ui/announcement`（api）から起動時お知らせ
/// バナーの内容を取得するデータソース。`enabled` の値はapi側の機能フラグ管理画面
/// （`GET /admin/flags`、feature-flag-design.md）で環境ごとに制御されるため、
/// frontはリクエストの中身を意識しない。
abstract class IAnnouncementRemoteDataSource {
  Future<Announcement> getAnnouncement();
}

class AnnouncementRemoteDataSource implements IAnnouncementRemoteDataSource {
  AnnouncementRemoteDataSource({required this.dio});

  final Dio dio;

  @override
  Future<Announcement> getAnnouncement() {
    return handleDioCall(() async {
      final response = await dio.get('/ui/announcement');
      final data = response.data;
      if (data is! Map<String, dynamic>) {
        throw Exception('Failed to load announcement');
      }
      if (data['schemaVersion'] != _supportedSchemaVersion) {
        return const Announcement(enabled: false, message: '');
      }
      return Announcement(
        enabled: data['enabled'] as bool? ?? false,
        message: data['message'] as String? ?? '',
        actionLabel: data['actionLabel'] as String?,
        actionUrl: data['actionUrl'] as String?,
      );
    });
  }
}
