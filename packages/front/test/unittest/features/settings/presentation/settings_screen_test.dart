// SettingsScreen のデシジョンテーブル
//
// | ID   | 操作                                | 期待                                  |
// | ---- | ----------------------------------- | ---------------------------------------- |
// | T-01 | 「通知を受け取る」トグルをタップ    | OFFになる                              |
// | T-02 | 通知タイミングの＋をタップ          | 表示が「10分前」に変わる               |
// | T-03 | テーマの「暗」をタップ              | settingsProvider.themeModeがdarkになる |
// | T-04 | 「競輪」トグルをタップ              | 対象競技からkeirinが外れる             |
// | T-05 | 「テスト通知を送信」の表示確認      | 非Web環境（flutter test）では非表示    |
// | T-06 | 旅程グループ「連日の許容日数」の＋   | 表示が「3日」に変わる                  |
// | T-07 | 「旅程グループ一覧」をタップ        | /trip-groups へ遷移する                |
// | T-08 | 「通知を受け取る」トグルをタップ    | 変更内容を伝えるSnackBarが表示される   |
// | T-09 | 「重賞を自動で通知」トグルをタップ  | 変更内容を伝えるSnackBarが表示される   |
// | T-10 | 通知タイミングの－をタップ（BEHAV-042） | 表示が「発走時」に変わる            |
// | T-11 | 「重賞を自動で通知」トグルをタップ（BEHAV-043） | autoNotifySpecifiedGradesがOFFになる |
// | T-12 | 「お気に入りを通知」トグルをタップ（BEHAV-043） | notifyFavoritesがOFFになる          |
// | T-13 | 「Googleカレンダー連携」トグルをタップ（QCOPY-02） | 未実装機能のため操作不能で状態は変化しない |
// | T-14 | テーマの「自動」「明」をタップ（BEHAV-044） | themeModeがそれぞれ変わる            |
// | T-15 | 「通知を受け取る」トグルをタップ・永続化が失敗（FEDGE-04） | 成功SnackBarではなく失敗を伝えるSnackBarが表示される |
// | T-16 | 「更新履歴」をタップ                | /whats-new へ遷移する                  |
// | T-17 | 表示グループの内容確認（QCOPY-01）  | 「既定フィルタ」行が表示されない       |
// | T-18 | 通知タイミングが上限（60分）・＋をタップ（QSET-01） | 値が変化しない（無効化されている） |
// | T-19 | 連日の許容日数が下限（0日）・－をタップ（QSET-01） | 値が変化しない（無効化されている） |
// | T-20 | 通知タイミングのsubtitle（QSET-02） | 範囲・刻み幅を含む文言が表示される     |
// | T-21 | 「デバッグモード」トグルをタップ    | debugModeEnabledがONになる             |
// | T-22 | 「管理画面」をタップ                | adminBaseUrl配下のURLが外部で開かれる  |
// | T-23 | 「設定をリセット」→確認ダイアログで「リセット」（QSET-04） | 設定が既定値に戻り成功SnackBarが表示される |
// | T-24 | 「設定をリセット」→確認ダイアログで「キャンセル」（QSET-04） | 設定は変更されない                     |
// | T-25 | 「このアプリについて」の内容確認（QSET-05） | バージョン行が表示される               |
// | T-26 | 「通知を受け取る」OFF・「重賞を自動で通知」トグルをタップ（QSET-06） | autoNotifySpecifiedGradesは変化しない（無効化されている） |
// | T-27 | 「通知を受け取る」OFF・通知タイミングの＋をタップ（QSET-06） | notificationLeadMinutesは変化しない（無効化されている） |
// | T-28 | 「バージョン」行をタップ（QSUP-04） | クリップボードへコピーされ、確認SnackBarが表示される |
// | T-29 | 「このアプリについて」の内容確認（PUBGATE-02） | 非公式アプリである旨の免責文言が表示される |
// | T-31 | 「お気に入りをすべて削除」→確認ダイアログで「削除」（QPRIV-05） | favoriteIdsProviderが空になり成功SnackBarが表示される |
// | T-32 | 「お気に入りをすべて削除」→確認ダイアログで「キャンセル」（QPRIV-05） | favoriteIdsProviderは変更されない |

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/config/admin_config.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/settings_rows.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/features/settings/application/settings_provider.dart';
import 'package:front/features/settings/presentation/settings_screen.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _FakeUrlLauncher extends UrlLauncherPlatform {
  _FakeUrlLauncher({required this.result});

  final bool result;
  String? lastLaunchedUrl;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    lastLaunchedUrl = url;
    return result;
  }
}

/// [SettingsScreen] を配線し、外側から [settingsProvider] を検証できるよう
/// [WidgetRef] をコールバックで受け渡す。
Future<Widget> _buildApp(void Function(WidgetRef ref) captureRef) async {
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    child: Consumer(
      builder: (context, ref, _) {
        captureRef(ref);
        return MaterialApp(
          theme: AppTheme.light(),
          home: const SettingsScreen(),
        );
      },
    ),
  );
}

/// 「旅程グループ一覧」タップ（[GoRouter.push]）検証用に、`/trip-groups` への
/// 遷移だけを扱う簡易ルータで [SettingsScreen] を配線する。
Future<Widget> _buildRoutedApp() async {
  final prefs = await SharedPreferences.getInstance();
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SettingsScreen()),
      GoRoute(
        path: '/trip-groups',
        builder: (context, state) => const Scaffold(body: Text('旅程グループ一覧画面')),
      ),
      GoRoute(
        path: '/whats-new',
        builder: (context, state) => const Scaffold(body: Text('更新履歴画面')),
      ),
    ],
  );
  return ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    child: MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
  );
}

/// [SettingsNotifier.setNotificationsEnabled] の永続化が常に失敗する状況を
/// 再現するスタブ（FEDGE-04の回帰テスト用）。state自体は通常どおり更新する。
class _PersistFailingSettingsNotifier extends SettingsNotifier {
  @override
  Future<bool> setNotificationsEnabled(bool value) {
    state = state.copyWith(notificationsEnabled: value);
    return Future.value(false);
  }
}

void main() {
  String? copiedClipboardText;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    copiedClipboardText = null;
    // flutter_testはClipboard等のplatformチャンネルを既定でモックしないため
    // （未モックだとネイティブ側の応答が無く待機し続けてしまう、QSUP-04）、
    // T-28用に明示的にモックする。
    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (
          MethodCall methodCall,
        ) async {
          if (methodCall.method == 'Clipboard.setData') {
            copiedClipboardText =
                (methodCall.arguments as Map)['text'] as String?;
          }
          return null;
        });
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  testWidgets('[T-01] 通知を受け取るトグルをタップ_OFFになる', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(ref.read(settingsProvider).notificationsEnabled, isFalse);
  });

  testWidgets('[T-15] 通知を受け取るトグルをタップ_永続化が失敗_失敗を伝えるSnackBarが表示される', (
    tester,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          settingsProvider.overrideWith(_PersistFailingSettingsNotifier.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const SettingsScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(find.text('通知を受け取る の保存に失敗しました。もう一度お試しください'), findsOneWidget);
    expect(find.text('通知を受け取る をOFFにしました'), findsNothing);
  });

  testWidgets('[T-02] 通知タイミングの＋をタップ_10分前になる', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    expect(find.text('5分前'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    expect(find.text('10分前'), findsOneWidget);
  });

  testWidgets('[T-03] テーマの暗をタップ_themeModeがdarkになる', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.tap(find.text('暗'));
    await tester.pump();

    expect(ref.read(settingsProvider).themeMode, ThemeMode.dark);
  });

  testWidgets('[T-04] 競輪トグルをタップ_対象競技からkeirinが外れる', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    // タップ領域拡大（A11Y-016等）で画面全体が縦に伸び、「競輪」行が初期の
    // 描画キャッシュ範囲外になり得るため、`ensureVisible`（既に構築済みの
    // 要素が前提）ではなく、スクロールしながら対象を探す
    // `scrollUntilVisible` を使う。
    await tester.scrollUntilVisible(find.text('競輪'), 100);
    await tester.pump();
    await tester.tap(find.text('競輪'));
    await tester.pump();

    expect(
      ref.read(settingsProvider).enabledDisciplines,
      isNot(contains(Discipline.keirin)),
    );
  });

  testWidgets('[T-05] 非Web環境ではテスト通知を送信ボタンが表示されないこと', (tester) async {
    // `flutter test`（VM ターゲット）では kIsWeb が false になるため、
    // Web限定の「テスト通知を送信」ボタン（配信テスト機能）は表示されない
    // （web_notification_scheduler_test.dart 冒頭の注記と同じ制約）。
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    expect(find.text('テスト通知を送信'), findsNothing);
  });

  testWidgets('[T-06] 旅程グループの連日の許容日数の＋をタップ_3日になる', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    // テスト用ビューポートは狭く、末尾の「旅程グループ」グループは初期状態では
    // マウントされていないため、`dragUntilVisible` でスクロールして表示させる。
    await tester.dragUntilVisible(
      find.text('連日の許容日数'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();

    expect(find.text('2日'), findsOneWidget);

    // 「連日の許容日数」行に属する＋ボタンだけをたどる
    // （他行の＋ボタンと混同しないよう祖先で絞り込む）。
    final toleranceRow = find.ancestor(
      of: find.text('連日の許容日数'),
      matching: find.byType(SettingsStepperRow),
    );
    await tester.tap(
      find.descendant(of: toleranceRow, matching: find.byIcon(Icons.add)),
    );
    await tester.pump();

    expect(find.text('3日'), findsOneWidget);
  });

  testWidgets('[T-07] 旅程グループ一覧をタップ_trip-groupsへ遷移する', (tester) async {
    await tester.pumpWidget(await _buildRoutedApp());
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('旅程グループ一覧'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    // T-16（更新履歴）でも同じ「開く」ラベルの行が増えたため、旅程グループ
    // 一覧行を祖先で絞り込んでからタップする（T-06の絞り込み方針と同じ）。
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('旅程グループ一覧'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('開く'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('旅程グループ一覧画面'), findsOneWidget);
  });

  testWidgets('[T-16] 更新履歴をタップ_whats-newへ遷移する', (tester) async {
    await tester.pumpWidget(await _buildRoutedApp());
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('更新履歴'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('更新履歴'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('開く'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('更新履歴画面'), findsOneWidget);
  });

  testWidgets('[T-08] 通知を受け取るトグルをタップ_変更内容を伝えるSnackBarが表示される', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(find.text('通知を受け取る をOFFにしました'), findsOneWidget);
  });

  testWidgets('[T-09] 重賞を自動で通知トグルをタップ_変更内容を伝えるSnackBarが表示される', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.tap(find.text('重賞を自動で通知'));
    await tester.pump();

    expect(find.text('重賞を自動で通知 をOFFにしました'), findsOneWidget);
  });

  testWidgets('[T-10] 通知タイミングの－をタップ_発走時になる', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    expect(find.text('5分前'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.remove));
    await tester.pump();

    expect(find.text('発走時'), findsOneWidget);
  });

  testWidgets('[T-11] 重賞を自動で通知トグルをタップ_autoNotifySpecifiedGradesがOFFになる', (
    tester,
  ) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    expect(ref.read(settingsProvider).autoNotifySpecifiedGrades, isTrue);

    await tester.tap(find.text('重賞を自動で通知'));
    await tester.pump();

    expect(ref.read(settingsProvider).autoNotifySpecifiedGrades, isFalse);
  });

  testWidgets('[T-12] お気に入りを通知トグルをタップ_notifyFavoritesがOFFになる', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    expect(ref.read(settingsProvider).notifyFavorites, isTrue);

    await tester.tap(find.text('お気に入りを通知'));
    await tester.pump();

    expect(ref.read(settingsProvider).notifyFavorites, isFalse);
  });

  testWidgets('[T-13] Googleカレンダー連携トグルをタップ_未実装機能のため操作不能で状態は変化しない', (
    tester,
  ) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    expect(ref.read(settingsProvider).googleCalendarSyncEnabled, isFalse);

    await tester.scrollUntilVisible(find.text('Google カレンダー連携'), 100);
    await tester.pump();
    await tester.tap(find.text('Google カレンダー連携'));
    await tester.pump();

    // QCOPY-02: この機能はアプリ内のどこからも参照されない未実装の値
    // （settings_provider.dartのコメント参照）のため、タップしても
    // 状態が変化しない（誤ってONにできてしまう体験を防ぐ）。
    expect(ref.read(settingsProvider).googleCalendarSyncEnabled, isFalse);
    final switchWidget = tester.widget<Switch>(
      find.descendant(
        of: find.ancestor(
          of: find.text('Google カレンダー連携'),
          matching: find.byType(InkWell),
        ),
        matching: find.byType(Switch),
      ),
    );
    expect(switchWidget.onChanged, isNull);
  });

  testWidgets('[T-14] テーマの自動・明をタップ_themeModeがそれぞれ変わる', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.tap(find.text('暗'));
    await tester.pump();
    expect(ref.read(settingsProvider).themeMode, ThemeMode.dark);

    await tester.tap(find.text('明'));
    await tester.pump();
    expect(ref.read(settingsProvider).themeMode, ThemeMode.light);

    await tester.tap(find.text('自動'));
    await tester.pump();
    expect(ref.read(settingsProvider).themeMode, ThemeMode.system);
  });

  testWidgets('[T-17] 表示グループ_既定フィルタ行が表示されない', (tester) async {
    // QCOPY-01: 「既定フィルタ」行は実際のフィルタ状態を反映しない
    // ハードコードされた読み取り専用行だった（「重賞のみ」固定）ため削除した。
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    expect(find.text('既定フィルタ'), findsNothing);
  });

  testWidgets('[T-18] 通知タイミングが上限60分_＋をタップしても値が変化しない', (tester) async {
    SharedPreferences.setMockInitialValues({
      'settings_notification_lead_minutes': 60,
    });
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    expect(find.text('60分前'), findsOneWidget);

    final row = find.ancestor(
      of: find.text('通知タイミング'),
      matching: find.byType(SettingsStepperRow),
    );
    await tester.tap(
      find.descendant(of: row, matching: find.byIcon(Icons.add)),
    );
    await tester.pump();

    expect(find.text('60分前'), findsOneWidget);
    expect(ref.read(settingsProvider).notificationLeadMinutes, 60);
  });

  testWidgets('[T-19] 連日の許容日数が下限0日_－をタップしても値が変化しない', (tester) async {
    SharedPreferences.setMockInitialValues({'settings_trip_tolerance_days': 0});
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('連日の許容日数'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    expect(find.text('0日'), findsOneWidget);

    final row = find.ancestor(
      of: find.text('連日の許容日数'),
      matching: find.byType(SettingsStepperRow),
    );
    await tester.tap(
      find.descendant(of: row, matching: find.byIcon(Icons.remove)),
    );
    await tester.pump();

    expect(find.text('0日'), findsOneWidget);
    expect(ref.read(settingsProvider).tripToleranceDays, 0);
  });

  testWidgets('[T-20] 通知タイミングのsubtitle_範囲と刻み幅が表示される', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    expect(find.textContaining('発走の何分前に知らせるか（0〜60分・5分刻み）'), findsOneWidget);
  });

  testWidgets('[T-22] 管理画面をタップ_adminBaseUrl配下のURLが外部で開かれる', (tester) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('管理画面'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    // 他の行（旅程グループ一覧・更新履歴等）も同じ「開く」ラベルを持つため、
    // 管理画面行を祖先で絞り込んでからタップする（T-07/T-16と同じ絞り込み方針）。
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('管理画面'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('開く'),
      ),
    );
    await tester.pump();

    expect(fake.lastLaunchedUrl, '$adminBaseUrl/flags');
  });

  testWidgets('[T-23] 設定をリセット_確認ダイアログでリセット_既定値に戻り成功SnackBarが表示される', (
    tester,
  ) async {
    WidgetRef? ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    ref!.read(settingsProvider.notifier).setNotificationsEnabled(false);
    await tester.pump();
    expect(ref!.read(settingsProvider).notificationsEnabled, isFalse);

    await tester.dragUntilVisible(
      find.text('設定をリセット'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('設定をリセット'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('リセット'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('設定をリセットしますか？'), findsOneWidget);
    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text('リセット'),
      ),
    );
    await tester.pumpAndSettle();

    expect(ref!.read(settingsProvider).notificationsEnabled, isTrue);
    expect(find.text('設定をリセットしました'), findsOneWidget);
  });

  testWidgets('[T-24] 設定をリセット_確認ダイアログでキャンセル_設定は変更されない', (tester) async {
    WidgetRef? ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    ref!.read(settingsProvider.notifier).setNotificationsEnabled(false);
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('設定をリセット'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('設定をリセット'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('リセット'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('キャンセル'));
    await tester.pumpAndSettle();

    expect(ref!.read(settingsProvider).notificationsEnabled, isFalse);
  });

  testWidgets('[T-25] このアプリについて_バージョン行が表示される', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('バージョン'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();

    expect(find.text('バージョン'), findsOneWidget);
    // flutter testではAPP_VERSIONのdart-defineが設定されないため既定値'dev'
    expect(find.text('dev'), findsOneWidget);
  });

  testWidgets('[T-29] このアプリについて_非公式アプリである旨の免責文言が表示される', (tester) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.dragUntilVisible(
      find.textContaining('非公式のアプリです'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();

    expect(find.textContaining('非公式のアプリです'), findsOneWidget);
    expect(find.textContaining('公式サイトで最新情報をご確認ください'), findsOneWidget);
  });

  testWidgets('[T-28] バージョン行をタップするとクリップボードへコピーされ確認SnackBarが表示される', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildApp((_) {}));
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('バージョン'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();

    await tester.tap(find.text('バージョン'));
    await tester.pump();

    expect(copiedClipboardText, 'dev');
    expect(find.text('バージョンをコピーしました'), findsOneWidget);
  });

  testWidgets(
    '[T-31] お気に入りをすべて削除_確認ダイアログで削除_favoriteIdsProviderが空になり成功SnackBarが表示される',
    (tester) async {
      WidgetRef? ref;
      await tester.pumpWidget(await _buildApp((r) => ref = r));
      await tester.pump();
      ref!.read(favoriteIdsProvider.notifier).toggle('race-001');
      await tester.pump();
      expect(ref!.read(favoriteIdsProvider).value, contains('race-001'));

      await tester.dragUntilVisible(
        find.text('お気に入りをすべて削除'),
        find.byType(ListView),
        const Offset(0, -300),
      );
      await tester.pump();
      await tester.tap(
        find.descendant(
          of: find.ancestor(
            of: find.text('お気に入りをすべて削除'),
            matching: find.byType(SettingsActionRow),
          ),
          matching: find.text('削除'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('お気に入りをすべて削除しますか？'), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('削除'),
        ),
      );
      await tester.pumpAndSettle();

      expect(ref!.read(favoriteIdsProvider).value, isEmpty);
      expect(find.text('お気に入りをすべて削除しました'), findsOneWidget);
    },
  );

  testWidgets('[T-32] お気に入りをすべて削除_確認ダイアログでキャンセル_favoriteIdsProviderは変更されない', (
    tester,
  ) async {
    WidgetRef? ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();
    ref!.read(favoriteIdsProvider.notifier).toggle('race-001');
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('お気に入りをすべて削除'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('お気に入りをすべて削除'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('削除'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('キャンセル'));
    await tester.pumpAndSettle();

    expect(ref!.read(favoriteIdsProvider).value, contains('race-001'));
  });

  testWidgets('[T-26] 通知を受け取るOFF_重賞を自動で通知トグルをタップ_変化しない', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pump();
    expect(ref.read(settingsProvider).notificationsEnabled, isFalse);

    final row = find.ancestor(
      of: find.text('重賞を自動で通知'),
      matching: find.byType(SettingsToggleRow),
    );
    await tester.tap(find.descendant(of: row, matching: find.byType(Switch)));
    await tester.pump();

    expect(ref.read(settingsProvider).autoNotifySpecifiedGrades, isTrue);
  });

  testWidgets('[T-27] 通知を受け取るOFF_通知タイミングの＋をタップ_変化しない', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(await _buildApp((r) => ref = r));
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pump();
    expect(ref.read(settingsProvider).notificationsEnabled, isFalse);

    final row = find.ancestor(
      of: find.text('通知タイミング'),
      matching: find.byType(SettingsStepperRow),
    );
    await tester.tap(
      find.descendant(of: row, matching: find.byIcon(Icons.add)),
    );
    await tester.pump();

    expect(ref.read(settingsProvider).notificationLeadMinutes, 5);
  });
}
