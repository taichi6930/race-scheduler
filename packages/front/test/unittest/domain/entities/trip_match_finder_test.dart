// findTripCandidates / toJstDateKey のデシジョンテーブル
//
// | ID   | 入力                                                  | toleranceDays | 期待結果                            |
// | ---- | -------------------------------------------------------- | --------------- | -------------------------------------- |
// | T-01 | 2会場が同日開催                                       | 2             | 1候補（1日間、2会場とも含む）         |
// | T-02 | 2会場が同日・1会場が翌日（3会場グループ）              | 2             | 1候補（2日間、3会場とも含む）         |
// | T-03 | toleranceDaysを超える間隔しかない2会場                | 2             | 候補なし（空配列）                    |
// | T-04 | 同一会場のみが連日開催（他会場と重ならない）           | 2             | 候補なし（1会場のみのクラスタは除外） |
// | T-05 | 開催日が1つもない会場を含むグループ                    | 2             | その会場は無視して残り2会場で判定     |
// | T-06 | 2会場の間隔がちょうどtoleranceDays                    | 2             | 1候補（同一クラスタ）                 |
// | T-07 | 2会場の間隔がtoleranceDays+1                          | 2             | 候補なし（別クラスタ）                |
// | T-08 | 単独グループ相当（course 1件のみ）                     | 2             | 候補なし（distinct courseが1のため）  |
// | T-09 | toleranceDays省略                                     | (既定値2)      | 既定値2が使われる                     |
// | T-10 | JST翌日0時にまたぐ日時をtoJstDateKeyへ渡す              | -             | JSTの日付キーを返す                   |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/trip_group_course_entity.dart';
import 'package:front/domain/entities/trip_match_finder.dart';

const _kokuraJra = TripGroupCourseEntity(
  raceType: 'jra',
  raceCourse: '小倉',
  placeCode: '10',
);
const _kokuraKeirin = TripGroupCourseEntity(
  raceType: 'keirin',
  raceCourse: '小倉',
  placeCode: '81',
);
const _iizukaAutorace = TripGroupCourseEntity(
  raceType: 'autorace',
  raceCourse: '飯塚',
  placeCode: '05',
);

void main() {
  group('findTripCandidates', () {
    test('[T-01] 2会場が同日開催_1候補(1日間)を返す', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-01']),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, hasLength(1));
      expect(result.first.startDate, '2026-08-01');
      expect(result.first.endDate, '2026-08-01');
      expect(result.first.courses, hasLength(2));
    });

    test('[T-02] 2会場が同日_1会場が翌日_1候補(2日間,3会場とも含む)を返す', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-01']),
        const CourseHeldDates(course: _iizukaAutorace, dates: ['2026-08-02']),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, hasLength(1));
      expect(result.first.startDate, '2026-08-01');
      expect(result.first.endDate, '2026-08-02');
      expect(result.first.courses, hasLength(3));
    });

    test('[T-03] toleranceDaysを超える間隔しかない2会場_候補なし', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-10']),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, isEmpty);
    });

    test('[T-04] 同一会場のみが連日開催_候補として採用しない', () {
      final courseHeldDates = [
        const CourseHeldDates(
          course: _kokuraJra,
          dates: ['2026-08-01', '2026-08-02', '2026-08-03'],
        ),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, isEmpty);
    });

    test('[T-05] 開催日が1つもない会場を含むグループ_その会場は無視して残りで判定する', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-01']),
        const CourseHeldDates(course: _iizukaAutorace, dates: []),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, hasLength(1));
      expect(result.first.courses, hasLength(2));
    });

    test('[T-06] 2会場の間隔がちょうどtoleranceDays_同一クラスタとして1候補を返す', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-03']),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, hasLength(1));
      expect(result.first.startDate, '2026-08-01');
      expect(result.first.endDate, '2026-08-03');
    });

    test('[T-07] 2会場の間隔がtoleranceDays+1_別クラスタとなり候補なし', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-04']),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, isEmpty);
    });

    test('[T-08] courseが1件のみ_候補なし', () {
      final courseHeldDates = [
        const CourseHeldDates(
          course: _kokuraJra,
          dates: ['2026-08-01', '2026-08-02'],
        ),
      ];

      final result = findTripCandidates(courseHeldDates, toleranceDays: 2);

      expect(result, isEmpty);
    });

    test('[T-09] toleranceDays省略_既定値2が使われる', () {
      final courseHeldDates = [
        const CourseHeldDates(course: _kokuraJra, dates: ['2026-08-01']),
        const CourseHeldDates(course: _kokuraKeirin, dates: ['2026-08-03']),
      ];

      final result = findTripCandidates(courseHeldDates);

      expect(result, hasLength(1));
    });
  });

  group('toJstDateKey', () {
    test("[T-10] JST壁時計表現のDateTimeからYYYY-MM-DD形式の日付キーを返す", () {
      final date = DateTime.utc(2026, 1, 2);

      final result = toJstDateKey(date);

      expect(result, '2026-01-02');
    });
  });
}
