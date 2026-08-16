// コンポーネントテスト: モックモード（`main_mock.dart`）のDI配線検証
// （testing-conventions.md §7.5 運用ルール）。
//
// `setupMockDependencies()` がRemote DataSourceだけをフェイクへ差し替え、
// Repository/UseCase/Provider/UI が本番と同じコードパスで動作すること
// （バックエンド接続なしでアプリ全体が描画できること）を検証する。

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/usecases/get_races_by_date_range.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/i_notification_scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// テストでは実プラットフォームチャンネルを持たないため、
/// 通知スケジューラは常にフェイクへ差し替える。
class _FakeNotificationScheduler implements INotificationScheduler {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {}

  @override
  Future<void> cancelRaceNotification(String raceId) async {}

  @override
  Future<void> cancelAll() async {}
}

void main() {
  setUp(() async {
    await getIt.reset();
    setupMockDependencies();
  });

  test(
    'setupMockDependencies経由でGetRacesByDateRangeUseCaseが本日分のレースを返す',
    () async {
      final useCase = getIt<GetRacesByDateRangeUseCase>();
      final today = DateTime.now();
      final dateStr =
          '${today.year.toString().padLeft(4, '0')}-'
          '${today.month.toString().padLeft(2, '0')}-'
          '${today.day.toString().padLeft(2, '0')}';

      final races = await useCase(
        startDate: dateStr,
        finishDate: dateStr,
        raceTypeList: const [
          'jra',
          'nar',
          'overseas',
          'keirin',
          'autorace',
          'boatrace',
        ],
      );

      expect(races, isNotEmpty);
      expect(
        races.every((race) {
          final parsed = DateTime.parse(race.datetime);
          return parsed.year == today.year &&
              parsed.month == today.month &&
              parsed.day == today.day;
        }),
        isTrue,
      );
    },
  );

  testWidgets('モックDIでMyAppを起動するとバックエンド接続なしでタイムライン画面が描画される', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          notificationSchedulerProvider.overrideWithValue(
            _FakeNotificationScheduler(),
          ),
        ],
        child: const MyApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));

    // 日別タイムラインの本文はレース読み込み完了後、下部ナビのタブラベルに
    // 加えてセクション見出し（`_SectionLabel`）にも同じ文言を表示する。
    // 読み込みタイミング（ローディング中か否か）により「タイムライン」の
    // 出現数は1件/2件のいずれもあり得るため、`findsOneWidget`で固定すると
    // 不安定になる（実際にCIでのみ2件になり失敗した）。ここではモックモードで
    // アプリが描画できることの確認が目的であり、出現数までは固定しない。
    expect(find.text('タイムライン'), findsWidgets);
    expect(find.text('お気に入り'), findsWidgets);
    expect(find.text('設定'), findsOneWidget);
  });
}
