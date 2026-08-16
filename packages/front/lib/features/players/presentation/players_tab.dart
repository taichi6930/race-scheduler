import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/atoms/discipline_icon.dart';
import '../../../design/atoms/pill.dart';
import '../../../design/molecules/empty_state.dart';
import '../../../design/molecules/error_retry_card.dart';
import '../../../design/molecules/loading_skeleton_list.dart';
import '../../../domain/entities/player_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../application/player_search_provider.dart';
import '../application/watched_players_provider.dart';

/// 選手検索・注目選手登録画面（お気に入りタブの「選手」サブタブ、KPLAYER-07）。
///
/// 検索語が空の間は登録済みの注目選手一覧を表示し、検索語を入力すると
/// 検索結果に切り替わる。どちらの一覧からもワンタップで注目状態を
/// 切り替えられる（Q10: 一覧画面・検索結果画面の両方で解除可能）。
class PlayersTab extends ConsumerStatefulWidget {
  const PlayersTab({super.key});

  @override
  ConsumerState<PlayersTab> createState() => _PlayersTabState();
}

/// 検索APIの呼び出しを間引くデバウンス時間（連続入力のたびにAPIを叩かない）。
const _searchDebounceDuration = Duration(milliseconds: 300);

/// 検索を実行する最小文字数（QSRCH-02）。
///
/// 1文字だけの入力でAPI検索を走らせると該当件数が多くなりすぎ、レスポンスも
/// 実用にならない量になるため、2文字以上をこの画面での検索実行条件とする。
const _minSearchQueryLength = 2;

class _PlayersTabState extends ConsumerState<PlayersTab> {
  final _controller = TextEditingController();
  Timer? _debounceTimer;

  /// クリアボタンの表示切替・「2文字以上入力してください」表示切替の判定に
  /// 使う入力状態の区分（0=空、1=1文字、2=2文字以上）。この区分が変わる
  /// ときだけ setState する（毎打鍵の setState は避ける、QSRCH-03）。
  int _lastInputCategory = 0;

  /// QSRCH-10: dispose()時点のデバウンス確定フラッシュに使うNotifier参照。
  /// `dispose()`内で`ref.read`を呼ぶとRiverpodが
  /// `Bad state: Using "ref" when a widget is about to or has been unmounted`
  /// を投げるため、まだ`ref`が安全に使える`initState()`のうちに読み取って
  /// フィールドへ保持しておく（flutter_riverpodが推奨する回避策）。
  late final PlayerSearchQueryNotifier _queryNotifier;

  static int _inputCategory(String value) {
    final length = value.trim().length;
    return length >= _minSearchQueryLength ? _minSearchQueryLength : length;
  }

  @override
  void initState() {
    super.initState();
    _queryNotifier = ref.read(playerSearchQueryProvider.notifier);
  }

  @override
  void dispose() {
    // QSRCH-10: デバウンス確定前（300ms未満）にこの画面を離れると、入力中の
    // 検索語がplayerSearchQueryProvider（Notifier、ウィジェット破棄後も
    // 生存）へ一度も反映されないままTimerだけがキャンセルされていた。
    // 画面へ戻るとTextEditingControllerは空で再生成される一方、providerは
    // 破棄前の（さらに古い）確定済みクエリを保持し続け、空の入力欄なのに
    // 古い検索結果が残るという食い違いが生じていた。保留中のデバウンスが
    // あれば、Timerコールバックと同じコミット処理をここで同期的に実行してから
    // 破棄する。
    if (_debounceTimer?.isActive ?? false) {
      _queryNotifier.setQuery(_controller.text);
    }
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    final category = _inputCategory(value);
    if (category != _lastInputCategory) {
      setState(() => _lastInputCategory = category);
    } else {
      _lastInputCategory = category;
    }

    _debounceTimer?.cancel();
    if (value.trim().length < _minSearchQueryLength) {
      // 2文字未満は検索を実行せず、確定済みクエリもクリアする
      // （直前の検索結果が残り続けるのを防ぐ）。
      ref.read(playerSearchQueryProvider.notifier).setQuery('');
      return;
    }
    _debounceTimer = Timer(_searchDebounceDuration, () {
      ref.read(playerSearchQueryProvider.notifier).setQuery(value);
    });
  }

  /// Enterキー（Web）・完了ボタン（モバイル）確定時、デバウンスを待たずに
  /// 即時検索してキーボードを閉じる（QSRCH-06）。2文字未満のときは検索しない
  /// （QSRCH-02、`_onChanged` と同じ最小文字数条件）。
  void _onSubmitted(String value) {
    _debounceTimer?.cancel();
    if (value.trim().length >= _minSearchQueryLength) {
      ref.read(playerSearchQueryProvider.notifier).setQuery(value);
    }
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final query = ref.watch(playerSearchQueryProvider);
    final isQueryTooShort = _inputCategory(_controller.text) == 1;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: TextField(
            controller: _controller,
            onChanged: _onChanged,
            onSubmitted: _onSubmitted,
            textInputAction: TextInputAction.search,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.none,
            decoration: InputDecoration(
              hintText: '選手名で検索（競輪・オートレース）',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: colors.surface2,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(11),
                borderSide: BorderSide.none,
              ),
              isDense: true,
              suffixIcon: _controller.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _controller.clear();
                        _debounceTimer?.cancel();
                        ref
                            .read(playerSearchQueryProvider.notifier)
                            .setQuery('');
                        setState(() => _lastInputCategory = 0);
                      },
                    ),
            ),
          ),
        ),
        Expanded(
          child: isQueryTooShort
              ? const _SearchQueryTooShortMessage()
              : query.trim().isEmpty
              ? const _WatchedPlayersList()
              : const _PlayerSearchResultsList(),
        ),
      ],
    );
  }
}

/// 登録済みの注目選手一覧（検索語が空のとき）。
class _WatchedPlayersList extends ConsumerWidget {
  const _WatchedPlayersList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playersAsync = ref.watch(watchedPlayersProvider);

    return playersAsync.when(
      data: (players) {
        if (players.isEmpty) {
          return const SingleChildScrollView(
            physics: AlwaysScrollableScrollPhysics(),
            child: EmptyState(
              icon: '🚲',
              message: '注目選手はまだ登録されていません。\n上の検索欄から選手を探して登録できます。',
            ),
          );
        }
        return ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
          itemCount: players.length,
          itemBuilder: (context, index) =>
              _PlayerRow(player: players[index], watched: true),
        );
      },
      loading: () => const LoadingSkeletonList(),
      error: (error, stack) => ErrorRetryCard(
        message: '注目選手の取得に失敗しました',
        onRetry: () => ref.invalidate(watchedPlayersProvider),
      ),
    );
  }
}

/// 検索語が1文字だけのときに表示する案内（QSRCH-02）。
class _SearchQueryTooShortMessage extends StatelessWidget {
  const _SearchQueryTooShortMessage();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: AlwaysScrollableScrollPhysics(),
      child: EmptyState(icon: '⌨️', message: '2文字以上入力してください。'),
    );
  }
}

/// 選手検索結果一覧（検索語が2文字以上入力されているとき）。
class _PlayerSearchResultsList extends ConsumerWidget {
  const _PlayerSearchResultsList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final resultsAsync = ref.watch(playerSearchResultsProvider);

    return resultsAsync.when(
      data: (players) {
        if (players.isEmpty) {
          return const SingleChildScrollView(
            physics: AlwaysScrollableScrollPhysics(),
            child: EmptyState(
              icon: '🔍',
              message: '該当する選手が見つかりませんでした。\n検索対象は競輪・オートレースの選手です。',
            ),
          );
        }
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  '${players.length}件',
                  style: AppTypography.tabular(
                    AppTypography.caption,
                  ).copyWith(color: colors.ink3),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
                itemCount: players.length,
                itemBuilder: (context, index) => _PlayerRow(
                  player: players[index],
                  watched: players[index].priority > 0,
                ),
              ),
            ),
          ],
        );
      },
      loading: () => const LoadingSkeletonList(),
      error: (error, stack) => ErrorRetryCard(
        message: '選手の検索に失敗しました',
        onRetry: () => ref.invalidate(playerSearchResultsProvider),
      ),
    );
  }
}

/// 選手1名分の行（選手名・府県・期別・注目トグル）。
class _PlayerRow extends ConsumerStatefulWidget {
  const _PlayerRow({required this.player, required this.watched});

  final PlayerEntity player;
  final bool watched;

  @override
  ConsumerState<_PlayerRow> createState() => _PlayerRowState();
}

class _PlayerRowState extends ConsumerState<_PlayerRow> {
  bool _pending = false;

  Future<void> _toggle() async {
    setState(() => _pending = true);
    try {
      await togglePlayerWatch(
        ref,
        raceType: widget.player.raceType,
        playerNo: widget.player.playerNo,
        playerName: widget.player.playerName,
        watched: !widget.watched,
      );
    } catch (_) {
      // QSRCH-01: 失敗を無言にせず、既存のお気に入り★と同じ形でSnackBar表示する
      // （favorite_toggle_feedback.dart相当のフィードバック機構が選手側には
      // 無かった非対称の是正）。
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${widget.player.playerName}の注目設定の変更に失敗しました')),
        );
      }
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // 種目名を先頭に必ず含める（KEIRIN・AUTORACE横断検索により同姓同名の
    // 別選手が並びうるため、branch/termが両方無い場合でも一覧上で区別できるようにする）。
    final subLabelParts = [
      DisciplineIcon.labelFor(RaceType.fromValue(widget.player.raceType)),
      if (widget.player.branch != null && widget.player.branch!.isNotEmpty)
        widget.player.branch!,
      if (widget.player.term != null) '${widget.player.term}期',
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Pill(
        backgroundColor: colors.surface,
        borderRadius: 11,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.player.playerName,
                    style: AppTypography.bodySmall.copyWith(
                      color: colors.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (subLabelParts.isNotEmpty)
                    Text(
                      subLabelParts.join('・'),
                      style: AppTypography.caption.copyWith(color: colors.ink3),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Semantics(
              button: true,
              label: widget.watched ? '注目選手を解除' : '注目選手として登録',
              child: IconButton(
                onPressed: _pending ? null : _toggle,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                icon: _pending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
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
      ),
    );
  }
}
