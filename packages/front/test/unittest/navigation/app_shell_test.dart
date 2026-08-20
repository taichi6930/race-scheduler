// AppShell（3タブナビゲーション）のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                   |
// | ---- | ----------------------------- | ---------------------------------------- |
// | T-01 | 画面幅 < 900dp（モバイル幅）  | NavigationBar（下部ナビ）が表示される  |
// | T-02 | 画面幅 >= 900dp（広画面幅）   | NavigationRail（サイドレール）が表示される |
// | T-04 | 「お気に入り」タブをタップ    | お気に入り画面へ切り替わる              |
// | T-05 | 「設定」タブをタップ（BEHAV-048） | 設定画面へ切り替わる                |
// | T-06 | お気に入り3件登録済み（QINF-05） | お気に入りタブに件数バッジ「3」が表示される |
// | T-07 | お気に入り0件（QINF-05）         | お気に入りタブにバッジが表示されない        |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_races_provider.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/navigation/app_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/session_test_overrides.dart';

/// テストで任意のお気に入りID集合を固定するNotifier（QINF-05のバッジ検証用）。
class _FixedFavoriteIdsNotifier extends FavoriteIdsNotifier {
  _FixedFavoriteIdsNotifier(this._initial);

  final Set<String> _initial;

  @override
  Set<String> build() => _initial;
}

Future<Widget> _buildApp({Set<String>? favoriteIds}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      loggedInSessionOverride(),
      // TimelineScreen・FavoritesScreen が実データ取得を行うため、
      // getIt/ネットワークを介さず確定値で応答させる
      // （AppShellの検証にレースデータそのものは不要）。
      // KPLAYER-07: favoriteRacesRawProviderはisWatched判定のため
      // favoriteIdsが空でも常にAPIを呼ぶようになったため、明示的に上書きする。
      timelineProvider.overrideWith((ref, date) async => const <RaceEntity>[]),
      favoriteRacesRawProvider.overrideWith(
        (ref) async => const <RaceEntity>[],
      ),
      if (favoriteIds != null)
        favoriteIdsProvider.overrideWith(
          () => _FixedFavoriteIdsNotifier(favoriteIds),
        ),
    ],
    child: const MyApp(),
  );
}

void main() {
  setUp(() {
    // GoRouter はモジュールレベルの単一インスタンスのため、
    // テスト間の状態リークを防ぐため毎回初期位置に戻す。
    appRouter.go('/timeline');
  });

  group('AppShell レスポンシブ切り替え', () {
    testWidgets('[T-01] モバイル幅_NavigationBarが表示される', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp());
      await tester.pumpAndSettle();

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
    });

    testWidgets('[T-02] 広画面幅_NavigationRailが表示される', (tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp());
      await tester.pumpAndSettle();

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
    });
  });

  group('AppShell タブ切り替え', () {
    testWidgets('[T-04] お気に入りタブをタップ_お気に入り画面が表示される', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp());
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(NavigationDestination, 'お気に入り'));
      await tester.pumpAndSettle();

      expect(find.textContaining('お気に入りはまだありません'), findsOneWidget);
    });

    testWidgets('[T-05] 設定タブをタップ_設定画面が表示される', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp());
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(NavigationDestination, '設定'));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(AppBar, '設定'), findsOneWidget);
      expect(find.text('通知を受け取る'), findsOneWidget);
    });
  });

  group('AppShell お気に入り件数バッジ', () {
    testWidgets('[T-06] お気に入り3件登録済み_お気に入りタブに件数バッジが表示される', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp(favoriteIds: {'a', 'b', 'c'}));
      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('3'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('[T-07] お気に入り0件_お気に入りタブにバッジが表示されない', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(await _buildApp(favoriteIds: {}));
      await tester.pumpAndSettle();

      final badges = tester.widgetList<Badge>(find.byType(Badge));
      expect(badges, hasLength(1));
      expect(badges.single.isLabelVisible, isFalse);
    });
  });
}
