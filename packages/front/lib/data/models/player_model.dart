import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/player_entity.dart';

part 'player_model.freezed.dart';
part 'player_model.g.dart';

@freezed
abstract class PlayerModel with _$PlayerModel {
  const factory PlayerModel({
    @JsonKey(name: 'raceType') required String raceType,
    @JsonKey(name: 'playerNo') required String playerNo,
    @JsonKey(name: 'playerName') required String playerName,
    @JsonKey(name: 'priority') required int priority,
    @JsonKey(name: 'term') int? term,
    @JsonKey(name: 'branch') String? branch,
  }) = _PlayerModel;

  factory PlayerModel.fromJson(Map<String, dynamic> json) =>
      _$PlayerModelFromJson(json);

  const PlayerModel._();

  PlayerEntity toEntity() {
    return PlayerEntity(
      raceType: raceType,
      playerNo: playerNo,
      playerName: playerName,
      priority: priority,
      term: term,
      branch: branch,
    );
  }
}
