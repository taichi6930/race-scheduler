// コンポーネントテスト: TripGroupsScreen → TripGroupDetailScreen の
// 画面横断ナビゲーション検証（BEHAV-050）。
//
// 一覧画面の行タップで実際の GoRouter を介して詳細画面（スタブではなく
// 本物の TripGroupDetailScreen）へ遷移し、選択したグループの内容
// （開催日一覧・候補期間）が正しく表示されることを検証する。

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/domain/entities/trip_candidate_period_entity.dart';
import 'package:front/domain/entities/trip_group_course_entity.dart';
import 'package:front/domain/entities/trip_group_entity.dart';
import 'package:front/features/trip_groups/application/trip_groups_provider.dart';
import 'package:front/features/trip_groups/presentation/trip_group_detail_screen.dart';
import 'package:front/features/trip_groups/presentation/trip_groups_screen.dart';
import 'package:go_router/go_router.dart';

const _mizusawaCourse = TripGroupCourseEntity(
  raceType: 'nar',
  raceCourse: '水沢',
  placeCode: '36',
);
const _kochiNar = TripGroupCourseEntity(
  raceType: 'nar',
  raceCourse: '高知',
  placeCode: '31',
);
const _kochiKeirin = TripGroupCourseEntity(
  raceType: 'keirin',
  raceCourse: '高知',
  placeCode: '74',
);

Widget _buildRoutedApp(List<TripGroupEntity> groups) {
  final router = GoRouter(
    initialLocation: '/trip-groups',
    routes: [
      GoRoute(
        path: '/trip-groups',
        builder: (context, state) => const TripGroupsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                TripGroupDetailScreen(groupId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
  return ProviderScope(
    overrides: [tripGroupsProvider.overrideWith((ref) => groups)],
    child: MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
  );
}

void main() {
  testWidgets('単独グループの行をタップ_実際の詳細画面へ遷移し開催日一覧が表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'mizusawa',
        name: '水沢（単独）',
        courses: [_mizusawaCourse],
        heldDates: ['2026-08-01', '2026-08-02'],
      ),
    ];
    await tester.pumpWidget(_buildRoutedApp(groups));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('水沢（単独）'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppBar, '水沢（単独）'), findsOneWidget);
    expect(find.text('2026年8月1日'), findsOneWidget);
    expect(find.text('2026年8月2日'), findsOneWidget);
  });

  testWidgets('複数会場グループの行をタップ_実際の詳細画面へ遷移し候補期間が表示される', (tester) async {
    final groups = [
      const TripGroupEntity(
        id: 'kochi',
        name: '高知',
        courses: [_kochiNar, _kochiKeirin],
        candidates: [
          TripCandidatePeriodEntity(
            startDate: '2026-08-01',
            endDate: '2026-08-02',
            courses: [
              TripCandidateCourseEntity(
                course: _kochiNar,
                dates: ['2026-08-01'],
              ),
              TripCandidateCourseEntity(
                course: _kochiKeirin,
                dates: ['2026-08-02'],
              ),
            ],
          ),
        ],
      ),
    ];
    await tester.pumpWidget(_buildRoutedApp(groups));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('高知'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppBar, '高知'), findsOneWidget);
    expect(find.text('2026年8月1日 〜 2026年8月2日'), findsOneWidget);
  });
}
