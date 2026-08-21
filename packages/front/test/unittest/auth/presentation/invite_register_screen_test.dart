// InviteRegisterScreen のデシジョンテーブル
//
// | ID   | 条件                                                    | 期待                                    |
// | ---- | -------------------------------------------------------- | --------------------------------------- |
// | T-01 | 招待が無効（verifyInvite=false）                          | 「招待が無効です」が表示される          |
// | T-02 | 招待が有効・ニックネーム未入力で登録ボタンをタップ        | 「ニックネームを入力してください」が表示される |
// | T-03 | 招待が有効・登録成功                                      | sessionProviderにセッションが保存される |
// | T-04 | 招待が有効・登録直前にfetchRegisterOptionsが招待無効(null)を返す | 「招待が無効です」が表示される     |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/auth/application/session_provider.dart';
import 'package:front/auth/data/auth_repository_impl.dart';
import 'package:front/auth/data/webauthn_client/webauthn_client.dart';
import 'package:front/auth/domain/auth_session.dart';
import 'package:front/auth/domain/i_auth_repository.dart';
import 'package:front/auth/presentation/invite_register_screen.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuthRepository implements IAuthRepository {
  _FakeAuthRepository({
    this.inviteValid = true,
    this.registerOptions = const AuthChallenge(
      challengeId: 'challenge-1',
      options: {},
    ),
    this.registerSession,
  });

  final bool inviteValid;

  /// fetchRegisterOptionsが返すチャレンジ。nullなら招待無効（400相当）を模擬する。
  final AuthChallenge? registerOptions;

  /// verifyRegisterが返すセッション。nullなら登録失敗を模擬する。
  final AuthSession? registerSession;

  @override
  Future<bool> verifyInvite(String inviteToken) async => inviteValid;

  @override
  Future<String> requestJoin(String nickname) => throw UnimplementedError();

  @override
  Future<JoinRequestStatus> fetchJoinRequestStatus(String requestId) =>
      throw UnimplementedError();

  @override
  Future<AuthChallenge?> fetchRegisterOptions(String inviteToken) async =>
      registerOptions;

  @override
  Future<AuthSession?> verifyRegister({
    required String challengeId,
    required String nickname,
    required Map<String, dynamic> credentialResponse,
  }) async => registerSession;

  @override
  Future<AuthChallenge> fetchLoginOptions() => throw UnimplementedError();

  @override
  Future<AuthSession?> verifyLogin({
    required String challengeId,
    required Map<String, dynamic> credentialResponse,
  }) => throw UnimplementedError();
}

class _FakeWebauthnClient implements WebauthnClient {
  _FakeWebauthnClient({this.registerResult});

  /// register()の戻り値。nullならユーザーキャンセルを模擬する。
  final Map<String, dynamic>? registerResult;

  @override
  Future<Map<String, dynamic>?> register(
    Map<String, dynamic> optionsJson,
  ) async => registerResult;

  @override
  Future<Map<String, dynamic>?> authenticate(
    Map<String, dynamic> optionsJson,
  ) => throw UnimplementedError();
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
          home: InviteRegisterScreen(
            inviteToken: 'invite-token-1',
            webauthnClient: webauthnClient,
          ),
        );
      },
    ),
  );
}

void main() {
  testWidgets('[T-01] 招待が無効_招待が無効ですと表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(inviteValid: false),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('招待が無効です'), findsOneWidget);
    expect(find.text('パスキーを登録'), findsNothing);
  });

  testWidgets('[T-02] 招待が有効_ニックネーム未入力で登録_ニックネームを入力してくださいと表示される', (
    tester,
  ) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('パスキーを登録'));
    await tester.pumpAndSettle();

    expect(find.text('ニックネームを入力してください'), findsOneWidget);
  });

  testWidgets('[T-03] 招待が有効_登録成功_sessionProviderにセッションが保存される', (tester) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          registerSession: const AuthSession(
            token: 'token-1',
            nickname: 'テスト花子',
          ),
        ),
        webauthnClient: _FakeWebauthnClient(
          registerResult: const {'id': 'cred-1'},
        ),
        captureRef: (r) => ref = r,
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('パスキーを登録'));
    await tester.pumpAndSettle();

    final session = ref.read(sessionProvider);
    expect(session?.token, 'token-1');
    expect(session?.nickname, 'テスト花子');
  });

  testWidgets('[T-04] 招待が有効だが登録直前に招待無効化_招待が無効ですと表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(registerOptions: null),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('パスキーを登録'));
    await tester.pumpAndSettle();

    expect(find.text('招待が無効です'), findsOneWidget);
  });
}
