// PlayerRemoteDataSource.getPlayersByRaceType のデシジョンテーブル
//
// | ID   | 条件                                          | 期待                                             |
// | ---- | --------------------------------------------- | ------------------------------------------------- |
// | T-01 | raceTypeListに1件指定                         | クエリパラメータraceTypeList（複数形）で送られる（バグ修正の回帰） |
// | T-02 | playerNameを指定                              | クエリパラメータplayerNameに含まれる               |
// | T-03 | playerName未指定/空文字                       | クエリパラメータplayerNameに含まれない             |
// | T-04 | 正常応答（200・{count,players}）              | PlayerModelのリストを返す（バグ修正の回帰）        |
// | T-05 | 異常応答（200・素の配列など想定外の形状）      | 例外がスローされる                                 |
// | T-06 | 同一パラメータで並行に2回呼び出す              | HTTPリクエストは1回だけ発火する（PERF-124）        |
// | T-07 | 異なるパラメータで並行に2回呼び出す            | HTTPリクエストがそれぞれ発火する                   |
// | T-10 | raceTypeListに複数件指定（KEIRIN+AUTORACE）   | クエリパラメータraceTypeListがカンマ区切りで送られる |
//
// PlayerRemoteDataSource.upsertPlayers のデシジョンテーブル
//
// | ID   | 条件                                          | 期待                                             |
// | ---- | --------------------------------------------- | ------------------------------------------------- |
// | T-08 | 選手1件を渡す                                 | snake_caseのボディでPOST /playerが送られる         |
// | T-09 | 応答が200以外                                 | 例外がスローされる                                 |

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/player_remote_data_source.dart';
import 'package:front/data/models/player_model.dart';

/// リクエスト内容を検証するため、実際の通信を行わず [RequestOptions] を
/// 捕捉するだけの [HttpClientAdapter]。応答本文は [responseBody] で差し替え可能。
class _CapturingAdapter implements HttpClientAdapter {
  _CapturingAdapter({
    this.responseBody = '{"count":0,"players":[]}',
    this.delay,
  });

  RequestOptions? lastOptions;
  final String responseBody;

  /// PERF-124: dedupのテスト用に、複数呼び出しが重なるよう応答を遅延させる。
  final Duration? delay;
  int fetchCallCount = 0;

  /// upsertPlayersの異常系（200以外）テスト用に差し替え可能な応答コード。
  int statusCode = 200;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    fetchCallCount++;
    lastOptions = options;
    if (delay != null) await Future<void>.delayed(delay!);
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
  group('PlayerRemoteDataSource.getPlayersByRaceType', () {
    late _CapturingAdapter adapter;
    late PlayerRemoteDataSource dataSource;

    setUp(() {
      adapter = _CapturingAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      dataSource = PlayerRemoteDataSource(dio: dio);
    });

    test('[T-01] raceTypeListに1件指定_クエリパラメータraceTypeListで送られる', () async {
      await dataSource.getPlayersByRaceType(raceTypeList: ['keirin']);

      final query = adapter.lastOptions!.uri.queryParameters;

      expect(query['raceTypeList'], 'keirin');
      expect(query.containsKey('raceType'), isFalse);
    });

    test('[T-02] playerNameを指定_クエリパラメータに含まれる', () async {
      await dataSource.getPlayersByRaceType(
        raceTypeList: ['keirin'],
        playerName: '山田',
      );

      final query = adapter.lastOptions!.uri.queryParameters;

      expect(query['playerName'], '山田');
    });

    test('[T-03] playerName未指定_クエリパラメータに含まれない', () async {
      await dataSource.getPlayersByRaceType(raceTypeList: ['keirin']);

      final query = adapter.lastOptions!.uri.queryParameters;

      expect(query.containsKey('playerName'), isFalse);
    });

    test('[T-04] 正常応答_countとplayersを持つオブジェクト_PlayerModelのリストを返す', () async {
      final okAdapter = _CapturingAdapter(
        responseBody:
            '{"count":1,"players":[{"raceType":"keirin","playerNo":"014833","playerName":"高久保雄介","priority":10}]}',
      );
      final okDataSource = PlayerRemoteDataSource(
        dio: Dio()..httpClientAdapter = okAdapter,
      );

      final result = await okDataSource.getPlayersByRaceType(
        raceTypeList: ['keirin'],
      );

      expect(result, hasLength(1));
      expect(result.first.playerNo, '014833');
      expect(result.first.playerName, '高久保雄介');
      expect(result.first.priority, 10);
    });

    test('[T-05] 異常応答_素の配列_例外がスローされる', () async {
      final brokenAdapter = _CapturingAdapter(responseBody: '[]');
      final brokenDataSource = PlayerRemoteDataSource(
        dio: Dio()..httpClientAdapter = brokenAdapter,
      );

      expect(
        () => brokenDataSource.getPlayersByRaceType(raceTypeList: ['keirin']),
        throwsException,
      );
    });

    test('[T-06] 同一パラメータで並行に2回呼び出す_HTTPリクエストは1回だけ発火する', () async {
      final dedupAdapter = _CapturingAdapter(
        delay: const Duration(milliseconds: 10),
      );
      final dedupDataSource = PlayerRemoteDataSource(
        dio: Dio()..httpClientAdapter = dedupAdapter,
      );

      await Future.wait([
        dedupDataSource.getPlayersByRaceType(raceTypeList: ['keirin']),
        dedupDataSource.getPlayersByRaceType(raceTypeList: ['keirin']),
      ]);

      expect(dedupAdapter.fetchCallCount, 1);
    });

    test('[T-07] 異なるパラメータで並行に2回呼び出す_HTTPリクエストがそれぞれ発火する', () async {
      final dedupAdapter = _CapturingAdapter(
        delay: const Duration(milliseconds: 10),
      );
      final dedupDataSource = PlayerRemoteDataSource(
        dio: Dio()..httpClientAdapter = dedupAdapter,
      );

      await Future.wait([
        dedupDataSource.getPlayersByRaceType(raceTypeList: ['keirin']),
        dedupDataSource.getPlayersByRaceType(raceTypeList: ['autorace']),
      ]);

      expect(dedupAdapter.fetchCallCount, 2);
    });

    test('[T-10] raceTypeListに複数件指定_クエリパラメータraceTypeListがカンマ区切りで送られる', () async {
      await dataSource.getPlayersByRaceType(
        raceTypeList: ['keirin', 'autorace'],
      );

      final query = adapter.lastOptions!.uri.queryParameters;

      expect(query['raceTypeList'], 'keirin,autorace');
    });
  });

  group('PlayerRemoteDataSource.upsertPlayers', () {
    test('[T-08] 選手1件を渡す_snake_caseのボディでPOST_playerが送られる', () async {
      final adapter = _CapturingAdapter();
      final dataSource = PlayerRemoteDataSource(
        dio: Dio()..httpClientAdapter = adapter,
      );

      await dataSource.upsertPlayers(const [
        PlayerModel(
          raceType: 'keirin',
          playerNo: '014833',
          playerName: '高久保雄介',
          priority: 10,
        ),
      ]);

      final body = adapter.lastOptions!.data as List<dynamic>;
      expect(body, hasLength(1));
      expect(body.first, {
        'race_type': 'keirin',
        'player_no': '014833',
        'player_name': '高久保雄介',
        'priority': 10,
      });
    });

    test('[T-09] 応答が200以外_例外がスローされる', () async {
      final failingAdapter = _CapturingAdapter();
      final dataSource = PlayerRemoteDataSource(
        dio: Dio()
          ..httpClientAdapter = failingAdapter
          ..options.validateStatus = (status) => true,
      );
      failingAdapter.statusCode = 500;

      expect(
        () => dataSource.upsertPlayers(const [
          PlayerModel(
            raceType: 'keirin',
            playerNo: '014833',
            playerName: '高久保雄介',
            priority: 10,
          ),
        ]),
        throwsException,
      );
    });
  });
}
