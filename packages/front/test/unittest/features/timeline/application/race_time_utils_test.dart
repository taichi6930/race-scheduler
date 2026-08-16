// shouldDimPastRace のデシジョンテーブル
//
// | ID   | 条件                                                        | 期待  |
// | ---- | ----------------------------------------------------------- | ----- |
// | T-01 | now が発走時刻ちょうど                                       | false |
// | T-02 | now が発走時刻 + assumedRaceDuration（レース終了見込み時刻） | false |
// | T-03 | now が発走時刻 + assumedRaceDuration + 5分ちょうど            | false |
// | T-04 | now が発走時刻 + assumedRaceDuration + 5分を1秒でも超えた     | true  |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/features/timeline/application/race_time_utils.dart';
import 'package:front/integrations/google_calendar_link.dart';

void main() {
  final target = DateTime(2026, 8, 13, 15);

  test('[T-01] nowが発走時刻ちょうど_falseを返す', () {
    expect(shouldDimPastRace(target, target), isFalse);
  });

  test('[T-02] nowが発走時刻+assumedRaceDuration_falseを返す', () {
    final now = target.add(assumedRaceDuration);

    expect(shouldDimPastRace(now, target), isFalse);
  });

  test('[T-03] nowが発走時刻+assumedRaceDuration+5分ちょうど_falseを返す', () {
    final now = target.add(assumedRaceDuration).add(const Duration(minutes: 5));

    expect(shouldDimPastRace(now, target), isFalse);
  });

  test('[T-04] nowが発走時刻+assumedRaceDuration+5分を1秒超える_trueを返す', () {
    final now = target
        .add(assumedRaceDuration)
        .add(const Duration(minutes: 5, seconds: 1));

    expect(shouldDimPastRace(now, target), isTrue);
  });
}
