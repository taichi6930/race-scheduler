import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/application/session_provider.dart';
import '../../../core/app_version.dart';
import '../../../core/config/admin_config.dart';
import '../../../core/utils/external_link_launcher.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/organisms/settings_rows.dart';
import '../../../domain/entities/race_type.dart';
import '../../../notifications/application/notification_scheduler_provider.dart';
import '../../favorites/application/favorite_ids_provider.dart';
import '../application/settings_provider.dart';

const _themeModeOptions = [ThemeMode.system, ThemeMode.light, ThemeMode.dark];
const _themeModeLabels = ['自動', '明', '暗'];

/// 設定画面（screens.md §5）。6グループ（通知／表示／対象の公営競技／旅程グループ／データ管理／このアプリについて）。
/// QSET-07: グループへのジャンプ手段（タブバー等）の要否を検討済み。
/// 現在は6グループ×平均3-5項目の規模で、スクロール距離が許容範囲のため
/// ジャンプ手段は導入不要と判定した。グループが10個以上になった場合に再検討する。
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final isLoggedIn = ref.watch(sessionProvider) != null;

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          '設定',
          style: AppTypography.appBarDate.copyWith(color: colors.ink),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SettingsGroup(
            title: '通知',
            children: [
              SettingsToggleRow(
                icon: '🔔',
                title: '通知を受け取る',
                // QPRIV-02: ONにすると端末固有のプッシュ購読識別子がサーバーへ
                // 送信されることを明示する。
                subtitle: '発走前にプッシュ通知（ONにすると端末固有の識別子をサーバーに送信します）',
                value: settings.notificationsEnabled,
                onChanged: (value) => _onNotificationsEnabledChanged(
                  context,
                  ref,
                  notifier,
                  value,
                ),
              ),
              SettingsStepperRow(
                icon: '⏱',
                title: '通知タイミング',
                // QSET-02: 取りうる範囲・刻み幅をsubtitleに明示する。
                // QMOB-09: Androidはバッテリー消費を抑えるための
                // inexactAllowWhileIdle（正確なアラーム権限を要求しないための
                // 意図的な選択）により、設定値どおりに届かず数分遅れる場合が
                // あることを明示する。
                subtitle:
                    '発走の何分前に知らせるか（$kNotificationLeadMinutesMin〜'
                    '$kNotificationLeadMinutesMax分・$kNotificationLeadMinutesStep分刻み）。'
                    'Androidは電池消費を抑える都合上、数分遅れて届く場合があります',
                valueLabel: settings.notificationLeadMinutes == 0
                    ? '発走時'
                    : '${settings.notificationLeadMinutes}分前',
                // QSET-01: 上下限で該当ボタンを無効化する。
                // QSET-06: マスタートグルOFF時は配下ごと無効化する。
                onDecrement:
                    !settings.notificationsEnabled ||
                        settings.notificationLeadMinutes <=
                            kNotificationLeadMinutesMin
                    ? null
                    : notifier.decrementNotificationLeadMinutes,
                onIncrement:
                    !settings.notificationsEnabled ||
                        settings.notificationLeadMinutes >=
                            kNotificationLeadMinutesMax
                    ? null
                    : notifier.incrementNotificationLeadMinutes,
              ),
              SettingsToggleRow(
                icon: '🏆',
                title: '重賞を自動で通知',
                subtitle: 'GⅠ/SG/GPなどは登録不要',
                value: settings.autoNotifySpecifiedGrades,
                // QSET-06: マスタートグルOFF時は配下ごと無効化する。
                onChanged: !settings.notificationsEnabled
                    ? null
                    : (value) => _onToggleWithFeedback(
                        context,
                        '重賞を自動で通知',
                        value,
                        notifier.setAutoNotifySpecifiedGrades,
                      ),
              ),
              SettingsToggleRow(
                icon: '★',
                title: 'お気に入りを通知',
                subtitle: '登録したレースを対象に',
                value: settings.notifyFavorites,
                // QSET-06: マスタートグルOFF時は配下ごと無効化する。
                onChanged: !settings.notificationsEnabled
                    ? null
                    : (value) => _onToggleWithFeedback(
                        context,
                        'お気に入りを通知',
                        value,
                        notifier.setNotifyFavorites,
                      ),
              ),
              if (kIsWeb)
                SettingsActionRow(
                  icon: '📨',
                  title: 'テスト通知を送信',
                  subtitle: '通知がこの画面に届くか確認',
                  actionLabel: '送信',
                  // QSET-06: マスタートグルOFF時は配下ごと無効化する。
                  enabled: settings.notificationsEnabled,
                  onTap: () => _onSendTestNotification(context, ref),
                ),
            ],
          ),
          const SizedBox(height: 14),
          SettingsGroup(
            title: '表示',
            children: [
              SettingsSegmentRow(
                icon: '🎨',
                title: 'テーマ',
                options: _themeModeLabels,
                selectedIndex: _themeModeOptions.indexOf(settings.themeMode),
                onSelect: (index) =>
                    notifier.setThemeMode(_themeModeOptions[index]),
              ),
              // QCOPY-01: 「既定フィルタ」行は`timeline_filter_provider.dart`が
              // 永続化する前回条件を反映しない、常に「重賞のみ」固定の
              // ハードコードされた読み取り専用行だった（実態と異なる表示・
              // 操作不可）。実装するまで行ごと削除する。
              // QCOPY-02: 「Google カレンダー連携」はsubtitleが「準備中」なのに
              // トグルは操作可能で、settings_provider.dartのコメントが
              // 明記するとおりアプリ内のどこからも参照されない値のまま
              // 永続化・成功SnackBarまで出ていた。実装するまで操作不能にする。
              SettingsToggleRow(
                icon: '🗓',
                title: 'Google カレンダー連携',
                subtitle: '準備中',
                value: settings.googleCalendarSyncEnabled,
                onChanged: null,
              ),
            ],
          ),
          const SizedBox(height: 14),
          SettingsGroup(
            title: '対象の公営競技',
            children: [
              for (final discipline in Discipline.all)
                SettingsToggleRow(
                  icon: discipline.emoji,
                  title: discipline.label,
                  value: settings.enabledDisciplines.contains(discipline),
                  onChanged: (_) => notifier.toggleDiscipline(discipline),
                ),
            ],
          ),
          const SizedBox(height: 14),
          SettingsGroup(
            title: '旅程グループ',
            children: [
              SettingsStepperRow(
                icon: '📆',
                title: '連日の許容日数',
                subtitle:
                    '同一候補とみなす最大日数差'
                    '（$kTripToleranceDaysMin〜$kTripToleranceDaysMax日）',
                valueLabel: '${settings.tripToleranceDays}日',
                onDecrement: settings.tripToleranceDays <= kTripToleranceDaysMin
                    ? null
                    : notifier.decrementTripToleranceDays,
                onIncrement: settings.tripToleranceDays >= kTripToleranceDaysMax
                    ? null
                    : notifier.incrementTripToleranceDays,
              ),
              SettingsStepperRow(
                icon: '🔭',
                title: '検索対象期間',
                subtitle:
                    '今日から何日先まで探すか'
                    '（$kTripLookaheadDaysMin〜$kTripLookaheadDaysMax日・'
                    '$kTripLookaheadDaysStep日刻み）',
                valueLabel: '${settings.tripLookaheadDays}日',
                onDecrement: settings.tripLookaheadDays <= kTripLookaheadDaysMin
                    ? null
                    : notifier.decrementTripLookaheadDays,
                onIncrement: settings.tripLookaheadDays >= kTripLookaheadDaysMax
                    ? null
                    : notifier.incrementTripLookaheadDays,
              ),
              SettingsActionRow(
                icon: '🚃',
                title: '旅程グループ一覧',
                subtitle: '会場をセットで回る候補日を見る',
                actionLabel: '開く',
                onTap: () => context.push('/trip-groups'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SettingsGroup(
            title: 'データ管理',
            children: [
              SettingsActionRow(
                icon: '🔧',
                title: '管理画面',
                subtitle: '機能フラグ・バックフィル等の運用者向け設定を変更する',
                actionLabel: '開く',
                onTap: () =>
                    launchExternalUrl(Uri.parse('$adminBaseUrl/flags')),
              ),
              SettingsActionRow(
                icon: '↺',
                title: '設定をリセット',
                subtitle: 'この画面の項目を初期値に戻す（お気に入り・フィルタは対象外）',
                actionLabel: 'リセット',
                onTap: () => _onResetSettings(context, ref, notifier),
              ),
              SettingsActionRow(
                icon: '🗑',
                title: 'お気に入りをすべて削除',
                // お気に入りはアカウントに紐づくデータのため、未ログイン時は
                // 無効化する（設定画面自体は未ログインでも閲覧できるが、
                // このボタンだけは意味のある操作にならないため）。
                subtitle: isLoggedIn ? '登録済みのお気に入りレースを一括で削除する' : 'ログインすると使えます',
                actionLabel: '削除',
                enabled: isLoggedIn,
                onTap: () => _onClearAllFavorites(context, ref),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SettingsGroup(
            title: 'このアプリについて',
            children: [
              SettingsActionRow(
                icon: '🆕',
                title: '更新履歴',
                subtitle: '各バージョンの変更内容を見る',
                actionLabel: '開く',
                onTap: () => context.push('/whats-new'),
              ),
              SettingsValueRow(
                icon: 'ℹ️',
                title: 'バージョン',
                subtitle: '不具合報告時に添えてください（タップでコピー）',
                value: appVersion,
                onTap: () => _onCopyAppVersion(context),
              ),
              const _DisclaimerRow(),
            ],
          ),
        ],
      ),
    );
  }
}

/// 「このアプリについて」グループ末尾の免責表示（PUBGATE-02、QPRIV-03 +
/// QSHARE-13）。
///
/// 本アプリは各競技団体・公式サイトの非公式アプリであり、掲載レース情報は
/// 各競技の公式サイトを自動取得（スクレイピング）したものであること、
/// 正確性・最新性を保証しないこと、投票・来場前は公式サイトでの確認を促す旨を
/// 明示する（QPRIV-03）。データ出典の明記（QSHARE-13）は法的な注意喚起とは
/// 目的が異なるが、backlogの指示どおり同じ行内（1セクション）にまとめる。
class _DisclaimerRow extends StatelessWidget {
  const _DisclaimerRow();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = AppTypography.caption.copyWith(color: colors.ink3);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '本アプリは各競技団体・公式サイトが提供する非公式のアプリです。'
            '掲載しているレース情報は各競技の公式サイトを自動取得（スクレイピング）'
            'したものであり、正確性・最新性を保証するものではありません。'
            '投票・来場の前には、必ず公式サイトで最新情報をご確認ください。',
            style: style,
          ),
          const SizedBox(height: 6),
          Text('データ出典: JRA・地方競馬・競輪・オートレース・競艇の各主催者公式サイト', style: style),
        ],
      ),
    );
  }
}

/// 「通知を受け取る」トグルのユーザー操作を処理する。
///
/// Web でONにする場合はブラウザの通知許可要求（`Notification.requestPermission()`）
/// を伴うため、この関数自体がユーザー操作（タップ）起点で呼ばれる必要がある
/// （`ref.listen` 等からは呼べない）。許可結果に関わらずトグルの表示状態は
/// ユーザーの意図どおりに更新する（拒否時は `scheduleRaceNotification` が
/// no-op になるだけで、設定画面上は選択どおりに保つ）。
void _onNotificationsEnabledChanged(
  BuildContext context,
  WidgetRef ref,
  SettingsNotifier notifier,
  bool value,
) {
  // QNTF-11: Web限定（kIsWeb）だったため、モバイル（iOS）はこの操作起点
  // での許可要求が一切行われず、初期化時点の即時ダイアログ（対応済み）
  // 以外に許可を得る導線が無かった。プラットフォーム問わず呼ぶことで
  // Webと同じくユーザー操作起点の許可要求に揃える。
  if (value) {
    unawaited(ensureWebPushEnabled(ref));
  }
  _onToggleWithFeedback(
    context,
    '通知を受け取る',
    value,
    notifier.setNotificationsEnabled,
  );
}

/// 設定トグルの変更を反映したうえで、変更内容をSnackBarで確認できるようにする
/// （UX-039）。効果が画面上に他の形で即座に見えるトグル（テーマ・対象の
/// 公営競技等）は対象外とし、効果が背後で完結し目に見えにくいものにのみ使う。
///
/// [onChanged] の永続化結果（`Future<bool>`）を待ってから成功/失敗の
/// SnackBarを出し分ける。永続化に失敗した場合に成功したかのようなSnackBarを
/// 即時表示してしまうと、実際は保存されず次回起動時に黙って元に戻ることに
/// ユーザーが気づけないため（FEDGE-04）。
Future<void> _onToggleWithFeedback(
  BuildContext context,
  String label,
  bool value,
  Future<bool> Function(bool) onChanged,
) async {
  final messenger = ScaffoldMessenger.of(context);
  final succeeded = await onChanged(value);
  messenger.showSnackBar(
    SnackBar(
      content: Text(
        succeeded
            ? '$label を${value ? 'ON' : 'OFF'}にしました'
            : '$label の保存に失敗しました。もう一度お試しください',
      ),
      duration: Duration(seconds: succeeded ? 2 : 3),
    ),
  );
}

/// 「バージョン」行のタップ操作を処理する（QSUP-04）。
///
/// コミットSHA先頭7桁は手で書き写す必要があり不具合報告の摩擦になっていた
/// ため、タップでクリップボードへコピーしSnackBarで確認できるようにする。
Future<void> _onCopyAppVersion(BuildContext context) async {
  final messenger = ScaffoldMessenger.of(context);
  await Clipboard.setData(const ClipboardData(text: appVersion));
  messenger.showSnackBar(const SnackBar(content: Text('バージョンをコピーしました')));
}

/// 「テスト通知を送信」ボタンのユーザー操作を処理する（配信テスト機能）。
///
/// 通知許可要求を伴いうるためユーザー操作起点で呼ぶ。結果はSnackBarで通知する。
Future<void> _onSendTestNotification(
  BuildContext context,
  WidgetRef ref,
) async {
  final messenger = ScaffoldMessenger.of(context);
  final enabled = await ensureWebPushEnabled(ref);
  if (!enabled) {
    // QNTF-08: `Notification.requestPermission()` は一度 denied になると
    // 再要求しても即座に拒否されるため、アプリ内の再許可導線が無いと
    // ユーザーは自力で復旧できない。ブラウザ設定から再許可する手順を案内する。
    if (context.mounted) {
      await _showNotificationPermissionHelpDialog(context);
    }
    return;
  }

  final sent = await sendTestPushNotification(ref);
  messenger.showSnackBar(
    SnackBar(content: Text(sent ? 'テスト通知を送信しました' : 'テスト通知の送信に失敗しました')),
  );
}

/// 「設定をリセット」のユーザー操作を処理する（QSET-04）。
///
/// 誤タップで戻せない状態にならないよう確認ダイアログを挟み、実行後は
/// 成功/失敗をSnackBarで知らせる（他のトグルと同じFEDGE-04方針）。
Future<void> _onResetSettings(
  BuildContext context,
  WidgetRef ref,
  SettingsNotifier notifier,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('設定をリセットしますか？'),
      content: const Text(
        '通知・表示・対象の公営競技・旅程グループの設定が初期値に戻ります。'
        'お気に入りやタイムラインの絞り込みは対象外です。',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('キャンセル'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('リセット'),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.of(context);
  final succeeded = await notifier.resetToDefaults();
  messenger.showSnackBar(
    SnackBar(
      content: Text(succeeded ? '設定をリセットしました' : '設定のリセットに失敗しました。もう一度お試しください'),
    ),
  );
}

/// 「お気に入りをすべて削除」のユーザー操作を処理する（QPRIV-05）。
///
/// 誤タップで戻せない状態にならないよう確認ダイアログを挟む
/// （「設定をリセット」と同じ方針、意図的に対象外にしていたお気に入りの
/// 一括削除に別の導線を用意する）。
Future<void> _onClearAllFavorites(BuildContext context, WidgetRef ref) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('お気に入りをすべて削除しますか？'),
      content: const Text('登録済みのお気に入りレースが全て削除されます。この操作は取り消せません。'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('キャンセル'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('削除'),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  if (!context.mounted) return;

  ref.read(favoriteIdsProvider.notifier).clearAll();
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(const SnackBar(content: Text('お気に入りをすべて削除しました')));
}

/// 通知許可が得られなかった場合に、ブラウザ設定から再許可する手順を案内する。
Future<void> _showNotificationPermissionHelpDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('通知が許可されていません'),
      content: const Text(
        '一度ブラウザで通知を拒否すると、アプリからの再許可はできません。'
        'ブラウザのアドレスバー付近にあるサイト設定（鍵アイコン等）を開き、'
        '「通知」を「許可」に変更してからページを再読み込みしてください。',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('閉じる'),
        ),
      ],
    ),
  );
}
