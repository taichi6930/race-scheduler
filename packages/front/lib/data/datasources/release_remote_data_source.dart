import 'package:dio/dio.dart';

import '../models/release_model.dart';
import 'dio_call_handler.dart';

abstract class IReleaseRemoteDataSource {
  /// draft・prerelease を含む全リリースを、新しい順で取得する
  /// （draft・prereleaseの除外、明示的な新しい順ソートは呼び出し元の責務）。
  Future<List<ReleaseModel>> getReleases();
}

class ReleaseRemoteDataSource implements IReleaseRemoteDataSource {
  ReleaseRemoteDataSource({required this.dio});

  final Dio dio;

  @override
  Future<List<ReleaseModel>> getReleases() {
    return handleDioCall(() async {
      // `GET /release-notes`（自前API、release-notes-db移行）はGitHub Releases APIと
      // 同じレスポンス形状（snake_case: tag_name/name/body/published_at/draft/prerelease）
      // を返すため、ReleaseModel.fromJsonはそのまま流用できる。
      final response = await dio.get<dynamic>('/release-notes');

      final data = response.data;
      if (data is! List) {
        throw Exception('Failed to load releases');
      }
      return data
          .whereType<Map<String, dynamic>>()
          .map(ReleaseModel.fromJson)
          .toList();
    });
  }
}
