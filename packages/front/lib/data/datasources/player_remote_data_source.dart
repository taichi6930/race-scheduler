import 'package:dio/dio.dart';
import '../../core/in_flight_request_dedup.dart';
import '../models/player_model.dart';
import 'dio_call_handler.dart';

abstract class IPlayerRemoteDataSource {
  Future<List<PlayerModel>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  });

  /// 選手を登録/更新する（POST /player、KPLAYER-07）。
  /// 注目選手のON/OFFは `priority`（0=注目しない/10=注目する）で表す。
  Future<void> upsertPlayers(List<PlayerModel> players);
}

class PlayerRemoteDataSource implements IPlayerRemoteDataSource {
  final Dio dio;

  PlayerRemoteDataSource({required this.dio});

  // PERF-124: PERF-010（/race）と同型のin-flight dedupを/playerにも適用する。
  final _dedup = InFlightRequestDedup<String>();

  @override
  Future<List<PlayerModel>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) {
    final dedupKey = '${raceTypeList.join(',')}|${playerName ?? ''}';

    return _dedup.run(dedupKey, () {
      return handleDioCall(() async {
        // バックエンド（searchPlayerFilterParamsSchema）はraceTypeListを要求する
        // （raceTypeという単数キーは受け付けず400になる）。カンマ区切りの
        // 複数指定に対応している（common.ts normalizeRaceTypeList）ため、
        // 複数種目を1回のリクエストでまとめて取得できる。
        final queryParams = {'raceTypeList': raceTypeList.join(',')};

        if (playerName != null && playerName.isNotEmpty) {
          queryParams['playerName'] = playerName;
        }

        final response = await dio.get('/player', queryParameters: queryParams);

        if (response.statusCode == 200) {
          final data = response.data;
          // レスポンス形状は素の配列ではなく {count, players: [...]}（PlayerController.get）。
          if (data is Map<String, dynamic> && data['players'] is List) {
            return (data['players'] as List)
                .map(
                  (item) => PlayerModel.fromJson(item as Map<String, dynamic>),
                )
                .toList();
          }
        }
        throw Exception('Failed to load players');
      });
    });
  }

  @override
  Future<void> upsertPlayers(List<PlayerModel> players) {
    return handleDioCall(() async {
      final response = await dio.post(
        '/player',
        data: players
            .map(
              (player) => {
                'race_type': player.raceType,
                'player_no': player.playerNo,
                'player_name': player.playerName,
                'priority': player.priority,
              },
            )
            .toList(),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to upsert players');
      }
    });
  }
}
