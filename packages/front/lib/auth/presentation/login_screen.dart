import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../data/auth_repository_impl.dart';
import '../data/webauthn_client/webauthn_client.dart';
import '../application/session_provider.dart';

/// ログイン画面（パスキー1つでログインするシンプルな画面）。
///
/// セッションが無い状態で他画面へアクセスすると`appRouter`の`redirect`から
/// ここへ誘導される（`lib/navigation/app_router.dart`）。ログイン成功後は
/// [sessionProvider] の更新をトリガーに、同じ`redirect`がタイムラインへ
/// 自動的に戻すため、この画面から明示的な画面遷移は行わない。
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

  bool _isLoading = false;
  String? _errorMessage;

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
            ],
          ),
        ),
      ),
    );
  }
}
