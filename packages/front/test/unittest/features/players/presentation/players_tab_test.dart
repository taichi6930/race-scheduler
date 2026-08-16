// PlayersTab のデシジョンテーブル
//
// | ID   | 条件                                              | 期待                                              |
// | ---- | ------------------------------------------------- | -------------------------------------------------- |
// | T-01 | KEIRIN・AUTORACEに同姓同名の別選手が登録済み       | 各行に種目名（競輪/オートレース）が表示され区別できる（回帰: KEIRIN+AUTORACE横断化で同姓同名が並んだ際に見分けられなかった不具合） |
// | T-02 | 検索欄でEnter（検索アクション）を確定             | デバウンス（300ms）を待たず即座に検索APIが呼ばれる（QSRCH-06） |
// | T-03 | 検索欄のTextFieldウィジェット                     | textInputAction=search・autocorrect/enableSuggestions=false（QSRCH-06/07） |
// | T-04 | 注目トグルが失敗（QSRCH-01）                       | 失敗を伝えるSnackBarが表示される       |
// | T-05 | 検索欄に1文字だけ入力（QSRCH-02）                  | 検索APIが呼ばれず「2文字以上入力してください」と表示される |
// | T-06 | 検索欄に2文字入力（QSRCH-02）                      | 検索APIが呼ばれる                      |
// | T-07 | 検索欄に文字を入力した直後（デバウンス前、QSRCH-03） | クリア（×）ボタンが即座に表示される    |
// | T-08 | 検索結果が2件（QSRCH-04）                          | 「2件」の件数表示が出る                |
// | T-09 | 検索結果が0件（QSRCH-08）                          | 検索対象競技（競輪・オートレース）を含む文言が表示される |
// | T-10 | デバウンス確定前（QSRCH-10）にウィジェットが破棄される | 入力中の検索語がplayerSearchQueryProviderへ即座にコミットされる |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/service_locator.dart';
import 'package:front/design/theme.dart';
import 'package:front/domain/entities/player_entity.dart';
import 'package:front/domain/repositories/i_player_repository.dart';
import 'package:front/features/players/application/player_search_provider.dart';
import 'package:front/features/players/presentation/players_tab.dart';

class _FixedPlayerRepository implements IPlayerRepository {
  _FixedPlayerRepository(this.players);

  final List<PlayerEntity> players;

  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async => players;

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {}
}

class _TrackingPlayerRepository implements IPlayerRepository {
  _TrackingPlayerRepository({this.resultsForSearch = const []});

  final List<String?> searchedNames = [];
  final List<PlayerEntity> resultsForSearch;

  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async {
    if (playerName != null) searchedNames.add(playerName);
    return playerName == null ? const [] : resultsForSearch;
  }

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {}
}

class _FailingPlayerRepository implements IPlayerRepository {
  @override
  Future<List<PlayerEntity>> getPlayersByRaceType({
    required List<String> raceTypeList,
    String? playerName,
  }) async => const [
    PlayerEntity(
      raceType: 'keirin',
      playerNo: '014833',
      playerName: '青山周平',
      priority: kWatchedPlayerPriority,
    ),
  ];

  @override
  Future<void> setPlayerWatch({
    required String raceType,
    required String playerNo,
    required String playerName,
    required bool watched,
  }) async {
    throw Exception('network error');
  }
}

void main() {
  testWidgets('[T-01] KEIRIN_AUTORACEに同姓同名の別選手_種目名で区別できる', (tester) async {
    getIt.registerSingleton<IPlayerRepository>(
      _FixedPlayerRepository(const [
        PlayerEntity(
          raceType: 'autorace',
          playerNo: '000001',
          playerName: '青山周平',
          priority: kWatchedPlayerPriority,
          branch: '伊勢崎',
        ),
        PlayerEntity(
          raceType: 'keirin',
          playerNo: '014833',
          playerName: '青山周平',
          priority: kWatchedPlayerPriority,
        ),
      ]),
    );
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('青山周平'), findsNWidgets(2));
    expect(find.text('オートレース・伊勢崎'), findsOneWidget);
    expect(find.text('競輪'), findsOneWidget);
  });

  testWidgets('[T-02] 検索欄でEnterを確定するとデバウンスを待たず即座に検索されること', (
    tester,
  ) async {
    final repository = _TrackingPlayerRepository();
    getIt.registerSingleton<IPlayerRepository>(repository);
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), '青山');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump();

    expect(repository.searchedNames, contains('青山'));
  });

  testWidgets('[T-03] 検索欄はsearchアクション・自動修正/変換候補オフで構成されること', (
    tester,
  ) async {
    getIt.registerSingleton<IPlayerRepository>(
      _FixedPlayerRepository(const []),
    );
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    final field = tester.widget<TextField>(find.byType(TextField));

    expect(field.textInputAction, TextInputAction.search);
    expect(field.autocorrect, isFalse);
    expect(field.enableSuggestions, isFalse);
    expect(field.textCapitalization, TextCapitalization.none);
  });

  testWidgets('[T-04] 注目トグルが失敗すると失敗を伝えるSnackBarが表示される', (tester) async {
    getIt.registerSingleton<IPlayerRepository>(_FailingPlayerRepository());
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.byIcon(Icons.star));
    await tester.pump();
    await tester.pump();

    expect(find.text('青山周平の注目設定の変更に失敗しました'), findsOneWidget);
  });

  testWidgets('[T-05] 検索欄に1文字だけ入力すると検索されず案内文言が表示される', (tester) async {
    final repository = _TrackingPlayerRepository();
    getIt.registerSingleton<IPlayerRepository>(repository);
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), '青');
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.searchedNames, isEmpty);
    expect(find.text('2文字以上入力してください。'), findsOneWidget);
  });

  testWidgets('[T-06] 検索欄に2文字入力すると検索APIが呼ばれる', (tester) async {
    final repository = _TrackingPlayerRepository();
    getIt.registerSingleton<IPlayerRepository>(repository);
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), '青山');
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.searchedNames, contains('青山'));
  });

  testWidgets('[T-07] 検索欄に文字を入力した直後にクリアボタンが即座に表示される', (tester) async {
    getIt.registerSingleton<IPlayerRepository>(
      _FixedPlayerRepository(const []),
    );
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    expect(find.byIcon(Icons.clear), findsNothing);

    await tester.enterText(find.byType(TextField), '青');
    await tester.pump();

    expect(find.byIcon(Icons.clear), findsOneWidget);
  });

  testWidgets('[T-08] 検索結果が2件のとき件数が表示される', (tester) async {
    final repository = _TrackingPlayerRepository(
      resultsForSearch: const [
        PlayerEntity(
          raceType: 'keirin',
          playerNo: '014833',
          playerName: '青山周平',
          priority: 0,
        ),
        PlayerEntity(
          raceType: 'autorace',
          playerNo: '000001',
          playerName: '青山太郎',
          priority: 0,
        ),
      ],
    );
    getIt.registerSingleton<IPlayerRepository>(repository);
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), '青山');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();

    expect(find.text('2件'), findsOneWidget);
  });

  testWidgets('[T-09] 検索結果が0件のとき検索対象競技を含む文言が表示される', (tester) async {
    final repository = _TrackingPlayerRepository();
    getIt.registerSingleton<IPlayerRepository>(repository);
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), '存在しない選手名');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();

    expect(
      find.text('該当する選手が見つかりませんでした。\n検索対象は競輪・オートレースの選手です。'),
      findsOneWidget,
    );
  });

  testWidgets('[T-10] デバウンス確定前にウィジェットが破棄されると入力中の検索語がコミットされる', (
    tester,
  ) async {
    getIt.registerSingleton<IPlayerRepository>(
      _FixedPlayerRepository(const []),
    );
    addTearDown(() => getIt.unregister<IPlayerRepository>());

    final container = ProviderContainer();

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: PlayersTab()),
        ),
      ),
    );
    await tester.pump();

    // デバウンス（300ms）を待たずにウィジェットを破棄する。
    await tester.enterText(find.byType(TextField), '青山');
    await tester.pumpWidget(const SizedBox.shrink());

    expect(container.read(playerSearchQueryProvider), '青山');

    // ウィジェット破棄に伴うRiverpodのautoDispose後始末（内部で
    // Timer(Duration.zero, ...)をスケジュールする）がテスト終了時点で
    // 未処理のまま残ると"A Timer is still pending"でテストが失敗するため、
    // addTearDownで遅延させず、ここで即座にcontainerを破棄してタイマーを
    // キャンセルする。
    container.dispose();
  });
}
