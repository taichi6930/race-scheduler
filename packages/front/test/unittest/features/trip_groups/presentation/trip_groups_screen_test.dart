// TripGroupsScreen のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                        |
// | ---- | ------------------------------------------- | ---------------------------------------------- |
// | T-01 | 単独グループ（heldDatesあり）              | 「開催日 N件」が表示される                     |
// | T-02 | 複数会場グループ・候補あり                  | 「直近候補: 開始日〜終了日」が表示される       |
// | T-03 | 複数会場グループ・候補なし（空配列）        | 「候補なし」が表示される                       |
// | T-04 | ローディング中                              | LoadingSkeletonListが表示される                |
// | T-05 | エラー                                      | ErrorRetryCardが表示され、再試行で再取得する   |
// | T-06 | 更新ボタンをタップ                          | tripGroupsProviderが再取得される               |
// | T-07 | pull-to-refreshで引っ張る                   | tripGroupsProviderが再取得される               |
// | T-08 | 一覧行をタップ（BEHAV-045）                | /trip-groups/:id へ遷移する                  |
// | T-09 | エラー状態で再試行ボタンを実タップ（BEHAV-046） | tripGroupsProviderが再取得され復帰する      |

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
import 'package:front/features/trip_groups/presentation/trip_groups_screen.dart';
import 'package:go_router/go_router.dart';

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
  FutureOr<List<TripGroupEntity>> Function() createGroupsFuture,
) {
  return ProviderScope(
    overrides: [tripGroupsProvider.overrideWith((ref) => createGroupsFuture())],
    child: MaterialApp(theme: AppTheme.light(), home: const TripGroupsScreen()),
  );
}

void main() {
  testWidgets('[T-01] 単独グループ_開催日N件が表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'mizusawa',
        name: '水沢（単独）',
        courses: [_course],
        heldDates: ['2026-08-01', '2026-08-02'],
      ),
    ];
    await tester.pumpWidget(_buildApp(() => groups));
    await tester.pump();
    await tester.pump();

    expect(find.text('水沢（単独）'), findsOneWidget);
    expect(find.text('開催日 2件'), findsOneWidget);
  });

  testWidgets('[T-02] 複数会場グループ_候補あり_直近候補の要約が表示される', (tester) async {
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
            ],
          ),
        ],
      ),
    ];
    await tester.pumpWidget(_buildApp(() => groups));
    await tester.pump();
    await tester.pump();

    expect(find.text('直近候補: 2026年8月1日〜2026年8月2日'), findsOneWidget);
  });

  testWidgets('[T-03] 複数会場グループ_候補なし_候補なしが表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'kyoto',
        name: '京都',
        courses: [_course, _course2],
        candidates: [],
      ),
    ];
    await tester.pumpWidget(_buildApp(() => groups));
    await tester.pump();
    await tester.pump();

    expect(find.text('候補なし'), findsOneWidget);
  });

  testWidgets('[T-04] ローディング中_LoadingSkeletonListが表示される', (tester) async {
    await tester.pumpWidget(
      _buildApp(() => Completer<List<TripGroupEntity>>().future),
    );
    await tester.pump();

    expect(find.byType(LoadingSkeletonList), findsOneWidget);
  });

  testWidgets('[T-05] エラー_ErrorRetryCardが表示される', (tester) async {
    // riverpod 3系はデフォルトでエラー時に自動リトライ（指数バックオフ、最大約
    // 6.4秒間隔・最大10回）するため、`retry: (_, _) => null` でリトライを無効化し、
    // 即座にAsyncErrorへ遷移させて検証する。
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
          home: const TripGroupsScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(ErrorRetryCard), findsOneWidget);
    expect(find.text('旅程グループの取得に失敗しました'), findsOneWidget);
  });

  testWidgets('[T-06] 更新ボタンをタップ_tripGroupsProviderが再取得される', (tester) async {
    var callCount = 0;
    await tester.pumpWidget(
      _buildApp(() {
        callCount++;
        return <TripGroupEntity>[];
      }),
    );
    await tester.pump();
    await tester.pump();
    expect(callCount, 1);

    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pump();
    await tester.pump();

    expect(callCount, 2);
  });

  testWidgets('[T-07] pull-to-refreshで引っ張る_tripGroupsProviderが再取得される', (
    tester,
  ) async {
    var callCount = 0;
    await tester.pumpWidget(
      _buildApp(() {
        callCount++;
        return <TripGroupEntity>[];
      }),
    );
    await tester.pumpAndSettle();
    expect(callCount, 1);

    await tester.fling(
      find.textContaining('表示できる旅程グループがありません'),
      const Offset(0, 300),
      1000,
    );
    await tester.pumpAndSettle();

    expect(callCount, 2);
  });

  testWidgets('[T-08] 一覧行をタップ_trip-groups/idへ遷移する', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'mizusawa',
        name: '水沢（単独）',
        courses: [_course],
        heldDates: ['2026-08-01', '2026-08-02'],
      ),
    ];
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const TripGroupsScreen(),
        ),
        GoRoute(
          path: '/trip-groups/:id',
          builder: (context, state) =>
              Scaffold(body: Text('旅程グループ詳細:${state.pathParameters['id']}')),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [tripGroupsProvider.overrideWith((ref) => groups)],
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('水沢（単独）'));
    await tester.pumpAndSettle();

    expect(find.text('旅程グループ詳細:mizusawa'), findsOneWidget);
  });

  testWidgets('[T-09] エラー状態で再試行ボタンを実タップ_再取得され復帰する', (tester) async {
    var shouldFail = true;
    await tester.pumpWidget(
      ProviderScope(
        retry: (retryCount, error) => null,
        overrides: [
          tripGroupsProvider.overrideWith((ref) async {
            if (shouldFail) throw Exception('failed');
            return <TripGroupEntity>[];
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TripGroupsScreen(),
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
    expect(find.textContaining('表示できる旅程グループがありません'), findsOneWidget);
  });
}
