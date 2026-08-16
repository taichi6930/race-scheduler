// RaceDetailUiModel のデシジョンテーブル
//
// | ID   | 条件                                    | 期待                                          |
// | ---- | ---------------------------------------- | ------------------------------------------------ |
// | T-01 | schemaVersion:1・kv/links/players全セクション | 3セクションを正しくパースする                |
// | T-02 | schemaVersion:2（未対応）                 | セクション無し（空リスト）として扱う              |
// | T-03 | 未知のtypeを含むセクション                | そのセクションのみ読み飛ばし、他は解釈する        |
// | T-04 | sectionsが無い                            | 空リストとして扱う                                |
// | T-05 | kvのrowsが無い                            | 空リストとして扱う                                |
// | T-06 | linksのitemsが無い                        | 空リストとして扱う                                |
// | T-07 | playersのrowsが無い                       | 空リストとして扱う                                |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/models/race_detail_ui_model.dart';
import 'package:front/domain/entities/race_detail_ui.dart';

void main() {
  group('RaceDetailUiModel', () {
    test('[T-01] schemaVersion1_kv_links_players全セクションを正しくパースする', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {
            'type': 'kv',
            'rows': [
              {'label': '発走', 'value': '14:33'},
            ],
          },
          {
            'type': 'links',
            'items': [
              {'label': 'レース情報（netkeirin）', 'url': 'https://netkeirin.example'},
            ],
          },
          {
            'type': 'players',
            'title': '出走選手',
            'watchToggle': true,
            'rows': [
              {
                'carNumber': 1,
                'frameNumber': 1,
                'playerNo': '012345',
                'playerName': '柴崎淳',
                'term': 91,
                'branch': '三重',
              },
            ],
          },
        ],
      });

      expect(model.entity.schemaVersion, 1);
      expect(model.entity.sections, hasLength(3));

      final kvSection = model.entity.sections[0] as RaceDetailKvSection;
      expect(kvSection.rows.single.label, '発走');
      expect(kvSection.rows.single.value, '14:33');

      final linksSection = model.entity.sections[1] as RaceDetailLinksSection;
      expect(linksSection.items.single.label, 'レース情報（netkeirin）');
      expect(linksSection.items.single.url, 'https://netkeirin.example');

      final playersSection =
          model.entity.sections[2] as RaceDetailPlayersSection;
      expect(playersSection.title, '出走選手');
      expect(playersSection.watchToggle, isTrue);
      expect(playersSection.players.single.playerName, '柴崎淳');
      expect(playersSection.players.single.term, 91);
      expect(playersSection.players.single.branch, '三重');
    });

    test('[T-02] schemaVersion2_未対応_セクション無しとして扱う', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 2,
        'sections': [
          {
            'type': 'kv',
            'rows': [
              {'label': '発走', 'value': '14:33'},
            ],
          },
        ],
      });

      expect(model.entity.schemaVersion, 1);
      expect(model.entity.sections, isEmpty);
    });

    test('[T-03] 未知のtypeを含む_そのセクションのみ読み飛ばし他は解釈する', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {'type': 'odds', 'items': []},
          {
            'type': 'links',
            'items': [
              {'label': 'x', 'url': 'https://example.com'},
            ],
          },
        ],
      });

      expect(model.entity.sections, hasLength(1));
      expect(model.entity.sections.single, isA<RaceDetailLinksSection>());
    });

    test('[T-04] sectionsが無い_空リストとして扱う', () {
      final model = RaceDetailUiModel.fromJson({'schemaVersion': 1});

      expect(model.entity.sections, isEmpty);
    });

    test('[T-05] kvのrowsが無い_空リストとして扱う', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {'type': 'kv'},
        ],
      });

      final kvSection = model.entity.sections.single as RaceDetailKvSection;
      expect(kvSection.rows, isEmpty);
    });

    test('[T-06] linksのitemsが無い_空リストとして扱う', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {'type': 'links'},
        ],
      });

      final linksSection =
          model.entity.sections.single as RaceDetailLinksSection;
      expect(linksSection.items, isEmpty);
    });

    test('[T-07] playersのrowsが無い_空リストとして扱う', () {
      final model = RaceDetailUiModel.fromJson({
        'schemaVersion': 1,
        'sections': [
          {'type': 'players', 'title': '出走選手', 'watchToggle': false},
        ],
      });

      final playersSection =
          model.entity.sections.single as RaceDetailPlayersSection;
      expect(playersSection.players, isEmpty);
    });
  });
}
