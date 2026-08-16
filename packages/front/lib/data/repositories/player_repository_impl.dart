import '../../domain/entities/player_entity.dart';
import '../../domain/repositories/i_player_repository.dart';
import '../datasources/player_remote_data_source.dart';
import '../models/player_model.dart';

class PlayerRepositoryImpl implements IPlayerRepository {
  final IPlayerRemoteDataSource remoteDataSource;

  PlayerRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async {
    final models = await remoteDataSource.getPlayersByRaceType(
      raceTypeList: raceTypeList,
      playerName: playerName,
    );
    return models.map((model) => model.toEntity()).toList();
  }

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) {
    return remoteDataSource.upsertPlayers([
      PlayerModel(
        raceType: raceType,
        playerNo: playerNo,
        playerName: playerName,
        priority: watched ? kWatchedPlayerPriority : 0,
      ),
    ]);
  }
}
