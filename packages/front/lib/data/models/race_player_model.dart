import 'package:freezed_annotation/freezed_annotation.dart';

import '../../domain/entities/race_player_entity.dart';

part 'race_player_model.freezed.dart';
part 'race_player_model.g.dart';

@freezed
abstract class RacePlayerModel with _$RacePlayerModel {
  const factory RacePlayerModel({
    @JsonKey(name: 'carNumber') required int carNumber,
    @JsonKey(name: 'frameNumber') required int frameNumber,
    @JsonKey(name: 'playerNo') required String playerNo,
    @JsonKey(name: 'playerName') required String playerName,
    @JsonKey(name: 'term') int? term,
    @JsonKey(name: 'branch') String? branch,
  }) = _RacePlayerModel;

  factory RacePlayerModel.fromJson(Map<String, dynamic> json) =>
      _$RacePlayerModelFromJson(json);

  const RacePlayerModel._();

  RacePlayerEntity toEntity() {
    return RacePlayerEntity(
      carNumber: carNumber,
      frameNumber: frameNumber,
      playerNo: playerNo,
      playerName: playerName,
      term: term,
      branch: branch,
    );
  }
}
