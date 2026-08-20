import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth/application/auth_router_state.dart';
import 'auth/application/session_provider.dart';
import 'design/theme.dart';
import 'domain/entities/race_entity.dart';
import 'features/favorites/application/favorite_races_provider.dart';
import 'features/settings/application/settings_provider.dart';
import 'navigation/app_router.dart';
import 'notifications/application/notification_scheduler_provider.dart';
import 'notifications/application/notification_sync.dart';

/// アプリのルート。`MaterialApp.router` でテーマと [appRouter] を配線する。
///
/// 通知基盤の初期化と、お気に入りレースの通知スケジュール同期
/// （technical-design.md §5）もここで行う（アプリ全体のライフサイクルで
/// 一度だけ有効になる副作用のため）。
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 全画面ログイン必須: appRouterのredirectはRiverpodのrefを持てないため、
    // authRouterStateという橋渡しを参照する（navigation/app_router.dart）。
    // ここで毎buildごとにsessionProviderの現在値を反映することで、
    // - 初回起動時: MaterialApp.routerが最初のredirectを評価する前に
    //   authRouterStateへ確実に反映される（でなければログイン済みでも
    //   一瞬/loginへ弾かれてしまう）
    // - ログイン/ログアウト後: sessionProviderの変化でMyAppが再buildされ、
    //   その都度authRouterStateも追従する
    // の両方を1箇所でまかなう。`SessionNotifier`自体は`authRouterState`を
    // 意識しない設計にしており（テスト用/モック用にbuild()をまるごと
    // 上書きするNotifierでも一貫して反映されるようにするため）、
    // 反映ポイントをここに集約している。
    final session = ref.watch(sessionProvider);
    authRouterState.update(session != null);

    // PERF-131: 戻り値を使わない副作用専用の起動のため、watchではなくreadで
    // 一度きり起動する（watchだとAsyncValue遷移（loading→data）のたびに
    // MyApp全体が再ビルドされてしまう）。
    ref.read(notificationInitProvider);
    final themeMode = ref.watch(settingsProvider.select((s) => s.themeMode));

    ref.listen<AsyncValue<List<RaceEntity>>>(favoriteRacesProvider, (
      previous,
      next,
    ) {
      _syncFavoriteNotifications(ref, previous, next);
    });

    // QSET-09: 通知の再スケジュール契機がfavoriteRacesProviderの変化のみだと、
    // 「通知タイミング」を変更しても既にスケジュール済みの通知には反映されない
    // （レース内容自体は変わっていないため再emitされない）。previousをnullにして
    // 渡すことで全件を「新規」扱いにし、新しいleadMinutesで再登録し直す。
    ref.listen<int>(settingsProvider.select((s) => s.notificationLeadMinutes), (
      previous,
      next,
    ) {
      unawaited(
        _syncFavoriteNotifications(ref, null, ref.read(favoriteRacesProvider)),
      );
    });

    return MaterialApp.router(
      title: '開催盤',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
      // QWEB-02: flutter_localizationsを導入していないと、showDatePicker等の
      // Flutter標準UIの文言・曜日ヘッダ・日付入力形式（US式mm/dd/yyyy）が
      // 既定の英語のままになる。日本語のみ対応する。
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: const [Locale('ja')],
      locale: const Locale('ja'),
    );
  }
}

/// お気に入りの発走待ちレース一覧（[favoriteRacesProvider]）が変化するたびに、
/// 通知スケジュールを同期する。
///
/// 新規・継続のお気に入りは（設定で有効な場合）スケジュールし、
/// リストから外れたレース（発走済み・お気に入り解除）は取り消す。
Future<void> _syncFavoriteNotifications(
  WidgetRef ref,
  AsyncValue<List<RaceEntity>>? previous,
  AsyncValue<List<RaceEntity>> next,
) async {
  final races = next.value;
  if (races == null) return;

  final settings = ref.read(settingsProvider);
  final scheduler = ref.read(notificationSchedulerProvider);

  if (settings.notificationsEnabled && settings.notifyFavorites) {
    // PERF-029: 内容が変わっていないレースまで毎回スケジュールし直すと
    // ネイティブ通知チャネルへの無駄な呼び出しが多発するため、
    // 新規・変化したレースだけに絞り込む。
    // PERF-031: awaitせず並行発火するとプラットフォームチャネルが輻輳し、
    // エラーも握りつぶされる（fire-and-forgetのFutureは呼び出し元が捕捉
    // できない）ため、1件ずつawaitし失敗しても他のレースの登録を継続する。
    for (final race in racesNeedingReschedule(races, previous?.value)) {
      try {
        await scheduler.scheduleRaceNotification(
          race,
          leadMinutes: settings.notificationLeadMinutes,
        );
      } on Exception {
        // 1件の通知登録失敗で他のレースの登録を止めない。
      }
    }
  }

  final previousIds =
      previous?.value?.map((race) => race.raceId).toSet() ?? <String>{};
  final nextIds = races.map((race) => race.raceId).toSet();
  for (final removedId in previousIds.difference(nextIds)) {
    try {
      await scheduler.cancelRaceNotification(removedId);
    } on Exception {
      // 1件の取り消し失敗で他の取り消しを止めない。
    }
  }
}
