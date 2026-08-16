// AnnouncementRemoteDataSource のデシジョンテーブル
//
// | ID   | 条件                                            | 期待                                    |
// | ---- | ------------------------------------------------- | ------------------------------------------ |
// | T-01 | 正常応答（schemaVersion:1, enabled:true）          | GET /ui/announcement へリクエストし内容を返す |
// | T-02 | actionLabel/actionUrlが無い場合                    | null で返る                              |
// | T-03 | schemaVersionが未対応（例: 2）                      | enabled:false・message:""で返る（フォールバック） |
// | T-04 | 異常応答（400）                                     | 例外がスローされる                        |

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/announcement_remote_data_source.dart';

class _CapturingAdapter implements HttpClientAdapter {
  _CapturingAdapter({this.responseBody = '{}', this.statusCode = 200});

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
  group('AnnouncementRemoteDataSource.getAnnouncement', () {
    test('[T-01] 正常応答_GET /ui/announcementへリクエストし内容を返す', () async {
      final adapter = _CapturingAdapter(
        responseBody:
            '{"schemaVersion":1,"enabled":true,"message":"お知らせ",'
            '"actionLabel":"見る","actionUrl":"https://example.com"}',
      );
      final dataSource = AnnouncementRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      final result = await dataSource.getAnnouncement();

      expect(adapter.lastOptions!.method, 'GET');
      expect(adapter.lastOptions!.path, '/ui/announcement');
      expect(result.enabled, true);
      expect(result.message, 'お知らせ');
      expect(result.actionLabel, '見る');
      expect(result.actionUrl, 'https://example.com');
    });

    test('[T-02] actionLabel_actionUrlが無い場合_nullで返る', () async {
      final adapter = _CapturingAdapter(
        responseBody: '{"schemaVersion":1,"enabled":false,"message":"a"}',
      );
      final dataSource = AnnouncementRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      final result = await dataSource.getAnnouncement();

      expect(result.actionLabel, isNull);
      expect(result.actionUrl, isNull);
    });

    test('[T-03] schemaVersionが未対応の場合_enabled falseにフォールバックする', () async {
      final adapter = _CapturingAdapter(
        responseBody: '{"schemaVersion":2,"enabled":true,"message":"a"}',
      );
      final dataSource = AnnouncementRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      final result = await dataSource.getAnnouncement();

      expect(result.enabled, false);
      expect(result.message, '');
    });

    test('[T-04] 異常応答_400_例外がスローされる', () async {
      final adapter = _CapturingAdapter(
        responseBody: '{"error":"invalid"}',
        statusCode: 400,
      );
      final dataSource = AnnouncementRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      expect(() => dataSource.getAnnouncement(), throwsException);
    });
  });
}
