import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/molecules/empty_state.dart';
import '../../design/molecules/loading_skeleton_list.dart';
import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../data/auth_repository_impl.dart';
import '../data/webauthn_client/webauthn_client.dart';
import '../application/session_provider.dart';

/// 招待受け取り→パスキー登録画面（`/invite/:token`）。
///
/// 開いたら`POST /auth/invite/verify`で招待の有効性を確認し、有効な場合のみ
/// ニックネーム入力→パスキー登録のフォームを表示する。登録成功後は
/// [sessionProvider] の更新をトリガーに、`appRouter`の`redirect`が
/// タイムラインへ自動的に遷移させる。
class InviteRegisterScreen extends ConsumerStatefulWidget {
  const InviteRegisterScreen({
    required this.inviteToken,
    super.key,
    WebauthnClient? webauthnClient,
  }) : _webauthnClient = webauthnClient;

  final String inviteToken;
  final WebauthnClient? _webauthnClient;

  @override
  ConsumerState<InviteRegisterScreen> createState() =>
      _InviteRegisterScreenState();
}

class _InviteRegisterScreenState extends ConsumerState<InviteRegisterScreen> {
  late final WebauthnClient _webauthnClient =
      widget._webauthnClient ?? createWebauthnClient();
  final _nicknameController = TextEditingController();

  late final Future<bool> _inviteValidFuture = ref
      .read(authRepositoryProvider)
      .verifyInvite(widget.inviteToken);

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nicknameController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      setState(() => _errorMessage = 'ニックネームを入力してください');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repository = ref.read(authRepositoryProvider);
      final challenge = await repository.fetchRegisterOptions(
        widget.inviteToken,
      );
      if (challenge == null) {
        setState(() => _errorMessage = '招待が無効です');
        return;
      }

      final credentialResponse = await _webauthnClient.register(
        challenge.options,
      );
      if (credentialResponse == null) {
        setState(() => _errorMessage = '登録がキャンセルされました');
        return;
      }

      final session = await repository.verifyRegister(
        challengeId: challenge.challengeId,
        nickname: nickname,
        credentialResponse: credentialResponse,
      );
      if (session == null) {
        setState(() => _errorMessage = '登録に失敗しました');
        return;
      }

      await ref.read(sessionProvider.notifier).save(session);
    } on Exception {
      setState(() => _errorMessage = '登録に失敗しました。時間をおいて再度お試しください');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          'パスキー登録',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
      ),
      body: FutureBuilder<bool>(
        future: _inviteValidFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData && !snapshot.hasError) {
            return const LoadingSkeletonList();
          }
          if (snapshot.hasError || snapshot.data == false) {
            return const EmptyState(icon: '🔒', message: '招待が無効です');
          }
          return _RegisterForm(
            controller: _nicknameController,
            isSubmitting: _isSubmitting,
            errorMessage: _errorMessage,
            onSubmit: _register,
          );
        },
      ),
    );
  }
}

class _RegisterForm extends StatelessWidget {
  const _RegisterForm({
    required this.controller,
    required this.isSubmitting,
    required this.errorMessage,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool isSubmitting;
  final String? errorMessage;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'ニックネームを入力し、この端末にパスキーを登録してください',
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(color: colors.ink3),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'ニックネーム',
                border: OutlineInputBorder(),
              ),
              textInputAction: TextInputAction.done,
              onSubmitted: (_) {
                if (!isSubmitting) onSubmit();
              },
            ),
            if (errorMessage case final message?) ...[
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(color: colors.danger),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: isSubmitting ? null : onSubmit,
              icon: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.key),
              label: const Text('パスキーを登録'),
            ),
          ],
        ),
      ),
    );
  }
}
