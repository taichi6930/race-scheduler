// RaceDetailContent「カレンダー追加」ボタン・外部リンクのデシジョンテーブル
//
// | ID   | 条件                                 | 期待                                          |
// | ---- | ------------------------------------ | ------------------------------------------------ |
// | T-01 | 「カレンダー追加」タップ             | 追加先選択シートが表示され「Googleカレンダー」行がある |
// | T-02 | シートで「Googleカレンダー」選択・起動成功（API未登録） | 期待するGoogleカレンダーURLでlaunchUrlが呼ばれる（フォールバック） |
// | T-03 | シートで「Googleカレンダー」選択・起動失敗 | エラーのSnackBarが表示される                    |
// | T-04 | シートで「Googleカレンダー」選択・IRaceRepository登録あり | APIから取得したプレビュー内容でlaunchUrlが呼ばれる |
// | T-05 | linksあり                            | リンクボタンが表示され、タップでそのURLが開かれる |
// | T-06 | linksが空                            | リンクボタンが表示されない                    |
// | T-07 | リンクタップ・起動失敗               | 「(ラベル)を開けませんでした」のSnackBarが表示される |
// | T-08 | リンクタップ（テスト環境=非スタンドアロン） | webOnlyWindowNameに'_blank'が渡る（新規タブで開く） |
// | T-09 | isFavorite:false（A11Y-006/028） | 「お気に入り登録＋通知」のボタンロールで読み上げられる（☆記号なし） |
// | T-10 | isFavorite:true（A11Y-006/028） | 「登録済み、N分前に通知」のボタンロールで読み上げられる（★記号なし） |
// | T-11 | 「カレンダー追加」ボタン（A11Y-006） | ボタンロールでSemantics経由のtapアクションが有効           |
// | T-12 | リンクチップ（A11Y-006）              | ボタンロールでSemantics経由のtapアクションが有効           |
// | T-13 | リンクURLが`javascript:`スキーム（SEC-054） | launchUrlが呼ばれず「を開けませんでした」が表示される |
// | T-14 | showRaceDetailSheet・シートを閉じる（A11Y-023） | 開く前にフォーカスしていたトリガー要素へフォーカスが復帰する |
// | T-15 | isFavorite:true・設定の通知タイミングが既定値と異なる（QCOPY-09） | ハードコードした既定値ではなく設定の実値（分）が表示される |
// | T-16 | 海外競馬（QINF-03） | ヘッダ・KV一覧の発走時刻表示に（JST）が付与される |
// | T-17 | 中央競馬（対照、QINF-03） | 発走時刻表示に（JST）が付与されない |
// | T-18 | 出走選手ロスター・同一枠番を共有する車番違いの2選手 | バッジ色は車番ごとに異なる（回帰: 旧実装は枠番で色を決めていたため同一色になっていた） |
// | T-19 | 出走選手ロスター・KEIRIN・登録済み注目選手あり | 登録済み選手は★（塗り）、未登録選手は☆（枠線）で表示される |
// | T-20 | 出走選手ロスターの☆をタップ（未登録→登録） | setPlayerWatchがwatched:trueで呼ばれ、次の再取得で★表示に切り替わる |
// | T-21 | 出走選手ロスター・KEIRIN以外（JRA） | 星アイコン自体が表示されない（注目選手機能の対象外レース種別の安全側ガード） |
// | T-22 | RaceDetailContent・onClose未指定（広画面パネル相当） | ✕ボタンが表示されない |
// | T-23 | RaceDetailContent・onClose指定（ボトムシート相当） | ✕ボタンが表示され、タップでonCloseが呼ばれる |
// | T-24 | showRaceDetailSheet・✕ボタンをタップ（回帰: コンテンツが画面より大きく下方向ドラッグで閉じられない不具合） | シートが閉じ、開く前のトリガー要素へフォーカスが復帰する |
// | T-25 | KV一覧・グレードあり/ステージなし（JRA） | 「レース」行はレース番号のみ（結合表記なし）、「グレード」行が別行で表示され「ステージ」行は表示されない |
// | T-26 | KV一覧・グレード/ステージともにあり（競輪決勝） | 「グレード」「ステージ」がそれぞれ別行で表示される |
// | T-27 | KV一覧・グレード/ステージともになし | 「グレード」「ステージ」の行が表示されない |
// | T-28 | KV一覧・馬場種別（surfaceType）と距離の両方あり | 「条件」行に「芝 ・ 1200m」が表示される |
// | T-29 | 出走選手ロスター・AUTORACE・登録済み注目選手あり | 登録済み選手は★（塗り）、未登録選手は☆（枠線）で表示される（AUTORACE拡張） |
// | T-30 | raceDetailUiProviderが取得失敗（QINF-04） | ErrorRetryCardが表示され、再試行で復帰する |
// | T-31 | ヘッダーの発走時刻表示（QINF-08） | 「M/D HH:mm 発走」の形式で日付が含まれる |
// | T-32 | race.isConfirmed:false | ヘッダーに「未確定」バッジが表示される |
// | T-33 | race.isConfirmed:true/null | ヘッダーに「未確定」バッジが表示されない |

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/core/jst_time.dart';
import 'package:front/design/keirin_car_number_colors.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/atoms/discipline_icon.dart';
import 'package:front/domain/entities/calendar_event_preview.dart';
import 'package:front/domain/entities/notification_settings.dart';
import 'package:front/domain/entities/player_entity.dart';
import 'package:front/domain/entities/race_detail_ui.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/entities/race_link.dart';
import 'package:front/domain/entities/race_player_entity.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/domain/repositories/i_player_repository.dart';
import 'package:front/domain/repositories/i_race_repository.dart';
import 'package:front/features/timeline/presentation/race_detail_sheet.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/i_notification_scheduler.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

/// [race] から [RaceDetailKvSection] の行を組み立てる（本番の
/// resolveRaceDetailUi・fieldCatalog(core)と同じ選定ルールをフェイク側で
/// 再現したもの。KV行の内容そのものはcore側のUTで担保済みのため、ここでは
/// 「与えられたUIスキーマをウィジェットが正しく描画するか」の検証に専念する）。
List<RaceDetailKvRow> _kvRowsFor(RaceEntity race) {
  final raceType = RaceType.fromValue(race.raceType);
  final time = parseJstDateTime(race.datetime);
  final formattedTime = DateFormat('HH:mm').format(time);
  final timeValue = raceType == RaceType.overseas
      ? '$formattedTime（JST）'
      : formattedTime;
  final conditionParts = <String>[
    if (race.surfaceType != null && race.surfaceType!.isNotEmpty)
      race.surfaceType!,
    if (race.distance != null) '${race.distance}m',
  ];
  final condition = conditionParts.isEmpty ? null : conditionParts.join(' ・ ');

  return [
    RaceDetailKvRow(label: '発走', value: timeValue),
    RaceDetailKvRow(label: '競技', value: DisciplineIcon.labelFor(raceType)),
    RaceDetailKvRow(label: '会場', value: race.raceCourse),
    RaceDetailKvRow(label: 'レース', value: '${race.raceNumber}R'),
    if (race.raceGrade != null && race.raceGrade!.isNotEmpty)
      RaceDetailKvRow(label: 'グレード', value: race.raceGrade!),
    if (race.raceStage != null && race.raceStage!.isNotEmpty)
      RaceDetailKvRow(label: 'ステージ', value: race.raceStage!),
    if (condition != null) RaceDetailKvRow(label: '条件', value: condition),
  ];
}

class _FakeRaceRepository implements IRaceRepository {
  _FakeRaceRepository(
    this.race, {
    this.preview = const CalendarEventPreview(
      summary: '',
      description: '',
      location: '',
      startDateTime: '',
      endDateTime: '',
      links: [],
    ),
    this.players = const [],
  });

  final RaceEntity race;
  final CalendarEventPreview preview;
  final List<RacePlayerEntity> players;

  @override
  Future<CalendarEventPreview> getCalendarEventPreview(String raceId) async =>
      preview;

  @override
  Future<List<RaceEntity>> getRacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
  }) async => [];

  @override
  Future<RaceEntity?> getRaceDetail(String raceId) async => null;

  @override
  Future<List<RacePlayerEntity>> getRacePlayers(String raceId) async => players;

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async {
    return RaceDetailUi(
      schemaVersion: 1,
      sections: [
        RaceDetailKvSection(rows: _kvRowsFor(race)),
        RaceDetailLinksSection(items: preview.links),
        RaceDetailPlayersSection(
          title: '出走選手',
          watchToggle: race.raceType == 'keirin' || race.raceType == 'autorace',
          players: players,
        ),
      ],
    );
  }
}

/// [QINF-04]検証用: `getRaceDetailUi`の呼び出しが[failCount]回まで失敗し、
/// それ以降は[_FakeRaceRepository]と同じ内容で成功する。
class _FlakyRaceRepository extends _FakeRaceRepository {
  _FlakyRaceRepository(super.race, {required this.failCount});

  final int failCount;
  int _callCount = 0;

  @override
  Future<RaceDetailUi> getRaceDetailUi(String raceId) async {
    _callCount++;
    if (_callCount <= failCount) {
      throw Exception('race detail fetch failed');
    }
    return super.getRaceDetailUi(raceId);
  }
}

/// [watched_players_provider_test.dart]の`_FakePlayerRepository`と同じ方針
/// （呼び出し回数ごとに`responses`から順に返す）。
class _FakePlayerRepository implements IPlayerRepository {
  _FakePlayerRepository({required this.responses});

  final List<List<PlayerEntity>> responses;
  int callCount = 0;
  final List<Map<String, Object?>> setPlayerWatchCalls = [];

  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async {
    final response = responses[callCount];
    callCount++;
    return response;
  }

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {
    setPlayerWatchCalls.add({
      'raceType': raceType,
      'playerNo': playerNo,
      'playerName': playerName,
      'watched': watched,
    });
  }
}

class _FakeUrlLauncher extends UrlLauncherPlatform {
  _FakeUrlLauncher({required this.result});

  final bool result;
  String? lastLaunchedUrl;
  String? lastWebOnlyWindowName;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    lastLaunchedUrl = url;
    lastWebOnlyWindowName = options.webOnlyWindowName;
    return result;
  }
}

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

final _race = RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00',
  raceGrade: 'GⅠ',
  raceNumber: 11,
);

final _raceWithCondition = RaceEntity(
  raceId: 'race-005',
  raceName: 'キーンランドカップ',
  raceType: 'jra',
  placeId: 'place-005',
  raceCourse: '札幌',
  datetime: '2026-08-16T15:25:00',
  raceGrade: 'オープン',
  raceNumber: 11,
  surfaceType: '芝',
  distance: 1200,
);

final _keirinRace = RaceEntity(
  raceId: 'race-003',
  raceName: 'ミッドナイトレース',
  raceType: 'keirin',
  placeId: 'place-003',
  raceCourse: '平塚',
  datetime: '2026-04-19T15:40:00',
  raceNumber: 1,
);

final _keirinFinalRace = RaceEntity(
  raceId: 'race-004',
  raceName: 'GⅠ競輪祭',
  raceType: 'keirin',
  placeId: 'place-004',
  raceCourse: '小倉',
  datetime: '2026-04-19T15:40:00',
  raceGrade: 'S級S班',
  raceStage: '決勝',
  raceNumber: 12,
);

final _autoraceRace = RaceEntity(
  raceId: 'race-006',
  raceName: 'ミッドナイトオートレース',
  raceType: 'autorace',
  placeId: 'place-006',
  raceCourse: '川口',
  datetime: '2026-04-19T15:40:00',
  raceNumber: 1,
);

final _overseasRace = RaceEntity(
  raceId: 'race-002',
  raceName: 'キングジョージ6世&クイーンエリザベスステークス',
  raceType: 'overseas',
  placeId: 'place-002',
  raceCourse: 'アスコット',
  datetime: '2026-07-25T15:40:00',
  raceNumber: 6,
);

/// KV一覧・外部リンク・出走選手ロスターは[raceDetailUiProvider]（`IRaceRepository`
/// 経由）から取得するため、呼び出し側が独自の[IRaceRepository]を未登録の場合は
/// [race]から導出した既定のフェイクをここで登録する（登録済みならそちらを優先し、
/// 上書きしない）。
Future<void> _pumpSheet(
  WidgetTester tester, {
  RaceEntity? race,
  int? notificationLeadMinutes,
}) async {
  SharedPreferences.setMockInitialValues(
    notificationLeadMinutes == null
        ? {}
        : {'settings_notification_lead_minutes': notificationLeadMinutes},
  );
  final prefs = await SharedPreferences.getInstance();

  final resolvedRace = race ?? _race;
  if (!getIt.isRegistered<IRaceRepository>()) {
    getIt.registerSingleton<IRaceRepository>(_FakeRaceRepository(resolvedRace));
    addTearDown(() => getIt.unregister<IRaceRepository>());
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        // QNTF-11: お気に入りON操作がensureWebPushEnabled経由でモバイルの
        // 通知許可要求（MobileNotificationScheduler.requestPermissions）を
        // 呼ぶようになったため、プラグインのプラットフォームチャネルを
        // 持たないテスト環境ではフェイクに差し替える。
        notificationSchedulerProvider.overrideWithValue(
          _FakeNotificationScheduler(),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: RaceDetailContent(race: resolvedRace)),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('[T-01] カレンダー追加タップ_追加先選択シートが表示されGoogleカレンダー行がある', (tester) async {
    await _pumpSheet(tester);
    await tester.tap(find.text('カレンダー追加'));
    await tester.pumpAndSettle();

    expect(find.text('Googleカレンダー'), findsOneWidget);
  });

  testWidgets('[T-02] シートでGoogleカレンダー選択_起動成功_期待するURLでlaunchUrlが呼ばれる', (
    tester,
  ) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    await _pumpSheet(tester);
    await tester.tap(find.text('カレンダー追加'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Googleカレンダー'));
    await tester.pumpAndSettle();

    expect(fake.lastLaunchedUrl, isNotNull);
    expect(fake.lastLaunchedUrl, contains('calendar.google.com'));
    expect(fake.lastLaunchedUrl, contains('action=TEMPLATE'));
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('[T-03] シートでGoogleカレンダー選択_起動失敗_エラーのSnackBarが表示される', (
    tester,
  ) async {
    UrlLauncherPlatform.instance = _FakeUrlLauncher(result: false);

    await _pumpSheet(tester);
    await tester.tap(find.text('カレンダー追加'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Googleカレンダー'));
    await tester.pumpAndSettle();

    expect(find.text('カレンダーを開けませんでした'), findsOneWidget);
  });

  testWidgets(
    '[T-04] シートでGoogleカレンダー選択_IRaceRepository登録あり_APIのプレビュー内容でlaunchUrlが呼ばれる',
    (tester) async {
      final fake = _FakeUrlLauncher(result: true);
      UrlLauncherPlatform.instance = fake;

      const preview = CalendarEventPreview(
        summary: 'APIプレビュー タイトル',
        description:
            '発走: 15:40\n'
            '<a href="https://netkeiba.example/info">レース情報(netkeiba)</a>',
        location: 'API会場',
        startDateTime: '2026-04-19T15:40:00+09:00',
        endDateTime: '2026-04-19T15:50:00+09:00',
        links: [],
      );
      getIt.registerSingleton<IRaceRepository>(
        _FakeRaceRepository(_race, preview: preview),
      );
      addTearDown(() => getIt.unregister<IRaceRepository>());

      await _pumpSheet(tester);
      await tester.tap(find.text('カレンダー追加'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Googleカレンダー'));
      await tester.pumpAndSettle();

      final launchedUrl = fake.lastLaunchedUrl;
      expect(launchedUrl, isNotNull);
      final queryParameters = Uri.parse(launchedUrl!).queryParameters;
      expect(queryParameters['text'], 'APIプレビュー タイトル');
      expect(queryParameters['location'], 'API会場');
      expect(
        queryParameters['details'],
        contains('レース情報(netkeiba): https://netkeiba.example/info'),
      );
    },
  );

  testWidgets('[T-05] links_あり_リンクボタンが表示されタップでそのURLが開かれる', (tester) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    const preview = CalendarEventPreview(
      summary: 'APIプレビュー タイトル',
      description: '発走: 15:40',
      location: 'API会場',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [
        RaceLink(
          label: 'レース情報(netkeiba)',
          url: 'https://netkeiba.example/info',
        ),
        RaceLink(
          label: 'レース映像（公式YouTube）',
          url: 'https://youtube.example/live',
        ),
      ],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();

    expect(find.text('レース情報(netkeiba)'), findsOneWidget);
    expect(find.text('レース映像（公式YouTube）'), findsOneWidget);

    await tester.tap(find.text('レース映像（公式YouTube）'));
    await tester.pump();

    expect(fake.lastLaunchedUrl, 'https://youtube.example/live');
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('[T-06] links_空_リンクボタンが表示されない', (tester) async {
    UrlLauncherPlatform.instance = _FakeUrlLauncher(result: true);

    await _pumpSheet(tester);
    await tester.pump();

    expect(find.byIcon(Icons.open_in_new), findsNothing);
  });

  testWidgets('[T-07] リンクタップ_起動失敗_「を開けませんでした」のSnackBarが表示される', (tester) async {
    UrlLauncherPlatform.instance = _FakeUrlLauncher(result: false);

    const preview = CalendarEventPreview(
      summary: 'APIプレビュー タイトル',
      description: '発走: 15:40',
      location: 'API会場',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [
        RaceLink(
          label: 'レース情報(netkeiba)',
          url: 'https://netkeiba.example/info',
        ),
      ],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();
    await tester.tap(find.text('レース情報(netkeiba)'));
    await tester.pump();

    expect(find.text('レース情報(netkeiba)を開けませんでした'), findsOneWidget);
  });

  testWidgets('[T-08] リンクタップ_テスト環境は非スタンドアロン_webOnlyWindowNameに_blankが渡る', (
    tester,
  ) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    const preview = CalendarEventPreview(
      summary: 'APIプレビュー タイトル',
      description: '発走: 15:40',
      location: 'API会場',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [
        RaceLink(
          label: 'レース情報(netkeiba)',
          url: 'https://netkeiba.example/info',
        ),
      ],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();
    await tester.tap(find.text('レース情報(netkeiba)'));
    await tester.pump();

    expect(fake.lastWebOnlyWindowName, '_blank');
  });

  testWidgets('[T-09] isFavorite_false_お気に入り登録通知ラベルで読み上げられる_記号なし', (
    tester,
  ) async {
    await _pumpSheet(tester);

    expect(find.bySemanticsLabel('お気に入り登録＋通知'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('☆')), findsNothing);
  });

  testWidgets('[T-10] isFavorite_true_登録済みラベルで読み上げられる_記号なし', (tester) async {
    await _pumpSheet(tester);
    await tester.tap(find.bySemanticsLabel('お気に入り登録＋通知'));
    await tester.pump();

    expect(
      find.bySemanticsLabel('登録済み、$kDefaultNotificationLeadMinutes分前に通知'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel(RegExp('★')), findsNothing);
  });

  testWidgets('[T-15] isFavorite_true_設定の通知タイミングが既定値と異なる_設定の実値が表示される', (
    tester,
  ) async {
    await _pumpSheet(tester, notificationLeadMinutes: 30);
    await tester.tap(find.bySemanticsLabel('お気に入り登録＋通知'));
    await tester.pump();

    expect(find.text('★ 登録済み・30分前に通知'), findsOneWidget);
    expect(
      find.textContaining('$kDefaultNotificationLeadMinutes分前に通知'),
      findsNothing,
    );
  });

  testWidgets('[T-11] カレンダー追加ボタン_Semantics経由のtapアクションが有効', (tester) async {
    await _pumpSheet(tester);

    final node = tester.getSemantics(find.bySemanticsLabel('カレンダー追加'));
    expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
  });

  testWidgets('[T-12] リンクチップ_Semantics経由のtapアクションが有効', (tester) async {
    const preview = CalendarEventPreview(
      summary: 'APIプレビュー タイトル',
      description: '発走: 15:40',
      location: 'API会場',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [
        RaceLink(
          label: 'レース情報(netkeiba)',
          url: 'https://netkeiba.example/info',
        ),
      ],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();

    final node = tester.getSemantics(find.bySemanticsLabel('レース情報(netkeiba)'));
    expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
  });

  testWidgets('[T-13] リンクURLがjavascript:スキーム_launchUrlが呼ばれず開けませんでしたが表示される', (
    tester,
  ) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    const preview = CalendarEventPreview(
      summary: 'APIプレビュー タイトル',
      description: '発走: 15:40',
      location: 'API会場',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [RaceLink(label: '不正リンク', url: 'javascript:alert(1)')],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();
    await tester.tap(find.text('不正リンク'));
    await tester.pump();

    expect(fake.lastLaunchedUrl, isNull);
    expect(find.text('不正リンクを開けませんでした'), findsOneWidget);
  });

  testWidgets('[T-14] showRaceDetailSheet_シートを閉じる_トリガー要素へフォーカスが復帰する', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final triggerFocusNode = FocusNode(debugLabel: 'trigger');
    addTearDown(triggerFocusNode.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                focusNode: triggerFocusNode,
                onPressed: () => showRaceDetailSheet(context, _race),
                child: const Text('詳細を開く'),
              ),
            ),
          ),
        ),
      ),
    );

    triggerFocusNode.requestFocus();
    await tester.pump();
    expect(triggerFocusNode.hasFocus, isTrue);

    await tester.tap(find.text('詳細を開く'));
    await tester.pumpAndSettle();

    // モーダルシートを外側タップで閉じる
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    expect(triggerFocusNode.hasFocus, isTrue);
  });

  testWidgets('[T-16] 海外競馬_発走時刻表示にJSTが付与される', (tester) async {
    await _pumpSheet(tester, race: _overseasRace);

    expect(find.textContaining('（JST）'), findsWidgets);
    expect(find.text('15:40 発走'), findsNothing);
  });

  testWidgets('[T-17] 中央競馬_発走時刻表示にJSTが付与されない', (tester) async {
    await _pumpSheet(tester);

    expect(find.textContaining('（JST）'), findsNothing);
  });

  testWidgets('[T-18] 出走選手ロスター_同一枠番を共有する車番違いの2選手_バッジ色は車番ごとに異なる', (
    tester,
  ) async {
    const players = [
      RacePlayerEntity(
        carNumber: 1,
        frameNumber: 1,
        playerNo: '000001',
        playerName: '選手A',
      ),
      RacePlayerEntity(
        carNumber: 2,
        frameNumber: 1,
        playerNo: '000002',
        playerName: '選手B',
      ),
    ];
    const preview = CalendarEventPreview(
      summary: '',
      description: '',
      location: '',
      startDateTime: '2026-04-19T15:40:00+09:00',
      endDateTime: '2026-04-19T15:50:00+09:00',
      links: [],
    );
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(_race, preview: preview, players: players),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();

    Color badgeColorFor(String carNumberLabel) {
      final container = tester.widget<Container>(
        find.ancestor(
          of: find.text(carNumberLabel),
          matching: find.byType(Container),
        ),
      );
      return (container.decoration! as BoxDecoration).color!;
    }

    expect(badgeColorFor('1'), keirinCarNumberColors[1]);
    expect(badgeColorFor('2'), keirinCarNumberColors[2]);
    expect(badgeColorFor('1'), isNot(badgeColorFor('2')));
  });

  const keirinTestPlayers = [
    RacePlayerEntity(
      carNumber: 1,
      frameNumber: 1,
      playerNo: '000001',
      playerName: '選手A',
    ),
    RacePlayerEntity(
      carNumber: 2,
      frameNumber: 2,
      playerNo: '000002',
      playerName: '選手B',
    ),
  ];
  const keirinTestPreview = CalendarEventPreview(
    summary: '',
    description: '',
    location: '',
    startDateTime: '2026-04-19T15:40:00+09:00',
    endDateTime: '2026-04-19T15:50:00+09:00',
    links: [],
  );

  testWidgets('[T-19] 出走選手ロスター_KEIRIN_登録済み選手は塗り星_未登録選手は枠線星で表示される', (
    tester,
  ) async {
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(
        _keirinRace,
        preview: keirinTestPreview,
        players: keirinTestPlayers,
      ),
    );
    getIt.registerSingleton<IPlayerRepository>(
      _FakePlayerRepository(
        responses: [
          [
            const PlayerEntity(
              raceType: 'keirin',
              playerNo: '000001',
              playerName: '選手A',
              priority: kWatchedPlayerPriority,
            ),
          ],
        ],
      ),
    );
    addTearDown(() {
      getIt.unregister<IRaceRepository>();
      getIt.unregister<IPlayerRepository>();
    });

    await _pumpSheet(tester, race: _keirinRace);
    await tester.pump();

    expect(find.byIcon(Icons.star), findsOneWidget);
    expect(find.byIcon(Icons.star_border), findsOneWidget);
  });

  testWidgets('[T-20] 出走選手ロスターの☆をタップ_setPlayerWatchが呼ばれ★表示に切り替わる', (
    tester,
  ) async {
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(
        _keirinRace,
        preview: keirinTestPreview,
        players: keirinTestPlayers,
      ),
    );
    final playerRepository = _FakePlayerRepository(
      responses: [
        const <PlayerEntity>[],
        [
          const PlayerEntity(
            raceType: 'keirin',
            playerNo: '000001',
            playerName: '選手A',
            priority: kWatchedPlayerPriority,
          ),
        ],
      ],
    );
    getIt.registerSingleton<IPlayerRepository>(playerRepository);
    addTearDown(() {
      getIt.unregister<IRaceRepository>();
      getIt.unregister<IPlayerRepository>();
    });

    await _pumpSheet(tester, race: _keirinRace);
    await tester.pump();

    expect(find.byIcon(Icons.star_border), findsNWidgets(2));

    await tester.tap(find.byIcon(Icons.star_border).first);
    await tester.pump();
    await tester.pump();

    expect(playerRepository.setPlayerWatchCalls, hasLength(1));
    expect(playerRepository.setPlayerWatchCalls.single, {
      'raceType': 'keirin',
      'playerNo': '000001',
      'playerName': '選手A',
      'watched': true,
    });
    expect(find.byIcon(Icons.star), findsOneWidget);
    expect(find.byIcon(Icons.star_border), findsOneWidget);
  });

  testWidgets('[T-21] 出走選手ロスター_KEIRIN以外_星アイコンは表示されない', (tester) async {
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(
        _race,
        preview: keirinTestPreview,
        players: keirinTestPlayers,
      ),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();

    expect(find.byIcon(Icons.star), findsNothing);
    expect(find.byIcon(Icons.star_border), findsNothing);
  });

  testWidgets('[T-29] 出走選手ロスター_AUTORACE_登録済み選手は塗り星_未登録選手は枠線星で表示される', (
    tester,
  ) async {
    getIt.registerSingleton<IRaceRepository>(
      _FakeRaceRepository(
        _autoraceRace,
        preview: keirinTestPreview,
        players: keirinTestPlayers,
      ),
    );
    getIt.registerSingleton<IPlayerRepository>(
      _FakePlayerRepository(
        responses: [
          [
            const PlayerEntity(
              raceType: 'autorace',
              playerNo: '000001',
              playerName: '選手A',
              priority: kWatchedPlayerPriority,
            ),
          ],
        ],
      ),
    );
    addTearDown(() {
      getIt.unregister<IRaceRepository>();
      getIt.unregister<IPlayerRepository>();
    });

    await _pumpSheet(tester, race: _autoraceRace);
    await tester.pump();

    expect(find.byIcon(Icons.star), findsOneWidget);
    expect(find.byIcon(Icons.star_border), findsOneWidget);
  });

  testWidgets('[T-22] RaceDetailContent_onClose未指定_✕ボタンが表示されない', (
    tester,
  ) async {
    await _pumpSheet(tester);

    expect(find.byIcon(Icons.close), findsNothing);
  });

  testWidgets('[T-23] RaceDetailContent_onClose指定_✕ボタンが表示されタップで呼ばれる', (
    tester,
  ) async {
    var closed = false;
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RaceDetailContent(race: _race, onClose: () => closed = true),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byIcon(Icons.close), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(closed, isTrue);
  });

  testWidgets('[T-24] showRaceDetailSheet_✕ボタンをタップ_シートが閉じトリガー要素へフォーカスが復帰する', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final triggerFocusNode = FocusNode(debugLabel: 'trigger');
    addTearDown(triggerFocusNode.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                focusNode: triggerFocusNode,
                onPressed: () => showRaceDetailSheet(context, _race),
                child: const Text('詳細を開く'),
              ),
            ),
          ),
        ),
      ),
    );

    triggerFocusNode.requestFocus();
    await tester.pump();

    await tester.tap(find.text('詳細を開く'));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.close), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.close), findsNothing);
    expect(triggerFocusNode.hasFocus, isTrue);
  });

  testWidgets('[T-25] KV一覧_グレードあり_ステージなし_レース行は番号のみでグレード行が別に表示される', (
    tester,
  ) async {
    await _pumpSheet(tester);

    expect(find.text('11R'), findsOneWidget);
    expect(find.text('11R（GⅠ）'), findsNothing);
    expect(find.text('グレード'), findsOneWidget);
    // ヘッダーのGradeBadgeとKV行の両方に'GⅠ'が表示される
    expect(find.text('GⅠ'), findsNWidgets(2));
    expect(find.text('ステージ'), findsNothing);
  });

  testWidgets('[T-26] KV一覧_グレードステージともにあり_それぞれ別行で表示される', (tester) async {
    await _pumpSheet(tester, race: _keirinFinalRace);

    expect(find.text('12R'), findsOneWidget);
    expect(find.text('グレード'), findsOneWidget);
    expect(find.text('S級S班'), findsNWidgets(2));
    expect(find.text('ステージ'), findsOneWidget);
    expect(find.text('決勝'), findsNWidgets(2));
  });

  testWidgets('[T-27] KV一覧_グレードステージともになし_行が表示されない', (tester) async {
    await _pumpSheet(tester, race: _keirinRace);

    expect(find.text('グレード'), findsNothing);
    expect(find.text('ステージ'), findsNothing);
  });

  testWidgets('[T-28] KV一覧_馬場種別と距離の両方あり_条件行に芝スペース中黒スペース1200mが表示される', (
    tester,
  ) async {
    await _pumpSheet(tester, race: _raceWithCondition);

    expect(find.text('条件'), findsOneWidget);
    // ヘッダーの_MetaChipとKV行の両方に「芝 ・ 1200m」が表示される
    expect(find.text('芝 ・ 1200m'), findsNWidgets(2));
  });

  testWidgets('[T-30] raceDetailUiProviderが取得失敗_ErrorRetryCardが表示され再試行で復帰する', (
    tester,
  ) async {
    getIt.registerSingleton<IRaceRepository>(
      _FlakyRaceRepository(_race, failCount: 1),
    );
    addTearDown(() => getIt.unregister<IRaceRepository>());

    await _pumpSheet(tester);
    await tester.pump();

    expect(find.text('レース詳細の一部の取得に失敗しました'), findsOneWidget);
    expect(find.text('再試行'), findsOneWidget);

    await tester.tap(find.text('再試行'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));

    expect(find.text('レース詳細の一部の取得に失敗しました'), findsNothing);
    expect(find.text('会場'), findsOneWidget);
  });

  testWidgets('[T-31] ヘッダーの発走時刻表示_M/D_HH:mm_発走の形式で日付が含まれる', (tester) async {
    await _pumpSheet(tester);

    expect(find.text('4/19 15:40 発走'), findsOneWidget);
  });

  testWidgets('[T-32] race.isConfirmed_false_未確定バッジが表示される', (tester) async {
    await _pumpSheet(tester, race: _race.copyWith(isConfirmed: false));

    expect(find.text('未確定'), findsOneWidget);
  });

  testWidgets('[T-33] race.isConfirmed_trueまたはnull_未確定バッジが表示されない', (
    tester,
  ) async {
    await _pumpSheet(tester);

    expect(find.text('未確定'), findsNothing);
  });
}
