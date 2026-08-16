import '../../../data/datasources/player_remote_data_source.dart';
import '../../../data/models/player_model.dart';
import 'mock_network_delay.dart';

/// バックエンドに接続しない [IPlayerRemoteDataSource]（KPLAYER-07）。
///
/// モックモード（`main_mock.dart`）でも選手検索・注目選手登録の一連の操作を
/// 確認できるよう、固定生成データ + インメモリの `priority` 更新を持つ。
class FakePlayerRemoteDataSource implements IPlayerRemoteDataSource {
  final Map<String, PlayerModel> _players = {
    for (final player in [..._initialKeirinPlayers, ..._initialAutoracePlayers])
      player.playerNo: player,
  };

  @override
  Future<List<PlayerModel>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async {
    await mockNetworkDelay();
    return _players.values
        .where((player) => raceTypeList.contains(player.raceType))
        .where(
          (player) =>
              playerName == null ||
              playerName.isEmpty ||
              player.playerName.contains(playerName),
        )
        .toList();
  }

  @override
  Future<void> upsertPlayers(List<PlayerModel> players) async {
    await mockNetworkDelay();
    for (final player in players) {
      _players[player.playerNo] = player;
    }
  }
}

const _initialKeirinPlayers = [
  PlayerModel(
    raceType: 'keirin',
    playerNo: '000001',
    playerName: '模擬　一郎',
    priority: 0,
  ),
  PlayerModel(
    raceType: 'keirin',
    playerNo: '000002',
    playerName: '模擬　二郎',
    priority: 0,
  ),
  PlayerModel(
    raceType: 'keirin',
    playerNo: '000003',
    playerName: '模擬　三郎',
    priority: 0,
  ),
];

const _initialAutoracePlayers = [
  PlayerModel(
    raceType: 'autorace',
    playerNo: '100001',
    playerName: '模擬　四郎',
    priority: 0,
  ),
  PlayerModel(
    raceType: 'autorace',
    playerNo: '100002',
    playerName: '模擬　五郎',
    priority: 0,
  ),
];
