// LoginScreen のデシジョンテーブル
//
// | ID   | 条件                                                | 期待                                        |
// | ---- | --------------------------------------------------- | ------------------------------------------- |
// | T-01 | 「パスキーでログイン」をタップ・成功                | sessionProviderにセッションが保存される     |
// | T-02 | ボタンをタップ・認証がキャンセルされる（authenticate()がnull） | 「ログインがキャンセルされました」が表示される |
// | T-03 | ボタンをタップ・verifyLoginが失敗（401相当・null）  | 「ログインに失敗しました」が表示される      |
// | T-04 | 画面表示                                             | 「招待コードをお持ちでない方はこちら」リンクが表示される |
// | T-05 | 画面表示                                             | 「ログインせずに設定を見る」リンクが表示される |
// | T-06 | extractInviteToken・トークンのみを渡す               | そのまま返す                               |
// | T-07 | extractInviteToken・招待URL全体を渡す                | URL末尾のトークン部分だけを返す            |
// | T-08 | extractInviteToken・前後に空白があるトークンを渡す   | トリムして返す                             |
// | T-09 | 招待コードを入力して「招待コードで進む」をタップ     | 該当トークンで `/invite/:token` へ遷移する |
// | T-10 | 招待URL全体を貼り付けて「招待コードで進む」をタップ  | 抽出したトークンで `/invite/:token` へ遷移する |
// | T-11 | 招待コード未入力で「招待コードで進む」をタップ       | 遷移しない                                 |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/auth/application/session_provider.dart';
import 'package:front/auth/data/auth_repository_impl.dart';
import 'package:front/auth/data/webauthn_client/webauthn_client.dart';
import 'package:front/auth/domain/auth_session.dart';
import 'package:front/auth/domain/i_auth_repository.dart';
import 'package:front/auth/presentation/login_screen.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuthRepository implements IAuthRepository {
  _FakeAuthRepository({this.loginSession});

  /// verifyLoginが返すセッション。nullなら失敗（401相当）を模擬する。
  final AuthSession? loginSession;

  @override
  Future<AuthChallenge> fetchLoginOptions() async =>
      const AuthChallenge(challengeId: 'challenge-1', options: {});

  @override
  Future<AuthSession?> verifyLogin({
    required String challengeId,
    required Map<String, dynamic> credentialResponse,
  }) async => loginSession;

  @override
  Future<bool> verifyInvite(String inviteToken) => throw UnimplementedError();

  @override
  Future<String> requestJoin(String nickname) => throw UnimplementedError();

  @override
  Future<JoinRequestStatus> fetchJoinRequestStatus(String requestId) =>
      throw UnimplementedError();

  @override
  Future<AuthChallenge?> fetchRegisterOptions(String inviteToken) =>
      throw UnimplementedError();

  @override
  Future<AuthSession?> verifyRegister({
    required String challengeId,
    required String nickname,
    required Map<String, dynamic> credentialResponse,
  }) => throw UnimplementedError();
}

class _FakeWebauthnClient implements WebauthnClient {
  _FakeWebauthnClient({this.authenticateResult});

  /// authenticate()の戻り値。nullならユーザーキャンセルを模擬する。
  final Map<String, dynamic>? authenticateResult;

  @override
  Future<Map<String, dynamic>?> authenticate(
    Map<String, dynamic> optionsJson,
  ) async => authenticateResult;

  @override
  Future<Map<String, dynamic>?> register(Map<String, dynamic> optionsJson) =>
      throw UnimplementedError();
}

Future<Widget> _buildApp({
  required IAuthRepository repository,
  required WebauthnClient webauthnClient,
  required void Function(WidgetRef ref) captureRef,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      authRepositoryProvider.overrideWithValue(repository),
    ],
    child: Consumer(
      builder: (context, ref, _) {
        captureRef(ref);
        return MaterialApp(
          theme: AppTheme.light(),
          home: LoginScreen(webauthnClient: webauthnClient),
        );
      },
    ),
  );
}

/// 「招待コードで進む」タップ（[GoRouter.go]）検証用に、`/invite/:token`
/// への遷移だけを扱う簡易ルータで [LoginScreen] を配線する。
Future<Widget> _buildRoutedApp() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) =>
            LoginScreen(webauthnClient: _FakeWebauthnClient()),
      ),
      GoRoute(
        path: '/invite/:token',
        builder: (context, state) =>
            Scaffold(body: Text('招待画面:${state.pathParameters['token']}')),
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
    ],
    child: MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
  );
}

void main() {
  test('[T-06] extractInviteToken_トークンのみを渡す_そのまま返す', () {
    expect(extractInviteToken('abc123'), 'abc123');
  });

  test('[T-07] extractInviteToken_招待URL全体を渡す_URL末尾のトークン部分だけを返す', () {
    expect(
      extractInviteToken(
        'https://race-schedule-front-test.pages.dev/invite/abc123',
      ),
      'abc123',
    );
  });

  test('[T-08] extractInviteToken_前後に空白があるトークンを渡す_トリムして返す', () {
    expect(extractInviteToken('  abc123  '), 'abc123');
  });

  testWidgets('[T-09] 招待コードを入力して進むをタップ_該当トークンでinvite画面へ遷移する', (tester) async {
    await tester.pumpWidget(await _buildRoutedApp());
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'abc123');
    await tester.tap(find.text('招待コードで進む'));
    await tester.pumpAndSettle();

    expect(find.text('招待画面:abc123'), findsOneWidget);
  });

  testWidgets('[T-10] 招待URL全体を貼り付けて進むをタップ_抽出したトークンでinvite画面へ遷移する', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildRoutedApp());
    await tester.pump();

    await tester.enterText(
      find.byType(TextField),
      'https://race-schedule-front-test.pages.dev/invite/abc123',
    );
    await tester.tap(find.text('招待コードで進む'));
    await tester.pumpAndSettle();

    expect(find.text('招待画面:abc123'), findsOneWidget);
  });

  testWidgets('[T-11] 招待コード未入力で進むをタップ_遷移しない', (tester) async {
    await tester.pumpWidget(await _buildRoutedApp());
    await tester.pump();

    await tester.tap(find.text('招待コードで進む'));
    await tester.pumpAndSettle();

    expect(find.text('パスキーでログイン'), findsOneWidget);
  });

  testWidgets('[T-01] パスキーでログイン_成功_sessionProviderにセッションが保存される', (
    tester,
  ) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          loginSession: const AuthSession(token: 'token-1', nickname: 'テスト太郎'),
        ),
        webauthnClient: _FakeWebauthnClient(
          authenticateResult: const {'id': 'cred-1'},
        ),
        captureRef: (r) => ref = r,
      ),
    );

    await tester.tap(find.text('パスキーでログイン'));
    await tester.pumpAndSettle();

    final session = ref.read(sessionProvider);
    expect(session?.token, 'token-1');
    expect(session?.nickname, 'テスト太郎');
  });

  testWidgets('[T-02] 認証がキャンセルされる_ログインがキャンセルされましたと表示される', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (r) => ref = r,
      ),
    );

    await tester.tap(find.text('パスキーでログイン'));
    await tester.pumpAndSettle();

    expect(find.text('ログインがキャンセルされました'), findsOneWidget);
    expect(ref.read(sessionProvider), isNull);
  });

  testWidgets('[T-03] verifyLoginが失敗_ログインに失敗しましたと表示される', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(loginSession: null),
        webauthnClient: _FakeWebauthnClient(
          authenticateResult: const {'id': 'cred-1'},
        ),
        captureRef: (r) => ref = r,
      ),
    );

    await tester.tap(find.text('パスキーでログイン'));
    await tester.pumpAndSettle();

    expect(find.text('ログインに失敗しました'), findsOneWidget);
    expect(ref.read(sessionProvider), isNull);
  });

  testWidgets('[T-04] 画面表示_招待コードをお持ちでない方はこちらリンクが表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );

    expect(find.text('招待コードをお持ちでない方はこちら'), findsOneWidget);
  });

  testWidgets('[T-05] 画面表示_ログインせずに設定を見るリンクが表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );

    expect(find.text('ログインせずに設定を見る'), findsOneWidget);
  });
}
