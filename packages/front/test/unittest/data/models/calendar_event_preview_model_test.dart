// CalendarEventPreviewModel のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                        |
// | ---- | ----------------------------- | ---------------------------------------------- |
// | T-01 | 正常なJSON（links無し）       | summary/description/location/start/endを正しくパースし、linksは空になる |
// | T-02 | fromJson後にtoEntity          | entityの各フィールドがmodelと一致する          |
// | T-03 | JSONにlinksあり               | label/urlを持つRaceLinkのリストにパースする    |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/models/calendar_event_preview_model.dart';

Map<String, dynamic> _json({List<Map<String, String>>? links}) => {
  'summary': '2歳新馬',
  'description': '発走: 10:20\n更新日時: 2026/07/25 09:00',
  'location': '新潟競馬場',
  'start': {'dateTime': '2026-07-25T10:20:00+09:00', 'timeZone': 'Asia/Tokyo'},
  'end': {'dateTime': '2026-07-25T10:30:00+09:00', 'timeZone': 'Asia/Tokyo'},
  'links': ?links,
};

void main() {
  group('CalendarEventPreviewModel', () {
    test('[T-01] 正常なJSON_links無し_各フィールドを正しくパースしlinksは空になる', () {
      final model = CalendarEventPreviewModel.fromJson(_json());

      expect(model.summary, '2歳新馬');
      expect(model.description, contains('発走: 10:20'));
      expect(model.location, '新潟競馬場');
      expect(model.startDateTime, '2026-07-25T10:20:00+09:00');
      expect(model.endDateTime, '2026-07-25T10:30:00+09:00');
      expect(model.links, isEmpty);
    });

    test('[T-02] fromJson後にtoEntity_entityの各フィールドがmodelと一致する', () {
      final model = CalendarEventPreviewModel.fromJson(
        _json(
          links: [
            {
              'label': 'レース情報(netkeiba)',
              'url': 'https://netkeiba.example/info',
            },
          ],
        ),
      );

      final entity = model.toEntity();

      expect(entity.summary, model.summary);
      expect(entity.description, model.description);
      expect(entity.location, model.location);
      expect(entity.startDateTime, model.startDateTime);
      expect(entity.endDateTime, model.endDateTime);
      expect(entity.links, model.links);
    });

    test('[T-03] JSONにlinksあり_label_urlを持つRaceLinkのリストにパースする', () {
      final model = CalendarEventPreviewModel.fromJson(
        _json(
          links: [
            {
              'label': 'レース情報(netkeiba)',
              'url': 'https://netkeiba.example/info',
            },
            {
              'label': 'レース映像（公式YouTube）',
              'url': 'https://youtube.example/live',
            },
          ],
        ),
      );

      expect(model.links, hasLength(2));
      expect(model.links[0].label, 'レース情報(netkeiba)');
      expect(model.links[0].url, 'https://netkeiba.example/info');
      expect(model.links[1].label, 'レース映像（公式YouTube）');
      expect(model.links[1].url, 'https://youtube.example/live');
    });
  });
}
