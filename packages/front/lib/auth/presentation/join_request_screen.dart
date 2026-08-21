import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/molecules/empty_state.dart';
import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../application/session_provider.dart';
import '../data/auth_repository_impl.dart';
import '../data/webauthn_client/webauthn_client.dart';

/// 参加リクエストのポーリング間隔。承認は運用者が手動で行うため、数秒程度の
/// 遅延はUX上問題にならない一方、短すぎるとメインAPIへの負荷になる。
const _pollInterval = Duration(seconds: 3);

enum _Phase { form, waiting, rejected, registering, registrationFailed }

/// 招待コードなしの参加リクエスト画面（`/join`）。
///
/// ニックネームのみで参加をリクエストし、運用者がadmin画面で承認するまで
/// 承認状況をポーリングする。承認されると（`GET /auth/join-request/:id`が
/// `status: 'approved'`と`inviteToken`を返すと）、[InviteRegisterScreen]と
/// 同じ登録フロー（`/auth/register/options` → WebAuthnセレモニー →
/// `/auth/register/verify`）を自動的に開始する（パスキー自体はこの時点で
/// 初めて作られる。ponytail: 2箇所目の呼び出しのため`_RegisterForm`のような
/// 共通化はRule of Threeにより見送っている）。
class JoinRequestScreen extends ConsumerStatefulWidget {
  const JoinRequestScreen({super.key, WebauthnClient? webauthnClient})
    : _webauthnClient = webauthnClient;

  final WebauthnClient? _webauthnClient;

  @override
  ConsumerState<JoinRequestScreen> createState() => _JoinRequestScreenState();
}

class _JoinRequestScreenState extends ConsumerState<JoinRequestScreen> {
  late final WebauthnClient _webauthnClient =
      widget._webauthnClient ?? createWebauthnClient();
  final _nicknameController = TextEditingController();

  _Phase _phase = _Phase.form;
  String? _errorMessage;
  String? _requestId;
  String? _inviteToken;
  Timer? _pollTimer;

  @override
  void dispose() {
    _pollTimer?.cancel();
    _nicknameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      setState(() => _errorMessage = 'ニックネームを入力してください');
      return;
    }

    setState(() => _errorMessage = null);
    try {
      final requestId = await ref
          .read(authRepositoryProvider)
          .requestJoin(nickname);
      if (!mounted) return;
      setState(() {
        _requestId = requestId;
        _phase = _Phase.waiting;
      });
      _pollTimer = Timer.periodic(_pollInterval, (_) => _poll());
    } on Exception {
      setState(() => _errorMessage = 'リクエストの送信に失敗しました。時間をおいて再度お試しください');
    }
  }

  Future<void> _poll() async {
    final requestId = _requestId;
    if (requestId == null) return;
    try {
      final status = await ref
          .read(authRepositoryProvider)
          .fetchJoinRequestStatus(requestId);
      if (!mounted || status.status == 'pending') return;

      _pollTimer?.cancel();
      if (status.status == 'rejected') {
        setState(() => _phase = _Phase.rejected);
        return;
      }
      final inviteToken = status.inviteToken;
      if (inviteToken == null) return;
      setState(() {
        _inviteToken = inviteToken;
        _phase = _Phase.registering;
      });
      await _registerWithApprovedInvite(inviteToken);
    } on Exception {
      // 通信の一時的な失敗はポーリングを止めず、次のTickで再試行する。
    }
  }

  Future<void> _registerWithApprovedInvite(String inviteToken) async {
    try {
      final repository = ref.read(authRepositoryProvider);
      final challenge = await repository.fetchRegisterOptions(inviteToken);
      final credentialResponse = challenge == null
          ? null
          : await _webauthnClient.register(challenge.options);
      final session = challenge == null || credentialResponse == null
          ? null
          : await repository.verifyRegister(
              challengeId: challenge.challengeId,
              nickname: _nicknameController.text.trim(),
              credentialResponse: credentialResponse,
            );
      if (session == null) {
        if (mounted) setState(() => _phase = _Phase.registrationFailed);
        return;
      }
      await ref.read(sessionProvider.notifier).save(session);
    } on Exception {
      if (mounted) setState(() => _phase = _Phase.registrationFailed);
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
          '参加をリクエスト',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
      ),
      body: switch (_phase) {
        _Phase.form => _JoinRequestForm(
          controller: _nicknameController,
          errorMessage: _errorMessage,
          onSubmit: _submit,
        ),
        _Phase.waiting || _Phase.registering => const EmptyState(
          icon: '⏳',
          message: '運用者の承認をお待ちください。承認されると自動的に登録を続行します',
        ),
        _Phase.rejected => const EmptyState(
          icon: '🚫',
          message: '参加リクエストは却下されました',
        ),
        _Phase.registrationFailed => EmptyState(
          icon: '⚠️',
          message: '登録に失敗しました',
          action: FilledButton(
            onPressed: () {
              final inviteToken = _inviteToken;
              if (inviteToken == null) return;
              setState(() => _phase = _Phase.registering);
              unawaited(_registerWithApprovedInvite(inviteToken));
            },
            child: const Text('パスキー登録をやり直す'),
          ),
        ),
      },
    );
  }
}

class _JoinRequestForm extends StatelessWidget {
  const _JoinRequestForm({
    required this.controller,
    required this.errorMessage,
    required this.onSubmit,
  });

  final TextEditingController controller;
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
              'ニックネームを入力してリクエストすると、運用者の承認後に自動的にパスキー登録へ進みます',
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
              onSubmitted: (_) => onSubmit(),
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
              onPressed: onSubmit,
              icon: const Icon(Icons.send),
              label: const Text('リクエストを送信'),
            ),
          ],
        ),
      ),
    );
  }
}
