// toggleFavoriteWithFeedback のデシジョンテーブル
//
// | ID   | 条件                                  | 期待                                          |
// | ---- | ------------------------------------- | ----------------------------------------------- |
// | T-01 | 未登録レースをtoggle（新規登録）      | favoriteIdsProviderに追加され、登録SnackBarが出る |
// | T-02 | 登録済みレースをtoggle（解除）        | favoriteIdsProviderから削除され、SnackBarは出ない |
// | T-03 | 新規登録時のSnackBarの「取り消す」    | タップすると再度toggleされ登録が取り消される  |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_toggle_feedback.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<Widget> buildApp(void Function(WidgetRef ref) captureRef) async {
    final prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
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

    expect(ref.read(favoriteIdsProvider), contains('race-001'));
    expect(find.text('お気に入りに登録しました'), findsOneWidget);
  });

  testWidgets('[T-02] 登録済みレースをtoggle_削除されSnackBarは出ない', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await buildApp((r) => ref = r));
    // UI操作を経由せず直接登録しておく（登録SnackBarを発生させないため）。
    ref.read(favoriteIdsProvider.notifier).toggle('race-001');

    await tester.tap(find.text('トグル'));
    await tester.pump();

    expect(ref.read(favoriteIdsProvider), isNot(contains('race-001')));
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

    expect(ref.read(favoriteIdsProvider), isNot(contains('race-001')));
  });
}
