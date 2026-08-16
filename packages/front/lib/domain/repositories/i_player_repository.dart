import '../entities/player_entity.dart';

abstract class IPlayerRepository {
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  });

  /// 選手の注目状態をON/OFFする（KPLAYER-07）。
  /// [watched] がtrueなら注目選手として登録、falseなら解除する。
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  });
}
