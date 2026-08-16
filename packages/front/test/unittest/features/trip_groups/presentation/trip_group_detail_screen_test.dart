// TripGroupDetailScreen のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                          |
// | ---- | ------------------------------------------- | ------------------------------------------------ |
// | T-01 | 単独グループ                                | 開催日一覧が表示される                            |
// | T-02 | 複数会場グループ・候補あり                  | 候補期間（開始日〜終了日・会場ごとの開催日）が表示される |
// | T-03 | 複数会場グループ・候補なし                  | 「候補なし」が表示される                          |
// | T-04 | 指定groupIdが一覧に存在しない                | 「見つかりません」が表示される                    |
// | T-05 | ローディング中                              | LoadingSkeletonListが表示される                   |
// | T-06 | エラー                                      | ErrorRetryCardが表示される                        |
// | T-07 | エラー状態で再試行ボタンを実タップ（BEHAV-047） | 再取得され詳細が表示される                    |
// | T-08 | 日付表示（FEDGE-06）                       | YYYY-MM-DDではなくYYYY年M月d日形式で表示される    |

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/error_retry_card.dart';
import 'package:front/design/molecules/loading_skeleton_list.dart';
import 'package:front/domain/entities/trip_candidate_period_entity.dart';
import 'package:front/domain/entities/trip_group_course_entity.dart';
import 'package:front/domain/entities/trip_group_entity.dart';
import 'package:front/features/trip_groups/application/trip_groups_provider.dart';
import 'package:front/features/trip_groups/presentation/trip_group_detail_screen.dart';

const _course = TripGroupCourseEntity(
  raceType: 'nar',
  raceCourse: '高知',
  placeCode: '31',
);
const _course2 = TripGroupCourseEntity(
  raceType: 'keirin',
  raceCourse: '高知',
  placeCode: '74',
);

Widget _buildApp(
  List<TripGroupEntity> groups, {
  String groupId = 'kochi',
  Duration? Function(int retryCount, Object error)? retry,
}) {
  return ProviderScope(
    retry: retry,
    overrides: [tripGroupsProvider.overrideWith((ref) => groups)],
    child: MaterialApp(
      theme: AppTheme.light(),
      home: TripGroupDetailScreen(groupId: groupId),
    ),
  );
}

void main() {
  testWidgets('[T-01] 単独グループ_開催日一覧が表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'mizusawa',
        name: '水沢（単独）',
        courses: [_course],
        heldDates: ['2026-08-01', '2026-08-02'],
      ),
    ];
    await tester.pumpWidget(_buildApp(groups, groupId: 'mizusawa'));
    await tester.pump();
    await tester.pump();

    expect(find.text('2026年8月1日'), findsOneWidget);
    expect(find.text('2026年8月2日'), findsOneWidget);
  });

  testWidgets('[T-02] 複数会場グループ_候補あり_候補期間が表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'kochi',
        name: '高知',
        courses: [_course, _course2],
        candidates: [
          TripCandidatePeriodEntity(
            startDate: '2026-08-01',
            endDate: '2026-08-02',
            courses: [
              TripCandidateCourseEntity(course: _course, dates: ['2026-08-01']),
              TripCandidateCourseEntity(
                course: _course2,
                dates: ['2026-08-02'],
              ),
            ],
          ),
        ],
      ),
    ];
    await tester.pumpWidget(_buildApp(groups));
    await tester.pump();
    await tester.pump();

    expect(find.text('2026年8月1日 〜 2026年8月2日'), findsOneWidget);
    expect(find.textContaining('nar / 高知'), findsOneWidget);
    expect(find.textContaining('keirin / 高知'), findsOneWidget);
  });

  testWidgets('[T-03] 複数会場グループ_候補なし_候補なしが表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'kochi',
        name: '高知',
        courses: [_course, _course2],
        candidates: [],
      ),
    ];
    await tester.pumpWidget(_buildApp(groups));
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('候補なし'), findsOneWidget);
  });

  testWidgets('[T-04] 指定groupIdが一覧に存在しない_見つかりませんが表示される', (tester) async {
    final groups = [
      const TripGroupEntity(id: 'kochi', name: '高知', courses: [_course]),
    ];
    await tester.pumpWidget(_buildApp(groups, groupId: 'unknown'));
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('見つかりません'), findsOneWidget);
  });

  testWidgets('[T-05] ローディング中_LoadingSkeletonListが表示される', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tripGroupsProvider.overrideWith(
            (ref) => Completer<List<TripGroupEntity>>().future,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TripGroupDetailScreen(groupId: 'kochi'),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(LoadingSkeletonList), findsOneWidget);
  });

  testWidgets('[T-06] エラー_ErrorRetryCardが表示される', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        retry: (retryCount, error) => null,
        overrides: [
          tripGroupsProvider.overrideWith(
            (ref) => Future<List<TripGroupEntity>>.error(Exception('failed')),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TripGroupDetailScreen(groupId: 'kochi'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(ErrorRetryCard), findsOneWidget);
  });

  testWidgets('[T-07] エラー状態で再試行ボタンを実タップ_再取得され詳細が表示される', (tester) async {
    var shouldFail = true;
    final groups = [
      const TripGroupEntity(
        id: 'mizusawa',
        name: '水沢（単独）',
        courses: [_course],
        heldDates: ['2026-08-01'],
      ),
    ];
    await tester.pumpWidget(
      ProviderScope(
        retry: (retryCount, error) => null,
        overrides: [
          tripGroupsProvider.overrideWith((ref) async {
            if (shouldFail) throw Exception('failed');
            return groups;
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TripGroupDetailScreen(groupId: 'mizusawa'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(ErrorRetryCard), findsOneWidget);

    shouldFail = false;
    await tester.tap(find.text('再試行'));
    await tester.pump();
    await tester.pump();

    expect(find.byType(ErrorRetryCard), findsNothing);
    expect(find.text('2026年8月1日'), findsOneWidget);
  });

  testWidgets('[T-08] 日付表示_YYYY-MM-DDではなくYYYY年M月d日形式で表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'kochi',
        name: '高知',
        courses: [_course, _course2],
        candidates: [
          TripCandidatePeriodEntity(
            startDate: '2026-08-01',
            endDate: '2026-08-01',
            courses: [
              TripCandidateCourseEntity(
                course: _course,
                dates: ['2026-08-01', '2026-08-09'],
              ),
            ],
          ),
        ],
      ),
    ];
    await tester.pumpWidget(_buildApp(groups));
    await tester.pump();
    await tester.pump();

    // 開始日=終了日の単一日表示（〜 区切りなし）もYYYY年M月d日形式になること
    expect(find.text('2026年8月1日'), findsOneWidget);
    // 会場ごとの開催日一覧も同形式で連結されること
    expect(find.textContaining('2026年8月1日、2026年8月9日'), findsOneWidget);
    expect(find.textContaining('2026-'), findsNothing);
  });
}
