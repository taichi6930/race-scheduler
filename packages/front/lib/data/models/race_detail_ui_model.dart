import '../../domain/entities/race_detail_ui.dart';
import '../../domain/entities/race_link.dart';
import 'race_player_model.dart';

/// front が対応しているUIスキーマのバージョン（`packages/core` の
/// `raceDetailUiSchema` の `schemaVersion` と対応）。
const _supportedSchemaVersion = 1;

/// `GET /ui/race-detail` のレスポンスJSONをパースするモデル。
///
/// `Announcement`（SDUI PoC）と同様、front未対応の`schemaVersion`は
/// レスポンス全体を「セクション無し」として扱う。一方セクション単位では、
/// 未知の`type`を持つセクションのみを読み飛ばし、解釈できた残りのセクションは
/// そのまま描画する（race-detail-sdui-design.md §1.1: 将来サーバー側だけで
/// 新セクションを追加しても、旧バージョンのfrontで詳細画面が空になるのを防ぐ）。
class RaceDetailUiModel {
  const RaceDetailUiModel({required this.entity});

  final RaceDetailUi entity;

  factory RaceDetailUiModel.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != _supportedSchemaVersion) {
      return const RaceDetailUiModel(
        entity: RaceDetailUi(
          schemaVersion: _supportedSchemaVersion,
          sections: [],
        ),
      );
    }
    final rawSections = json['sections'] as List<dynamic>? ?? [];
    final sections = [
      for (final rawSection in rawSections)
        _parseSection(rawSection as Map<String, dynamic>),
    ].whereType<RaceDetailUiSection>().toList();

    return RaceDetailUiModel(
      entity: RaceDetailUi(
        schemaVersion: _supportedSchemaVersion,
        sections: sections,
      ),
    );
  }

  static RaceDetailUiSection? _parseSection(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'kv':
        final rawRows = json['rows'] as List<dynamic>? ?? [];
        return RaceDetailKvSection(
          rows: [
            for (final rawRow in rawRows)
              RaceDetailKvRow(
                label: (rawRow as Map<String, dynamic>)['label'] as String,
                value: rawRow['value'] as String,
              ),
          ],
        );
      case 'links':
        final rawItems = json['items'] as List<dynamic>? ?? [];
        return RaceDetailLinksSection(
          items: [
            for (final rawItem in rawItems)
              RaceLink(
                label: (rawItem as Map<String, dynamic>)['label'] as String,
                url: rawItem['url'] as String,
              ),
          ],
        );
      case 'players':
        final rawRows = json['rows'] as List<dynamic>? ?? [];
        return RaceDetailPlayersSection(
          title: json['title'] as String,
          watchToggle: json['watchToggle'] as bool,
          players: [
            for (final rawRow in rawRows)
              RacePlayerModel.fromJson(
                rawRow as Map<String, dynamic>,
              ).toEntity(),
          ],
        );
      default:
        // 未知のtype: front再デプロイ無しでサーバー側だけ新セクションを
        // 追加できるよう、このセクションだけ読み飛ばして残りを解釈する。
        return null;
    }
  }
}
