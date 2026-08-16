// jstLocation のデシジョンテーブル
//
// | ID   | 対象        | 条件                                              | 期待                                    |
// | ---- | ----------- | -------------------------------------------------- | ------------------------------------------ |
// | T-01 | jstLocation | name                                               | 'Asia/Tokyo'                              |
// | T-02 | jstLocation | 任意の時刻のoffset                                 | 常にUTC+9時間。IANAデータベース版とも一致 |
// | T-03 | jstLocation | 任意の時刻のisDst                                  | 常にfalse。IANAデータベース版とも一致     |
// | T-04 | jstLocation | TZDateTime.fromで発火時刻を変換                    | IANAデータベース版と同じ結果を返す        |
//
// PERF-022: initializeTimeZones()（IANA全タイムゾーンの読み込み）を
// 使わない軽量なJST固定Locationに置き換えても、実際に使う範囲
// （発火時刻の変換）では結果が変わらないことを検証する。

import 'package:flutter_test/flutter_test.dart';
import 'package:front/notifications/jst_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

void main() {
  late tz.Location officialTokyo;

  setUpAll(() {
    // 比較対象として、従来どおりIANAデータベースからAsia/Tokyoを読み込む。
    tz_data.initializeTimeZones();
    officialTokyo = tz.getLocation('Asia/Tokyo');
  });

  final instants = [
    DateTime.utc(1970),
    DateTime.utc(2000, 1, 1),
    DateTime.utc(2026, 7, 26),
    DateTime.utc(2100, 12, 31),
  ];

  group('jstLocation', () {
    test('[T-01] name_Asia/Tokyoになる', () {
      expect(jstLocation.name, 'Asia/Tokyo');
    });

    test('[T-02] 任意の時刻のoffset_常にUTC+9時間でIANA版とも一致する', () {
      for (final instant in instants) {
        final ms = instant.millisecondsSinceEpoch;

        final offset = jstLocation.timeZone(ms).offset;

        expect(offset, const Duration(hours: 9));
        expect(offset, officialTokyo.timeZone(ms).offset);
      }
    });

    test('[T-03] 任意の時刻のisDst_常にfalseでIANA版とも一致する', () {
      for (final instant in instants) {
        final ms = instant.millisecondsSinceEpoch;

        final isDst = jstLocation.timeZone(ms).isDst;

        expect(isDst, isFalse);
        expect(isDst, officialTokyo.timeZone(ms).isDst);
      }
    });

    test('[T-04] TZDateTime.fromで発火時刻を変換_IANA版と同じ結果になる', () {
      // notificationFireTime/parseJstDateTimeと同じ「UTC基準+9時間」表現。
      final fireTime = DateTime.utc(2026, 4, 19, 15, 40);

      final withLightweight = tz.TZDateTime.from(fireTime, jstLocation);
      final withOfficial = tz.TZDateTime.from(fireTime, officialTokyo);

      expect(
        withLightweight.millisecondsSinceEpoch,
        withOfficial.millisecondsSinceEpoch,
      );
      expect(withLightweight.hour, withOfficial.hour);
      expect(withLightweight.minute, withOfficial.minute);
      expect(withLightweight.timeZoneOffset, withOfficial.timeZoneOffset);
    });
  });
}
