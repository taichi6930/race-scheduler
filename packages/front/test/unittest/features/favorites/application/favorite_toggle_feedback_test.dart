// toggleFavoriteWithFeedback のデシジョンテーブル
//
// | ID   | 条件                                  | 期待                                          |
// | ---- | ------------------------------------- | ----------------------------------------------- |
// | T-01 | 未登録レースをtoggle（新規登録）      | favoriteIdsProviderに追加され、登録SnackBarが出る |
// | T-02 | 登録済みレースをtoggle（解除）        | favoriteIdsProviderから削除され、SnackBarは出ない |
// | T-03 | 新規登録時のSnackBarの「取り消す」    | タップすると再度toggleされ登録が取り消される  |
// | T-04 | 保存失敗                              | 表示は一旦切り替わった後、失敗時に元の状態へ戻り、失敗SnackBarが出る |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/repositories/i_favorites_repository.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_toggle_feedback.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 常に保存失敗を返すフェイクリポジトリ（T-04用）。
class _AlwaysFailingFavoritesRepository implements IFavoritesRepository {
  @override
  Future<Set<String>> loadFavoriteRaceIds() async => const <String>{};

  @override
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds) async => false;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<Widget> buildApp(
    void Function(WidgetRef ref) captureRef, {
    List<Override> extraOverrides = const [],
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        ...extraOverrides,
      ],
      child: Consumer(
        builder: (context, ref, _) {
          captureRef(ref);
          return MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () =>
                      toggleFavoriteWithFeedback(context, ref, 'race-001'),
                  child: const Text('トグル'),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  testWidgets('[T-01] 未登録レースをtoggle_追加され登録SnackBarが出る', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await buildApp((r) => ref = r));

    await tester.tap(find.text('トグル'));
    await tester.pump();

    expect(ref.read(favoriteIdsProvider).value, contains('race-001'));
    expect(find.text('お気に入りに登録しました'), findsOneWidget);
  });

  testWidgets('[T-02] 登録済みレースをtoggle_削除されSnackBarは出ない', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await buildApp((r) => ref = r));
    // UI操作を経由せず直接登録しておく（登録SnackBarを発生させないため）。
    ref.read(favoriteIdsProvider.notifier).toggle('race-001');

    await tester.tap(find.text('トグル'));
    await tester.pump();

    expect(ref.read(favoriteIdsProvider).value, isNot(contains('race-001')));
    expect(find.text('お気に入りに登録しました'), findsNothing);
  });

  testWidgets('[T-03] 新規登録時のSnackBarの取り消す_タップで登録が取り消される', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await buildApp((r) => ref = r));
    await tester.tap(find.text('トグル'));
    // SnackBarの登場アニメーションを完了させ、アクションをタップ可能にする。
    await tester.pumpAndSettle();

    await tester.tap(find.text('取り消す'));
    await tester.pump();

    expect(ref.read(favoriteIdsProvider).value, isNot(contains('race-001')));
  });

  testWidgets('[T-04] 保存失敗_一旦切り替わった後に元の状態へ戻り失敗SnackBarが出る', (
    tester,
  ) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await buildApp(
        (r) => ref = r,
        extraOverrides: [
          favoritesRepositoryProvider.overrideWithValue(
            _AlwaysFailingFavoritesRepository(),
          ),
        ],
      ),
    );
    // UI操作を経由せず直接登録しておく（登録SnackBarを発生させないため。T-02と同様）。
    ref.read(favoriteIdsProvider.notifier).toggle('race-001');

    await tester.tap(find.text('トグル'));
    await tester.pump();
    // toggle直後、保存の成否を待たずに即座に反映されている（楽観的更新）。
    expect(ref.read(favoriteIdsProvider).value, isNot(contains('race-001')));

    // デバウンス（PERF-112）を経て保存が失敗として解決するのを待つ。
    await tester.pump(favoriteSaveDebounceDuration);
    await tester.pump();

    // 保存失敗のため、表示は元の状態（登録済み）へ巻き戻る。
    expect(ref.read(favoriteIdsProvider).value, contains('race-001'));
    expect(find.text('お気に入りの保存に失敗しました'), findsOneWidget);
  });
}
