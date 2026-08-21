import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../data/auth_repository_impl.dart';
import '../data/webauthn_client/webauthn_client.dart';
import '../application/session_provider.dart';

/// 招待コード入力欄の値から、招待登録画面（`/invite/:token`）へ渡す
/// トークンを取り出す。招待URL全体（`https://.../invite/<token>`）を
/// そのまま貼り付けた場合はURL末尾のトークン部分だけを、素のトークンを
/// 入力した場合はそのまま返す（前後の空白は除去する）。ドメイントップから
/// 入って招待コードを手入力・貼り付けする経路（ユーザー依頼）で、
/// URLごと貼っても素のトークンを貼ってもどちらでも動くようにするため。
String extractInviteToken(String input) {
  final trimmed = input.trim();
  const marker = '/invite/';
  final index = trimmed.lastIndexOf(marker);
  if (index == -1) return trimmed;
  return trimmed.substring(index + marker.length);
}

/// ログイン画面（パスキー1つでログインするシンプルな画面）。
///
/// セッションが無い状態で他画面へアクセスすると`appRouter`の`redirect`から
/// ここへ誘導される（`lib/navigation/app_router.dart`）。ログイン成功後は
/// [sessionProvider] の更新をトリガーに、同じ`redirect`がタイムラインへ
/// 自動的に戻すため、ログイン処理自体はこの画面から明示的な画面遷移を
/// 行わない（招待コード入力・招待コードなしの参加リクエスト画面`/join`・
/// 未ログインでも閲覧できる設定画面`/settings`への導線のみ例外。設定画面は
/// レース情報を含まず、設定内の「管理画面」ボタンへログイン無しで辿り着ける
/// ようにするための導線のため、この画面から明示的にリンクしないと
/// `/settings`が公開ルートになっていても実際には辿り着けなかった）。
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, WebauthnClient? webauthnClient})
    : _webauthnClient = webauthnClient;

  final WebauthnClient? _webauthnClient;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  late final WebauthnClient _webauthnClient =
      widget._webauthnClient ?? createWebauthnClient();
  final _inviteTokenController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _inviteTokenController.dispose();
    super.dispose();
  }

  void _submitInviteToken() {
    final token = extractInviteToken(_inviteTokenController.text);
    if (token.isEmpty) return;
    context.go('/invite/$token');
  }

  Future<void> _login() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final repository = ref.read(authRepositoryProvider);
      final challenge = await repository.fetchLoginOptions();
      final credentialResponse = await _webauthnClient.authenticate(
        challenge.options,
      );
      if (credentialResponse == null) {
        setState(() => _errorMessage = 'ログインがキャンセルされました');
        return;
      }

      final session = await repository.verifyLogin(
        challengeId: challenge.challengeId,
        credentialResponse: credentialResponse,
      );
      if (session == null) {
        setState(() => _errorMessage = 'ログインに失敗しました');
        return;
      }

      await ref.read(sessionProvider.notifier).save(session);
    } on Exception {
      setState(() => _errorMessage = 'ログインに失敗しました。時間をおいて再度お試しください');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.bg,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '開催盤',
                style: AppTypography.appBarDate.copyWith(color: colors.ink),
              ),
              const SizedBox(height: 8),
              Text(
                '登録済みのパスキーでログインしてください',
                textAlign: TextAlign.center,
                style: AppTypography.bodySmall.copyWith(color: colors.ink3),
              ),
              const SizedBox(height: 24),
              if (_errorMessage case final message?) ...[
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(color: colors.danger),
                ),
                const SizedBox(height: 16),
              ],
              FilledButton.icon(
                onPressed: _isLoading ? null : _login,
                icon: _isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.key),
                label: const Text('パスキーでログイン'),
              ),
              const SizedBox(height: 24),
              Text(
                '招待コードをお持ちの方',
                style: AppTypography.bodySmall.copyWith(color: colors.ink3),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _inviteTokenController,
                decoration: const InputDecoration(
                  labelText: '招待コード（URLごと貼り付けても可）',
                  border: OutlineInputBorder(),
                ),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submitInviteToken(),
              ),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: _submitInviteToken,
                icon: const Icon(Icons.arrow_forward),
                label: const Text('招待コードで進む'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.go('/join'),
                child: const Text('招待コードをお持ちでない方はこちら'),
              ),
              TextButton(
                onPressed: () => context.go('/settings'),
                child: const Text('ログインせずに設定を見る'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
