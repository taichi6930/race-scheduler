// RaceRow のビジュアルリグレッション（ゴールデン）テスト。
//
// タイムライン1行のレイアウト（発走時刻・アイコン・グレードバッジ・
// カウントダウン・お気に入り星）を画素レベルで固定する。
//
// | ID   | 条件                                        | 期待                              |
// | ---- | ------------------------------------------- | ----------------------------------- |
// | T-01 | 未発走・重賞・お気に入り・カウントダウンあり | goldens/race_row_upcoming_favorite.png と一致 |
// | T-02 | 未発走・一般（グレードなし）                | goldens/race_row_plain.png と一致            |
// | T-03 | 発走済み（isPast）                          | goldens/race_row_past.png と一致             |
// | T-04 | 未発走・競輪・グレードなし・ステージ「決勝」 | goldens/race_row_stage.png と一致            |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/organisms/race_row.dart';
import 'package:front/domain/entities/race_entity.dart';

import 'golden_test_helpers.dart';

RaceEntity _race({
  required String grade,
  String raceType = 'jra',
  String? raceStage,
}) => RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: raceType,
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00',
  raceGrade: grade,
  raceNumber: 11,
  raceStage: raceStage,
);

void main() {
  testWidgets('[T-01] 未発走_重賞_お気に入り_カウントダウンあり', (tester) async {
    await pumpGolden(
      tester,
      RaceRow(
        race: _race(grade: 'GⅠ'),
        isPast: false,
        isFavorite: true,
        countdownMinutes: 5,
        onTap: () {},
        onToggleFavorite: () {},
      ),
      surfaceSize: const Size(360, 100),
    );

    await expectLater(
      find.byType(RaceRow),
      matchesGoldenFile('goldens/race_row_upcoming_favorite.png'),
    );
  });

  testWidgets('[T-02] 未発走_一般グレードなし', (tester) async {
    await pumpGolden(
      tester,
      RaceRow(
        race: _race(grade: ''),
        isPast: false,
        isFavorite: false,
        onTap: () {},
        onToggleFavorite: () {},
      ),
      surfaceSize: const Size(360, 100),
    );

    await expectLater(
      find.byType(RaceRow),
      matchesGoldenFile('goldens/race_row_plain.png'),
    );
  });

  testWidgets('[T-03] 発走済み_半透明表示', (tester) async {
    await pumpGolden(
      tester,
      RaceRow(
        race: _race(grade: 'GⅡ'),
        isPast: true,
        isFavorite: false,
        onTap: () {},
        onToggleFavorite: () {},
      ),
      surfaceSize: const Size(360, 100),
    );

    await expectLater(
      find.byType(RaceRow),
      matchesGoldenFile('goldens/race_row_past.png'),
    );
  });

  testWidgets('[T-04] 未発走_競輪_グレードなし_ステージ決勝', (tester) async {
    await pumpGolden(
      tester,
      RaceRow(
        race: _race(grade: '', raceType: 'keirin', raceStage: '決勝'),
        isPast: false,
        isFavorite: false,
        onTap: () {},
        onToggleFavorite: () {},
      ),
      surfaceSize: const Size(360, 100),
    );

    await expectLater(
      find.byType(RaceRow),
      matchesGoldenFile('goldens/race_row_stage.png'),
    );
  });
}
