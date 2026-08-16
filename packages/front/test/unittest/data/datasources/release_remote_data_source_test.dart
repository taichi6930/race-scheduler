// ReleaseRemoteDataSource.getReleases のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                              |
// | ---- | -------------------------------------------- | ---------------------------------------------------- |
// | T-01 | リクエストURL                                | 自前API（baseUrl起点の相対パス /release-notes）へリクエストする |
// | T-02 | 正常応答（200・リリース配列）                | ReleaseModelのリストを返す                          |
// | T-03 | 正常応答（200・配列でない形状）              | 例外がスローされる                                  |
// | T-04 | 異常応答（403・レート制限等）                | 例外がスローされる                                  |

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/release_remote_data_source.dart';

/// リクエスト内容を検証するため、実際の通信を行わず [RequestOptions] を
/// 捕捉するだけの [HttpClientAdapter]。応答本文・ステータスは差し替え可能。
///
/// `place_remote_data_source_test.dart` の `_CapturingAdapter` と同じ方式。
class _CapturingAdapter implements HttpClientAdapter {
  _CapturingAdapter({this.responseBody = '[]', this.statusCode = 200});

  RequestOptions? lastOptions;
  final String responseBody;
  final int statusCode;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastOptions = options;
    return ResponseBody.fromString(
      responseBody,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  group('ReleaseRemoteDataSource.getReleases', () {
    test('[T-01] リクエストURL_自前APIのbaseUrl起点の相対パスへリクエストする', () async {
      final adapter = _CapturingAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = adapter;
      final dataSource = ReleaseRemoteDataSource(dio: dio);

      await dataSource.getReleases();

      expect(
        adapter.lastOptions!.uri.toString(),
        'https://example.test/release-notes',
      );
    });

    test('[T-02] 正常応答_配列_ReleaseModelのリストを返す', () async {
      final adapter = _CapturingAdapter(
        responseBody:
            '[{"tag_name":"v1.2.0","name":"v1.2.0","body":null,'
            '"published_at":"2026-08-01T00:00:00Z","draft":false,'
            '"prerelease":false}]',
      );
      final dataSource = ReleaseRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      final result = await dataSource.getReleases();

      expect(result, hasLength(1));
      expect(result.single.tagName, 'v1.2.0');
    });

    test('[T-03] 正常応答_配列でない形状_例外がスローされる', () async {
      final adapter = _CapturingAdapter(responseBody: '{"unexpected":true}');
      final dataSource = ReleaseRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      expect(() => dataSource.getReleases(), throwsException);
    });

    test('[T-04] 異常応答_403レート制限_例外がスローされる', () async {
      final adapter = _CapturingAdapter(
        responseBody: '{"message":"API rate limit exceeded"}',
        statusCode: 403,
      );
      final dataSource = ReleaseRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      expect(() => dataSource.getReleases(), throwsException);
    });
  });
}
