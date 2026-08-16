import 'package:dio/dio.dart';

import '../models/release_model.dart';
import 'dio_call_handler.dart';

/// GitHub Releases APIのURL。front から直接呼び出す（新規バックエンド
/// エンドポイントは作らない、要件スコープ外）。公開リポジトリの読み取りは
/// 認証不要（匿名レート制限 60回/時/IP、NFR-01）。
const String kGithubReleasesUrl =
    'https://api.github.com/repos/taichi6930/race-schedule/releases';

abstract class IReleaseRemoteDataSource {
  /// draft・prerelease を含む全リリースを、GitHubの既定順（新しい順）で取得する
  /// （draft・prereleaseの除外、明示的な新しい順ソートは呼び出し元の責務）。
  Future<List<ReleaseModel>> getReleases();
}

class ReleaseRemoteDataSource implements IReleaseRemoteDataSource {
  ReleaseRemoteDataSource({required this.dio});

  final Dio dio;

  @override
  Future<List<ReleaseModel>> getReleases() {
    return handleDioCall(() async {
      // 絶対URL（`https://` 始まり）を渡すと、[dio] に設定済みのアプリ本体
      // バックエンド向け `baseUrl` は無視され、このURLへ直接リクエストされる
      // （dioの標準挙動）。同じ[dio]インスタンスを使い回すことで、既存の
      // リトライ（5xx・接続エラー限定, [DioRetryInterceptor]）をそのまま
      // 適用できる。
      final response = await dio.get<dynamic>(
        kGithubReleasesUrl,
        queryParameters: {'per_page': 30},
      );

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
