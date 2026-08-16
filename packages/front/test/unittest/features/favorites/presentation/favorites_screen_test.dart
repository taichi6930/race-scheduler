// FavoritesScreen のデシジョンテーブル
//
// | ID   | 条件                     | 期待                                       |
// | ---- | ------------------------ | -------------------------------------------- |
// | T-01 | お気に入りレースがある   | レース名が一覧表示される                    |
// | T-02 | お気に入りが0件          | 空状態メッセージが表示される                |
// | T-03 | 更新ボタンをタップ       | favoriteRacesRawProviderが再取得される      |
// | T-04 | pull-to-refreshで引っ張る | favoriteRacesRawProviderが再取得される      |
// | T-05 | ★をタップして解除（BEHAV-038） | 一覧から消え空状態表示に切り替わる       |
// | T-06 | favoriteRacesRawProviderが失敗（BEHAV-037） | ErrorRetryCardが表示され、再試行で復帰する |
// | T-07 | レース行タップ（BEHAV-039）  | 詳細シート（RaceDetailContent）が表示される |
// | T-08 | 「選手」サブタブをタップ（KPLAYER-07） | PlayersTabが表示され、レース一覧は隠れる |
// | T-09 | お気に入りが0件で「タイムラインを見る」をタップ（QEMP-02） | /timeline へ遷移する |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/race_row.dart';
import 'package:front/domain/entities/player_entity.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/repositories/i_player_repository.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_races_provider.dart';
import 'package:front/features/favorites/presentation/favorites_screen.dart';
import 'package:front/features/players/presentation/players_tab.dart';
import 'package:front/features/timeline/application/now_provider.dart';
import 'package:front/features/timeline/presentation/race_detail_sheet.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _EmptyPlayerRepository implements IPlayerRepository {
  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async => const [];

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {}
}

class _FixedFavoriteIdsNotifier extends FavoriteIdsNotifier {
  _FixedFavoriteIdsNotifier(this._ids);

  final Set<String> _ids;

  @override
  Set<String> build() => _ids;
}

final _fixedNow = DateTime(2026, 4, 19, 15, 35);

RaceEntity _race(String id, String name) => RaceEntity(
  raceId: id,
  raceName: name,
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: _fixedNow.add(const Duration(minutes: 10)).toIso8601String(),
  raceNumber: 11,
);

/// お気に入り行が [RaceEntity.isWatched] 判定のため favoriteIdsProvider
/// （＝sharedPreferencesProvider）を watch するようになった（KPLAYER-07）ため、
/// ここでも空のprefsを用意して初期化エラーを避ける。
Future<Widget> _buildApp(List<RaceEntity> races) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
      favoriteRacesProvider.overrideWith((ref) => AsyncValue.data(races)),
    ],
    child: MaterialApp(theme: AppTheme.light(), home: const FavoritesScreen()),
  );
}

void main() {
  testWidgets('[T-01] お気に入りレースがある_一覧表示される', (tester) async {
    await tester.pumpWidget(await _buildApp([_race('a', '伏竜ステークス')]));
    await tester.pump();

    expect(find.text('伏竜ステークス'), findsOneWidget);
  });

  testWidgets('[T-02] お気に入りが0件_空状態が表示される', (tester) async {
    await tester.pumpWidget(await _buildApp([]));
    await tester.pump();

    expect(find.textContaining('お気に入りはまだありません'), findsOneWidget);
  });

  testWidgets('[T-03] 更新ボタンをタップ_favoriteRacesRawProviderが再取得される', (
    tester,
  ) async {
    var callCount = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier(const {}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) {
            callCount++;
            return Future.value(const <RaceEntity>[]);
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pump();
    expect(callCount, 1);

    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pump();

    expect(callCount, 2);
  });

  testWidgets('[T-04] pull-to-refreshで引っ張る_favoriteRacesRawProviderが再取得される', (
    tester,
  ) async {
    var callCount = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier(const {}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) {
            callCount++;
            return Future.value(const <RaceEntity>[]);
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(callCount, 1);

    await tester.fling(
      find.textContaining('お気に入りはまだありません'),
      const Offset(0, 300),
      1000,
    );
    await tester.pumpAndSettle();

    expect(callCount, 2);
  });

  testWidgets('[T-05] ★をタップして解除_一覧から消え空状態表示に切り替わること', (tester) async {
    SharedPreferences.setMockInitialValues({
      'favorite_race_ids': ['a'],
    });
    final prefs = await SharedPreferences.getInstance();
    // nowProviderは実時刻（jstNow()）を使う実装のまま上書きしないため
    // （StreamProviderの初回値とフォールバック値の食い違いによる
    // UpcomingFavoritesCacheの誤キャッシュを避ける）、レースの発走時刻も
    // 実時刻基準の未来にする。
    final race = RaceEntity(
      raceId: 'a',
      raceName: '伏竜ステークス',
      raceType: 'jra',
      placeId: 'place-a',
      raceCourse: '中山',
      datetime: DateTime.now().add(const Duration(days: 1)).toIso8601String(),
      raceNumber: 11,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          favoriteRacesRawProvider.overrideWith((ref) => Future.value([race])),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('伏竜ステークス'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('お気に入り解除'));
    await tester.pumpAndSettle();

    expect(find.text('伏竜ステークス'), findsNothing);
    expect(find.textContaining('お気に入りはまだありません'), findsOneWidget);
  });

  testWidgets('[T-06] favoriteRacesRawProviderが失敗_ErrorRetryCard表示・再試行で復帰する', (
    tester,
  ) async {
    var shouldFail = true;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier(const {'a'}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) async {
            if (shouldFail) throw Exception('network error');
            return [_race('a', '伏竜ステークス')];
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('お気に入りの取得に失敗しました'), findsOneWidget);
    expect(find.text('伏竜ステークス'), findsNothing);

    shouldFail = false;
    await tester.tap(find.text('再試行'));
    await tester.pumpAndSettle();

    expect(find.text('お気に入りの取得に失敗しました'), findsNothing);
    expect(find.text('伏竜ステークス'), findsOneWidget);
  });

  testWidgets('[T-07] レース行タップ_詳細シートが表示される', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteRacesProvider.overrideWith(
            (ref) => AsyncValue.data([_race('a', '伏竜ステークス')]),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(RaceDetailContent), findsNothing);

    await tester.tap(
      find.descendant(of: find.byType(RaceRow), matching: find.text('伏竜ステークス')),
    );
    await tester.pumpAndSettle();

    expect(find.byType(RaceDetailContent), findsOneWidget);
  });

  testWidgets('[T-08] 「選手」サブタブをタップ_PlayersTabが表示されレース一覧は隠れる', (tester) async {
    getIt.registerSingleton<IPlayerRepository>(_EmptyPlayerRepository());
    addTearDown(() => getIt.unregister<IPlayerRepository>());
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteRacesProvider.overrideWith(
            (ref) => AsyncValue.data([_race('a', '伏竜ステークス')]),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const FavoritesScreen(),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('伏竜ステークス'), findsOneWidget);

    await tester.tap(find.text('選手'));
    await tester.pumpAndSettle();

    expect(find.text('伏竜ステークス'), findsNothing);
    expect(find.byType(PlayersTab), findsOneWidget);
  });

  testWidgets('[T-09] お気に入りが0件でタイムラインを見るをタップ_timelineへ遷移する', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const FavoritesScreen(),
        ),
        GoRoute(
          path: '/timeline',
          builder: (context, state) => const Scaffold(body: Text('タイムライン画面')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteRacesProvider.overrideWith(
            (ref) => const AsyncValue.data([]),
          ),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('タイムラインを見る'));
    await tester.pumpAndSettle();

    expect(find.text('タイムライン画面'), findsOneWidget);
  });
}
