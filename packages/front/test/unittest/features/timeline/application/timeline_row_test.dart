// timeline_row.dart のデシジョンテーブル
//
// | ID   | 対象                 | 条件                                       | 期待                                    |
// | ---- | -------------------- | ------------------------------------------- | ---------------------------------------- |
// | T-01 | buildTimelineRows    | 空リスト                                    | 空リスト                                 |
// | T-02 | buildTimelineRows    | 単一日・当日・過去未来混在                   | ヘッダー1件＋NOWディバイダが境界に挿入   |
// | T-03 | buildTimelineRows    | 単一日・当日・全件過去                       | NOWディバイダなし                        |
// | T-04 | buildTimelineRows    | 単一日・当日・全件未来                       | NOWディバイダなし                        |
// | T-05 | buildTimelineRows    | 複数日（過去日・当日・未来日）               | 日付ごとにヘッダー、当日のみディバイダ   |
// | T-06 | splitTimelineRows    | 過去日・当日・未来日混在                     | pastは直近過去が先頭、futureは当日から昇順|
// | T-07 | splitTimelineRows    | 過去レースなし                               | pastが空                                 |
// | T-08 | splitTimelineRows    | 未来レースなし（当日含む未来が0件）           | futureが空                               |
// | T-09 | nextDividerBoundary  | futureが空                                  | null                                     |
// | T-10 | nextDividerBoundary  | 今日のレースが無い（翌日ヘッダーのみ）      | null                                     |
// | T-11 | nextDividerBoundary  | 今日の途中（ディバイダ直後にレースあり）    | 直後のレースの発走時刻                   |
// | T-12 | nextDividerBoundary  | 今日全て未発走（ディバイダなし）            | 今日最初のレースの発走時刻               |
// | T-13 | nextDividerBoundary  | 今日全て消化済み（ディバイダなし）          | null                                     |
// | T-14 | nextDividerBoundary  | ディバイダが今日最後の行（直後にレース無し）| null                                     |
// | T-15 | TimelineRowSplitCache| races同一・境界未到達                       | 同一インスタンスを再利用                 |
// | T-16 | TimelineRowSplitCache| races変化                                   | 再計算される                             |
// | T-17 | TimelineRowSplitCache| 日付が変化                                  | 再計算される                             |
// | T-18 | TimelineRowSplitCache| nowが境界時刻に到達                         | 再計算される                             |
// | T-19 | TimelineRowSplitCache| isFreshFor_resolve未実行                    | false                                    |
// | T-20 | TimelineRowSplitCache| isFreshFor_resolve後の境界内                | true                                     |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/timeline_row.dart';

RaceEntity _race(String id, String datetime) => RaceEntity(
  raceId: id,
  raceName: 'レース$id',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: datetime,
  raceNumber: 1,
);

void main() {
  group('buildTimelineRows', () {
    final now = DateTime(2026, 8, 6, 15, 0);

    test('[T-01] 空リスト_空リストを返す', () {
      expect(buildTimelineRows(const [], now), isEmpty);
    });

    test('[T-02] 単一日_当日_過去未来混在_境界にNOWディバイダが挿入される', () {
      final races = [
        _race('past', '2026-08-06T10:00:00'),
        _race('future', '2026-08-06T18:00:00'),
      ];

      final rows = buildTimelineRows(races, now);

      expect(rows, [
        isA<DateHeaderTimelineRow>(),
        isA<RaceTimelineRow>(),
        isA<NowDividerTimelineRow>(),
        isA<RaceTimelineRow>(),
      ]);
      expect((rows[1] as RaceTimelineRow).race.raceId, 'past');
      expect((rows[3] as RaceTimelineRow).race.raceId, 'future');
    });

    test('[T-03] 単一日_当日_全件過去_NOWディバイダなし', () {
      final races = [_race('past', '2026-08-06T10:00:00')];

      final rows = buildTimelineRows(races, now);

      expect(rows.whereType<NowDividerTimelineRow>(), isEmpty);
    });

    test('[T-04] 単一日_当日_全件未来_NOWディバイダなし', () {
      final races = [_race('future', '2026-08-06T18:00:00')];

      final rows = buildTimelineRows(races, now);

      expect(rows.whereType<NowDividerTimelineRow>(), isEmpty);
    });

    test('[T-05] 複数日_日付ごとにヘッダー_当日のみディバイダ', () {
      final races = [
        _race('yesterday', '2026-08-05T10:00:00'),
        _race('today-past', '2026-08-06T10:00:00'),
        _race('today-future', '2026-08-06T18:00:00'),
        _race('tomorrow', '2026-08-07T10:00:00'),
      ];

      final rows = buildTimelineRows(races, now);

      final headers = rows.whereType<DateHeaderTimelineRow>().toList();
      expect(headers.map((h) => h.date).toList(), [
        DateTime(2026, 8, 5),
        DateTime(2026, 8, 6),
        DateTime(2026, 8, 7),
      ]);
      expect(rows.whereType<NowDividerTimelineRow>().length, 1);
    });
  });

  group('splitTimelineRows', () {
    final now = DateTime(2026, 8, 6, 15, 0);

    test('[T-06] 過去日_当日_未来日混在_pastは直近過去が先頭_futureは当日から昇順', () {
      final races = [
        _race('2daysago', '2026-08-04T10:00:00'),
        _race('yesterday', '2026-08-05T10:00:00'),
        _race('today', '2026-08-06T18:00:00'),
        _race('tomorrow', '2026-08-07T10:00:00'),
      ];

      final split = splitTimelineRows(races, now);

      final pastRaceIds = split.past
          .whereType<RaceTimelineRow>()
          .map((r) => r.race.raceId)
          .toList();
      final futureRaceIds = split.future
          .whereType<RaceTimelineRow>()
          .map((r) => r.race.raceId)
          .toList();
      expect(pastRaceIds, ['yesterday', '2daysago']);
      expect(futureRaceIds, ['today', 'tomorrow']);
    });

    test('[T-07] 過去レースなし_pastが空', () {
      final races = [_race('today', '2026-08-06T18:00:00')];

      final split = splitTimelineRows(races, now);

      expect(split.past, isEmpty);
    });

    test('[T-08] 未来レースなし_futureが空', () {
      final races = [_race('yesterday', '2026-08-05T10:00:00')];

      final split = splitTimelineRows(races, now);

      expect(split.future, isEmpty);
    });
  });

  group('nextDividerBoundary', () {
    final now = DateTime(2026, 8, 6, 15, 0);

    test('[T-09] futureが空_nullを返す', () {
      final split = TimelineRowSplit(past: const [], future: const []);

      expect(nextDividerBoundary(split, now), isNull);
    });

    test('[T-10] 今日のレースが無い_翌日ヘッダーのみ_nullを返す', () {
      final tomorrow = _race('tomorrow', '2026-08-07T10:00:00');
      final split = splitTimelineRows([tomorrow], now);

      expect(nextDividerBoundary(split, now), isNull);
    });

    test('[T-11] 今日の途中_ディバイダ直後のレース発走時刻を返す', () {
      final races = [
        _race('past', '2026-08-06T10:00:00'),
        _race('next', '2026-08-06T18:00:00'),
        _race('later', '2026-08-06T20:00:00'),
      ];
      final split = splitTimelineRows(races, now);

      expect(nextDividerBoundary(split, now), DateTime(2026, 8, 6, 18, 0));
    });

    test('[T-12] 今日全て未発走_今日最初のレース発走時刻を返す', () {
      final races = [
        _race('first', '2026-08-06T18:00:00'),
        _race('second', '2026-08-06T20:00:00'),
      ];
      final split = splitTimelineRows(races, now);

      expect(nextDividerBoundary(split, now), DateTime(2026, 8, 6, 18, 0));
    });

    test('[T-13] 今日全て消化済み_nullを返す', () {
      final races = [_race('past', '2026-08-06T10:00:00')];
      final split = splitTimelineRows(races, now);

      expect(nextDividerBoundary(split, now), isNull);
    });

    test('[T-14] ディバイダが今日最後の行_直後にレース無し_nullを返す', () {
      // buildTimelineRows は必ずディバイダ直後にレース行を続けて挿入するため
      // 実際には起き得ない並びだが、防御的分岐（ディバイダより後に今日の
      // レースが見つからない場合）を直接検証するため手動で構築する。
      final split = TimelineRowSplit(
        past: const [],
        future: [
          DateHeaderTimelineRow(DateTime(2026, 8, 6)),
          RaceTimelineRow(_race('past', '2026-08-06T10:00:00')),
          NowDividerTimelineRow(now),
        ],
      );

      expect(nextDividerBoundary(split, now), isNull);
    });
  });

  group('TimelineRowSplitCache', () {
    final now = DateTime(2026, 8, 6, 15, 0);

    test('[T-15] races同一_境界未到達_同一インスタンスを再利用する', () {
      final races = [
        _race('past', '2026-08-06T10:00:00'),
        _race('next', '2026-08-06T18:00:00'),
      ];
      final cache = TimelineRowSplitCache();

      final first = cache.resolve(races, now);
      final second = cache.resolve(
        races,
        now.add(const Duration(minutes: 1)),
      );

      expect(identical(first, second), isTrue);
    });

    test('[T-16] races変化_再計算される', () {
      final racesA = [_race('a', '2026-08-06T18:00:00')];
      final racesB = [_race('b', '2026-08-06T18:00:00')];
      final cache = TimelineRowSplitCache();

      final first = cache.resolve(racesA, now);
      final second = cache.resolve(racesB, now);

      expect(identical(first, second), isFalse);
    });

    test('[T-17] 日付が変化_再計算される', () {
      final races = [_race('today', '2026-08-06T18:00:00')];
      final cache = TimelineRowSplitCache();
      final nextDay = now.add(const Duration(days: 1));

      final first = cache.resolve(races, now);
      final second = cache.resolve(races, nextDay);

      expect(identical(first, second), isFalse);
    });

    test('[T-18] nowが境界時刻に到達_再計算される', () {
      final races = [
        _race('past', '2026-08-06T10:00:00'),
        _race('next', '2026-08-06T15:30:00'),
      ];
      final cache = TimelineRowSplitCache();
      final atBoundary = DateTime(2026, 8, 6, 15, 30);

      final first = cache.resolve(races, now);
      final second = cache.resolve(races, atBoundary);

      expect(identical(first, second), isFalse);
    });

    test('[T-19] isFreshFor_resolve未実行_falseを返す', () {
      final cache = TimelineRowSplitCache();

      expect(cache.isFreshFor(now), isFalse);
    });

    test('[T-20] isFreshFor_resolve後の境界内_trueを返す', () {
      final races = [
        _race('past', '2026-08-06T10:00:00'),
        _race('next', '2026-08-06T18:00:00'),
      ];
      final cache = TimelineRowSplitCache();
      cache.resolve(races, now);

      expect(cache.isFreshFor(now.add(const Duration(minutes: 1))), isTrue);
    });
  });
}
