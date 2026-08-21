// JoinRequestScreen のデシジョンテーブル
//
// | ID   | 条件                                                          | 期待                                    |
// | ---- | -------------------------------------------------------------- | ---------------------------------------- |
// | T-01 | ニックネーム未入力でリクエストをタップ                        | 「ニックネームを入力してください」が表示される |
// | T-02 | リクエスト送信成功                                            | 承認待ちの案内が表示される               |
// | T-03 | ポーリング中はstatus=pendingが続く                            | 承認待ちの案内が表示され続ける           |
// | T-04 | ポーリングでstatus=rejectedを取得                             | 「参加リクエストは却下されました」が表示される |
// | T-05 | ポーリングでstatus=approvedを取得・登録成功                   | sessionProviderにセッションが保存される  |
// | T-06 | status=approvedだが登録直前にfetchRegisterOptionsが招待無効(null) | 「登録に失敗しました」が表示される    |
// | T-07 | T-06の状態から「パスキー登録をやり直す」をタップ・成功        | sessionProviderにセッションが保存される  |
// | T-08 | 2回のポーリングがほぼ同時にstatus=approvedを検知              | 登録（register呼び出し）は1回だけ実行される |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/auth/application/session_provider.dart';
import 'package:front/auth/data/auth_repository_impl.dart';
import 'package:front/auth/data/webauthn_client/webauthn_client.dart';
import 'package:front/auth/domain/auth_session.dart';
import 'package:front/auth/domain/i_auth_repository.dart';
import 'package:front/auth/presentation/join_request_screen.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuthRepository implements IAuthRepository {
  _FakeAuthRepository({
    List<JoinRequestStatus>? statusQueue,
    this.statusDelay,
    this.registerOptions = const AuthChallenge(
      challengeId: 'challenge-1',
      options: {},
    ),
    this.registerSession,
  }) : _statusQueue = statusQueue ?? [];

  final List<JoinRequestStatus> _statusQueue;

  /// fetchJoinRequestStatusの応答を遅らせる時間（T-08: 複数tickが重複して
  /// 承認を検知する状況を再現するために使う）。
  final Duration? statusDelay;

  /// fetchRegisterOptionsが返すチャレンジ。nullなら招待無効（400相当）を模擬する。
  final AuthChallenge? registerOptions;

  /// verifyRegisterが返すセッション。nullなら登録失敗を模擬する。
  final AuthSession? registerSession;

  @override
  Future<String> requestJoin(String nickname) async => 'request-1';

  @override
  Future<JoinRequestStatus> fetchJoinRequestStatus(String requestId) async {
    final delay = statusDelay;
    if (delay != null) await Future<void>.delayed(delay);
    if (_statusQueue.isEmpty) {
      return const JoinRequestStatus(status: 'pending', inviteToken: null);
    }
    return _statusQueue.length == 1
        ? _statusQueue.first
        : _statusQueue.removeAt(0);
  }

  @override
  Future<bool> verifyInvite(String inviteToken) => throw UnimplementedError();

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
  _FakeWebauthnClient({this.registerResult}) : _registerResults = null;

  /// 呼び出しごとに順番に返す結果（T-07: 1回目は失敗、2回目（やり直し）は成功）。
  /// 指定した場合、末尾の値を以降の呼び出しでも返し続ける。
  _FakeWebauthnClient.sequence(List<Map<String, dynamic>?> results)
    : registerResult = null,
      _registerResults = results;

  /// register()の戻り値。nullならユーザーキャンセルを模擬する。
  final Map<String, dynamic>? registerResult;
  final List<Map<String, dynamic>?>? _registerResults;

  /// register()が呼ばれた回数（T-08: 重複登録が起きていないことの検証用）。
  int registerCallCount = 0;

  @override
  Future<Map<String, dynamic>?> register(
    Map<String, dynamic> optionsJson,
  ) async {
    registerCallCount++;
    final results = _registerResults;
    if (results == null) return registerResult;
    return results.length == 1 ? results.first : results.removeAt(0);
  }

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
          home: JoinRequestScreen(webauthnClient: webauthnClient),
        );
      },
    ),
  );
}

/// [Timer.periodic]のポーリングが1周するのに十分な待ち時間（[JoinRequestScreen]の
/// ポーリング間隔・3秒より長い値）。
const _pollWait = Duration(seconds: 4);

void main() {
  testWidgets('[T-01] ニックネーム未入力でリクエスト_ニックネームを入力してくださいと表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    expect(find.text('ニックネームを入力してください'), findsOneWidget);
  });

  testWidgets('[T-02] リクエスト送信成功_承認待ちの案内が表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    expect(find.text('運用者の承認をお待ちください。承認されると自動的に登録を続行します'), findsOneWidget);
  });

  testWidgets('[T-03] ポーリング中status=pendingが続く_承認待ちの案内が表示され続ける', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    await tester.pump(_pollWait);
    await tester.pumpAndSettle();

    expect(find.text('運用者の承認をお待ちください。承認されると自動的に登録を続行します'), findsOneWidget);
  });

  testWidgets('[T-04] ポーリングでstatus=rejectedを取得_却下されましたと表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          statusQueue: [
            const JoinRequestStatus(status: 'rejected', inviteToken: null),
          ],
        ),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    await tester.pump(_pollWait);
    await tester.pumpAndSettle();

    expect(find.text('参加リクエストは却下されました'), findsOneWidget);
  });

  testWidgets(
    '[T-05] ポーリングでstatus=approvedを取得・登録成功_sessionProviderにセッションが保存される',
    (tester) async {
      late WidgetRef ref;
      await tester.pumpWidget(
        await _buildApp(
          repository: _FakeAuthRepository(
            statusQueue: [
              const JoinRequestStatus(
                status: 'approved',
                inviteToken: 'invite-token-1',
              ),
            ],
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
      await tester.tap(find.text('リクエストを送信'));
      await tester.pumpAndSettle();

      await tester.pump(_pollWait);
      await tester.pumpAndSettle();

      final session = ref.read(sessionProvider);
      expect(session?.token, 'token-1');
      expect(session?.nickname, 'テスト花子');
    },
  );

  testWidgets('[T-06] status=approvedだが登録直前に招待無効化_登録に失敗しましたと表示される', (
    tester,
  ) async {
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          statusQueue: [
            const JoinRequestStatus(
              status: 'approved',
              inviteToken: 'invite-token-1',
            ),
          ],
          registerOptions: null,
        ),
        webauthnClient: _FakeWebauthnClient(),
        captureRef: (_) {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    await tester.pump(_pollWait);
    await tester.pumpAndSettle();

    expect(find.text('登録に失敗しました'), findsOneWidget);
    expect(find.text('パスキー登録をやり直す'), findsOneWidget);
  });

  testWidgets('[T-07] 登録失敗後にやり直す_成功するとsessionProviderにセッションが保存される', (
    tester,
  ) async {
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          statusQueue: [
            const JoinRequestStatus(
              status: 'approved',
              inviteToken: 'invite-token-1',
            ),
          ],
          registerSession: const AuthSession(
            token: 'token-1',
            nickname: 'テスト花子',
          ),
        ),
        // 1回目のregister()はnull（ユーザーキャンセル相当）で登録失敗、
        // 2回目（やり直しタップ後）は成功させる。
        webauthnClient: _FakeWebauthnClient.sequence([
          null,
          const {'id': 'cred-1'},
        ]),
        captureRef: (r) => ref = r,
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    await tester.pump(_pollWait);
    await tester.pumpAndSettle();
    expect(find.text('パスキー登録をやり直す'), findsOneWidget);

    await tester.tap(find.text('パスキー登録をやり直す'));
    await tester.pumpAndSettle();

    final session = ref.read(sessionProvider);
    expect(session?.token, 'token-1');
    expect(session?.nickname, 'テスト花子');
  });

  testWidgets('[T-08] 2回のポーリングがほぼ同時に承認を検知_登録は1回だけ実行される', (tester) async {
    final webauthnClient = _FakeWebauthnClient(
      registerResult: const {'id': 'cred-1'},
    );
    late WidgetRef ref;
    await tester.pumpWidget(
      await _buildApp(
        repository: _FakeAuthRepository(
          statusQueue: [
            const JoinRequestStatus(
              status: 'approved',
              inviteToken: 'invite-token-1',
            ),
          ],
          // status応答を4秒遅らせることで、3秒間隔のtickが2回（t=3s/t=6s）
          // 発火してから承認が判明する状況（重複登録の温床）を再現する。
          statusDelay: const Duration(seconds: 4),
          registerSession: const AuthSession(
            token: 'token-1',
            nickname: 'テスト花子',
          ),
        ),
        webauthnClient: webauthnClient,
        captureRef: (r) => ref = r,
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'テスト花子');
    await tester.tap(find.text('リクエストを送信'));
    await tester.pumpAndSettle();

    await tester.pump(const Duration(seconds: 3)); // t=3s: 1回目のtick
    await tester.pump(const Duration(seconds: 3)); // t=6s: 2回目のtick
    // t=7s: 1回目のtickの応答が届き登録開始／t=10s: 2回目のtickの応答が
    // 届くが、既に登録中のためガードされる。
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();

    expect(webauthnClient.registerCallCount, 1);
    final session = ref.read(sessionProvider);
    expect(session?.token, 'token-1');
  });
}
