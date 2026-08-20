import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/jst_time.dart';
import '../../../core/utils/external_link_launcher.dart';
import '../../../design/keirin_car_number_colors.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/atoms/discipline_icon.dart';
import '../../../design/atoms/grade_badge.dart';
import '../../../design/atoms/pill.dart';
import '../../../design/atoms/tappable_card.dart';
import '../../../design/atoms/unconfirmed_badge.dart';
import '../../../design/google_calendar_colors.dart';
import '../../../design/grade_color.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../domain/entities/race_detail_ui.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_link.dart';
import '../../../domain/entities/race_player_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../notifications/application/notification_scheduler_provider.dart';
import '../../favorites/application/favorite_ids_provider.dart';
import '../../players/application/watched_players_provider.dart';
import '../../settings/application/settings_provider.dart';
import '../application/calendar_event_url_provider.dart';
import '../application/race_detail_ui_provider.dart';

/// モバイル幅でレース詳細をボトムシート表示する（screens.md §4）。
/// 広画面での常駐パネル表示は [RaceDetailContent] を直接配置する
/// （`TimelineScreen` 参照）。
///
/// シートを開く直前にフォーカスされていた要素を記憶しておき、閉じた後に
/// フォーカスを復帰させる（A11Y-023）。`showModalBottomSheet` はこれを
/// 自動では行わないため、キーボード操作時にシートを閉じた後フォーカスが
/// どこにも無い状態になってしまうのを防ぐ。
///
/// 出走選手が多いレースはコンテンツが画面高さを超え、ドラッグ操作が中の
/// `SingleChildScrollView` のスクロールに吸われて下方向スワイプでは
/// 閉じられなくなる。`showDragHandle`（掴みやすいハンドル）に加え、
/// スクロール位置に関わらず確実に閉じられる✕ボタンをヘッダーへ表示する。
Future<void> showRaceDetailSheet(BuildContext context, RaceEntity race) async {
  final previousFocus = FocusManager.instance.primaryFocus;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        child: RaceDetailContent(
          race: race,
          onClose: () => Navigator.of(sheetContext).pop(),
        ),
      ),
    ),
  );

  if (previousFocus != null && previousFocus.canRequestFocus) {
    previousFocus.requestFocus();
  }
}

/// 発走時刻表示（`HH:mm`）用のフォーマッタ。`_DetailHeader`・`_DetailKvList`の
/// 両方から使うため、build毎の再生成を避けて共有する（PERF-117）。
final _timeFormat = DateFormat('HH:mm');

/// [raceType]・[time] から発走時刻の表示文字列を組み立てる。
///
/// QINF-03: すべての時刻表示はJST前提（`parseJstDateTime`）だが、
/// 海外競馬（[RaceType.overseas]）は現地時刻と誤読されうるため、
/// JST表記であることを明示する。
///
/// QINF-08: 発走「日付」を含まなかったため、お気に入り画面（発走前の
/// レースを日付をまたいで並べる）から開いた詳細で「何日のレースか」が
/// 分からなかった。`M/D` を先頭に付ける（KV一覧側の「発走」行はAPI由来
/// （`race_detail_ui_model.dart`）でフロント単独では変更できないため対象外）。
String _formatRaceTime(RaceType raceType, DateTime time) {
  final formatted = '${time.month}/${time.day} ${_timeFormat.format(time)}';
  return raceType == RaceType.overseas ? '$formatted（JST）' : formatted;
}

/// レース詳細の中身（ヘッダ・キーバリュー・アクション、screens.md §4）。
/// ボトムシート／常駐パネルの両方から再利用する。
class RaceDetailContent extends ConsumerWidget {
  const RaceDetailContent({required this.race, this.onClose, super.key});

  final RaceEntity race;

  /// ヘッダーに✕（閉じる）ボタンを表示する場合のコールバック。
  /// 広画面の常駐パネル表示（`TimelineScreen`）では「閉じる」概念が無いため
  /// nullのままとし、ボトムシート表示（[showRaceDetailSheet]）でのみ渡す。
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final raceType = RaceType.fromValue(race.raceType);
    // 対象raceIdの真偽値のみ購読する（PERF-116）。favoriteIdsProvider全体を
    // watchすると、別レースのお気に入り操作でもシート全体が再構築されてしまう。
    final isFavorite = ref.watch(
      favoriteIdsProvider.select(
        (async) => async.value?.contains(race.raceId) ?? false,
      ),
    );
    final time = parseJstDateTime(race.datetime);
    final condition = _buildCondition(race);

    // QWEB-03: Flutter Webの既定ではテキストがドラッグ選択できないため、
    // レース名・会場名等をコピーしたいという操作ができなかった。詳細シートは
    // タップ以外の複雑なジェスチャー（スワイプ等）を持たないため、
    // SelectionAreaで包んでも他の操作と競合しない。
    return SelectionArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailHeader(
            race: race,
            raceType: raceType,
            time: time,
            condition: condition,
            onClose: onClose,
          ),
          _RaceDetailSections(raceId: race.raceId, raceType: raceType),
          _DetailActions(race: race, isFavorite: isFavorite),
        ],
      ),
    );
  }
}

/// 発走条件（馬場種別・距離）の表示文字列を組み立てる。存在しなければ null。
String? _buildCondition(RaceEntity race) {
  final conditionParts = <String>[
    if (race.surfaceType != null && race.surfaceType!.isNotEmpty)
      race.surfaceType!,
    if (race.distance != null) '${race.distance}m',
  ];
  return conditionParts.isEmpty ? null : conditionParts.join(' ・ ');
}

/// レース詳細のヘッダ（アイコン・レース名・発走時刻/条件/グレードのチップ群）。
class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.race,
    required this.raceType,
    required this.time,
    required this.condition,
    this.onClose,
  });

  final RaceEntity race;
  final RaceType raceType;
  final DateTime time;
  final String? condition;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final colorKey = googleCalendarColorKeyOf(raceType, race.raceGrade);

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            GoogleCalendarPalette.background[colorKey]!.withValues(alpha: 0.14),
            colors.surface,
          ],
        ),
        border: Border(bottom: BorderSide(color: colors.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DisciplineIcon(raceType: raceType, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${DisciplineIcon.labelFor(raceType)} ・ ${race.raceCourse} ${race.raceNumber}R',
                  style: AppTypography.caption.copyWith(
                    color: colors.ink2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (onClose != null)
                Semantics(
                  button: true,
                  label: '閉じる',
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: onClose,
                    borderRadius: BorderRadius.circular(999),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(Icons.close, size: 20, color: colors.ink2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            race.raceName,
            style: AppTypography.sheetHeading.copyWith(color: colors.ink),
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _MetaChip(label: '${_formatRaceTime(raceType, time)} 発走'),
              if (condition != null) _MetaChip(label: condition!),
              GradeBadge(
                raceType: raceType,
                grade: race.raceGrade,
                raceStage: race.raceStage,
              ),
              if (race.isConfirmed == false) const UnconfirmedBadge(),
            ],
          ),
        ],
      ),
    );
  }
}

/// レース詳細のセクション群（KV一覧・外部リンク・出走選手ロスター）を
/// 1回のfetch（[raceDetailUiProvider]）でまとめて描画する
/// （race-detail-sdui-design.md）。表示内容（フィールドの選択・順序・
/// ラベル・注目選手トグルの可否）はAPI側で決まり、frontはセクション種別
/// ごとの見た目のみを担当する。未知のセクション種別は
/// [RaceDetailUiModel]（データ層）が読み飛ばし済みのため、ここでは
/// 3種類（kv/links/players）のみを扱う。
///
/// 取得中は詳細画面をブロックせず何も表示しない
/// （従来のraceLinksProvider/racePlayersProviderと同じ方針）。
///
/// QINF-04: 取得失敗時も従来は同様に何も表示せず、外部リンク（netkeiba等）が
/// 「このレースには無い」のか「今は取れなかった」のか区別できなかった。
/// KV一覧・出走選手ロスターも同じ1回のfetchで取得するため、この区別が
/// 必要なのはリンクセクションに限らない。失敗時は再試行できる形にする。
class _RaceDetailSections extends ConsumerWidget {
  const _RaceDetailSections({required this.raceId, required this.raceType});

  final String raceId;
  final RaceType raceType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncUi = ref.watch(raceDetailUiProvider(raceId));

    if (asyncUi.hasError) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: ErrorRetryCard(
          message: 'レース詳細の一部の取得に失敗しました',
          onRetry: () => ref.invalidate(raceDetailUiProvider(raceId)),
        ),
      );
    }

    final sections = asyncUi.value?.sections ?? const [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final section in sections)
          switch (section) {
            RaceDetailKvSection() => _KvSectionView(section: section),
            RaceDetailLinksSection() => _LinksSectionView(section: section),
            RaceDetailPlayersSection() => _PlayersSectionView(
              section: section,
              raceType: raceType,
            ),
          },
      ],
    );
  }
}

/// レース詳細のキーバリュー一覧（発走・競技・会場・レース番号・グレード・
/// ステージ・条件等）。行の内訳・順序・ラベルは[section]（API側で構成）に従う。
class _KvSectionView extends StatelessWidget {
  const _KvSectionView({required this.section});

  final RaceDetailKvSection section;

  @override
  Widget build(BuildContext context) {
    if (section.rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final row in section.rows)
            _KvRow(label: row.label, value: row.value),
        ],
      ),
    );
  }
}

/// レース詳細のアクション行（お気に入り＋通知／カレンダー追加）。
class _DetailActions extends ConsumerWidget {
  const _DetailActions({required this.race, required this.isFavorite});

  final RaceEntity race;
  final bool isFavorite;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // QCOPY-09: 通知は設定画面の値（0〜60分で変更可能）でスケジュールされる
    // （`_syncFavoriteNotifications`・`_scheduleAutoGradeNotifications`）ため、
    // 定数`kDefaultNotificationLeadMinutes`をそのまま表示すると、ユーザーが
    // 設定を変えても詳細シートの表示だけ既定値のまま乖離してしまう。
    final leadMinutes = ref.watch(
      settingsProvider.select((s) => s.notificationLeadMinutes),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
      child: Row(
        children: [
          Expanded(
            child: _ActionButton(
              label: isFavorite ? '★ 登録済み・$leadMinutes分前に通知' : '☆ お気に入り＋通知',
              semanticLabel: isFavorite
                  ? '登録済み、$leadMinutes分前に通知'
                  : 'お気に入り登録＋通知',
              primary: true,
              highlighted: isFavorite,
              onTap: () => _onToggleFavorite(ref, race, isFavorite),
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: _ActionButton(
              label: 'カレンダー追加',
              primary: false,
              onTap: () => _showCalendarProviderSheet(context, ref, race),
            ),
          ),
        ],
      ),
    );
  }
}

/// お気に入り（＋通知）のON/OFFを切り替える。
///
/// Web でONにする（お気に入りに追加する）操作は、このタップ自体が
/// ブラウザの通知許可要求（`Notification.requestPermission()`）に必要な
/// ユーザー操作起点となる。許可結果に関わらずお気に入り登録は行う
/// （拒否時は `scheduleRaceNotification` が no-op になるだけ）。
void _onToggleFavorite(WidgetRef ref, RaceEntity race, bool isFavorite) {
  // QNTF-11: Web限定だったため、モバイル（iOS）はお気に入り登録操作からの
  // 許可要求が行われていなかった。設定画面のトグルと同様プラットフォーム
  // 問わず呼ぶ。
  if (!isFavorite) {
    unawaited(ensureWebPushEnabled(ref));
  }
  ref.read(favoriteIdsProvider.notifier).toggle(race.raceId);
}

/// 「カレンダー追加」ボタンタップ時に、追加先カレンダーを選ぶボトムシートを表示する。
/// 現状はGoogleカレンダーのみ対応だが、将来的な追加先の拡張を見込んで
/// 選択肢形式のUIにしている。
Future<void> _showCalendarProviderSheet(
  BuildContext context,
  WidgetRef ref,
  RaceEntity race,
) {
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.event),
            title: const Text('Googleカレンダー'),
            onTap: () {
              Navigator.of(sheetContext).pop();
              unawaited(_addToGoogleCalendar(context, ref, race));
            },
          ),
        ],
      ),
    ),
  );
}

/// [race] の Google カレンダー予定追加URL（[calendarEventUrlProvider] が
/// データ取得・フォールバックまで解決済み）を外部ブラウザ/アプリで開く。
Future<void> _addToGoogleCalendar(
  BuildContext context,
  WidgetRef ref,
  RaceEntity race,
) async {
  final url = await ref.read(
    calendarEventUrlProvider(CalendarEventRaceKey(race)).future,
  );
  final opened = await launchExternalUrl(url);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('カレンダーを開けませんでした')));
  }
}

/// レースに関連する外部リンク（netkeiba出馬表・レース動画・YouTube公式配信等）を
/// ボタンで表示する（screens.md §4）。対応データが無い（AUTORACE/BOATRACE/
/// OVERSEAS）場合、[section] のitemsは空のため領域ごと非表示になる。
class _LinksSectionView extends StatelessWidget {
  const _LinksSectionView({required this.section});

  final RaceDetailLinksSection section;

  @override
  Widget build(BuildContext context) {
    if (section.items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final link in section.items)
            _LinkChip(link: link, onTap: () => _openRaceLink(context, link)),
        ],
      ),
    );
  }
}

/// 出走選手ロスター（車番・枠番の色・選手名・府県・期別）を表示する
/// （KPLAYER-07、screens.md未記載の追加要望）。対応データが無い場合、
/// [section] のplayersは空のため領域ごと非表示になる。
///
/// 各行に注目選手トグル（星）を表示する。表示要否（[RaceDetailPlayersSection.watchToggle]）
/// はAPI側で決まる（現状KEIRIN・AUTORACE限定。[watchedPlayersProvider]も同じ
/// 対象種目でAPIを呼ぶため、対象外のレース種別で誤った登録操作をできないようにする
/// 安全側ガード）。
class _PlayersSectionView extends ConsumerWidget {
  const _PlayersSectionView({required this.section, required this.raceType});

  final RaceDetailPlayersSection section;
  final RaceType raceType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final players = section.players;
    if (players.isEmpty) return const SizedBox.shrink();

    final showWatchToggle = section.watchToggle;
    final watchedPlayerNos = showWatchToggle
        ? ref
              .watch(watchedPlayersProvider)
              .value
              ?.map((player) => player.playerNo)
              .toSet()
        : null;

    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.title,
            style: AppTypography.bodySmall.copyWith(
              color: colors.ink3,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          for (final player in players)
            _RacePlayerRow(
              player: player,
              raceType: showWatchToggle ? raceType : null,
              watched: watchedPlayerNos?.contains(player.playerNo) ?? false,
            ),
        ],
      ),
    );
  }
}

/// 出走選手ロスターの1行（車番の色付きバッジ・選手名・府県/期別・注目トグル）。
///
/// [raceType]がnullの場合（注目選手機能の対象外レース種別）は星を表示しない。
class _RacePlayerRow extends ConsumerStatefulWidget {
  const _RacePlayerRow({
    required this.player,
    required this.raceType,
    required this.watched,
  });

  final RacePlayerEntity player;
  final RaceType? raceType;
  final bool watched;

  @override
  ConsumerState<_RacePlayerRow> createState() => _RacePlayerRowState();
}

class _RacePlayerRowState extends ConsumerState<_RacePlayerRow> {
  bool _pending = false;

  Future<void> _toggle() async {
    final raceType = widget.raceType;
    if (raceType == null) return;
    setState(() => _pending = true);
    try {
      await togglePlayerWatch(
        ref,
        raceType: raceType.value,
        playerNo: widget.player.playerNo,
        playerName: widget.player.playerName,
        watched: !widget.watched,
      );
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final carNumberColor =
        keirinCarNumberColors[widget.player.carNumber] ?? colors.surface2;
    final subLabelParts = [
      if (widget.player.branch != null && widget.player.branch!.isNotEmpty)
        widget.player.branch!,
      if (widget.player.term != null) '${widget.player.term}期',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: carNumberColor,
              shape: BoxShape.circle,
              border: Border.all(color: colors.line),
            ),
            child: Text(
              '${widget.player.carNumber}',
              style: AppTypography.tabular(AppTypography.caption).copyWith(
                color: keirinCarNumberLabelColorFor(widget.player.carNumber),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Row(
              children: [
                Text(
                  widget.player.playerName,
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (subLabelParts.isNotEmpty) ...[
                  const SizedBox(width: 6),
                  Text(
                    subLabelParts.join('・'),
                    style: AppTypography.caption.copyWith(color: colors.ink3),
                  ),
                ],
              ],
            ),
          ),
          if (widget.raceType != null)
            Semantics(
              button: true,
              label: widget.watched ? '注目選手を解除' : '注目選手として登録',
              child: IconButton(
                onPressed: _pending ? null : _toggle,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                icon: _pending
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : ExcludeSemantics(
                        child: Icon(
                          widget.watched ? Icons.star : Icons.star_border,
                          size: 20,
                          color: widget.watched ? colors.favorite : colors.ink3,
                        ),
                      ),
              ),
            ),
        ],
      ),
    );
  }
}

/// [link] を外部ブラウザ/アプリで開く。失敗時は [_addToGoogleCalendar] と
/// 同様にSnackBarで通知する。
Future<void> _openRaceLink(BuildContext context, RaceLink link) async {
  final opened = await launchExternalUrl(Uri.parse(link.url));
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('${link.label}を開けませんでした')));
  }
}

class _LinkChip extends StatelessWidget {
  const _LinkChip({required this.link, required this.onTap});

  final RaceLink link;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: link.label,
      excludeSemantics: true,
      onTap: onTap,
      child: TappableCard(
        borderRadius: 999,
        color: colors.surface2,
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.open_in_new, size: 13, color: colors.ink2),
            const SizedBox(width: 5),
            Text(
              link.label,
              style: AppTypography.caption.copyWith(
                color: colors.ink2,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pill(
      backgroundColor: colors.surface2,
      borderRadius: 7,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      child: Text(
        label,
        style: AppTypography.tabular(
          AppTypography.caption,
        ).copyWith(color: colors.ink2, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _KvRow extends StatelessWidget {
  const _KvRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(color: colors.ink3),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.tabular(
                AppTypography.bodySmall,
              ).copyWith(color: colors.ink, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.primary,
    required this.onTap,
    this.highlighted = false,
    this.semanticLabel,
  });

  final String label;
  final bool primary;
  final bool highlighted;
  final VoidCallback onTap;

  /// スクリーンリーダー向けの読み上げラベル。★/☆等の記号を含む[label]を
  /// そのまま読み上げると不安定なため、記号を含まないクリーンな文言を
  /// 明示的に指定できるようにする（省略時は[label]をそのまま使う、A11Y-028）。
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bg = primary
        ? (highlighted ? colors.favorite : colors.brand)
        : colors.surface;
    final fg = primary
        ? (highlighted ? colors.favoriteText : Colors.white)
        : colors.ink;
    return Semantics(
      button: true,
      label: semanticLabel ?? label,
      excludeSemantics: true,
      onTap: onTap,
      child: TappableCard(
        borderRadius: 11,
        color: bg,
        border: primary ? null : Border.all(color: colors.line2),
        onTap: onTap,
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.bodySmall.copyWith(
            color: fg,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
