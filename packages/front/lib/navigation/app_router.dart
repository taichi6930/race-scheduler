import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/application/auth_router_state.dart';
import '../auth/presentation/invite_register_screen.dart';
import '../auth/presentation/join_request_screen.dart';
import '../auth/presentation/login_screen.dart';
import '../design/breakpoints.dart';
import '../features/announcement/presentation/announcement_banner_listener.dart';
import '../features/favorites/application/favorite_ids_provider.dart';
import '../features/favorites/presentation/favorites_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/timeline/application/pending_race_deep_link_provider.dart';
import '../features/timeline/application/timeline_provider.dart';
import '../features/timeline/presentation/timeline_screen.dart';
import '../features/trip_groups/presentation/trip_group_detail_screen.dart';
import '../features/trip_groups/presentation/trip_groups_screen.dart';
import '../features/whats_new/presentation/whats_new_notice_listener.dart';
import '../features/whats_new/presentation/whats_new_screen.dart';
import 'not_found_screen.dart';

/// 3タブ（タイムライン／お気に入り／設定）のルート定義。
///
/// カレンダータブ（月グリッド表示）はKPLAYER-07（注目選手機能）により
/// タイムラインのデフォルトフィルタが「⭐お気に入り＋重賞」両方ONになった
/// ことで役割が重複したため廃止した（ユーザー判断）。
///
/// [StatefulShellRoute.indexedStack] で各タブの状態（スクロール位置等）を
/// 保持したままタブ切替する（technical-design.md §7）。
///
/// 旅程グループ（`/trip-groups`・`/trip-groups/:id`）・更新履歴（`/whats-new`）
/// は、5個目の常設タブにせず、シェルの外側（トップレベル）に単純な
/// `GoRoute` として追加する（design §4.3。設定画面からの導線1本のみを想定し、
/// ナビゲーション構造自体への影響を最小限に留める）。
final GoRouter appRouter = GoRouter(
  initialLocation: _AppDestination.timeline.path,
  // 存在しないパスへのアクセス時にgo_routerの技術的なデフォルトエラー
  // ページではなく、アプリのデザインに沿った画面を表示する（NAV-02）。
  errorBuilder: (context, state) => const NotFoundScreen(),
  // QWEB-04: ルート `/` に対応する GoRoute が無いと NotFoundScreen に落ちてしまう
  // （ブックマーク・裸のオリジン共有・push-sw.js の許可外URLフォールバック先が `/`
  // のいずれも404画面へ着地していた）。タイムラインへ誘導する。
  //
  // レース関連画面（タイムライン・お気に入り・旅程グループ）はログイン必須の
  // ままとし、レース情報を含まない設定・更新履歴は未ログインでも閲覧できる
  // よう公開した（ユーザー依頼、2026-08-21: 設定画面内の「管理画面」への
  // 導線に、パスキーログイン無しで辿り着けるようにするため）。セッションが
  // 無い状態でも `/login`・`/invite/:token`・`/join`・`/settings`・
  // `/whats-new` はそのまま表示し、それ以外はログイン画面へ誘導する。
  // 逆にログイン済みで`/login`等の認証オンボーディング画面に居る場合は
  // タイムラインへ誘導する。
  // [authRouterState] は `MyApp`（`app.dart`）が `sessionProvider` の変化の
  // たびに反映するブリッジで、[refreshListenable] 経由でこの `redirect` を
  // 再評価させる（`appRouter`はトップレベル定数のためRiverpodの`ref`を
  // 持てない。`AuthInterceptor`がDio側で同じ理由からプレーンフィールドで
  // 橋渡しするのと同じ設計、詳細は `auth_router_state.dart` 参照）。
  refreshListenable: authRouterState,
  redirect: (context, state) {
    if (state.uri.path == '/') return _AppDestination.timeline.path;

    final path = state.uri.path;
    final isAuthOnboardingRoute =
        path == '/login' || path == '/join' || path.startsWith('/invite/');
    final isPublicRoute =
        isAuthOnboardingRoute || path == '/settings' || path == '/whats-new';
    if (!authRouterState.isLoggedIn && !isPublicRoute) return '/login';
    // ログイン済みで認証オンボーディング画面（/login・/join・/invite/:token）
    // に居る場合はタイムラインへ誘導する。以前は`path == '/login'`のみを
    // 見ていたため、招待登録画面（/invite/:token）でパスキー登録が成功し
    // セッションが確立しても、URLが/invite/のままだとこの条件に一致せず、
    // 画面が遷移しないまま取り残される不具合があった（isAuthRouteの判定と
    // ここの判定がズレていたのが原因）。
    if (authRouterState.isLoggedIn && isAuthOnboardingRoute) {
      return _AppDestination.timeline.path;
    }
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/invite/:token',
      builder: (context, state) =>
          InviteRegisterScreen(inviteToken: state.pathParameters['token']!),
    ),
    GoRoute(
      path: '/join',
      builder: (context, state) => const JoinRequestScreen(),
    ),
    GoRoute(
      path: '/trip-groups',
      builder: (context, state) => const TripGroupsScreen(),
    ),
    GoRoute(
      path: '/trip-groups/:id',
      builder: (context, state) =>
          TripGroupDetailScreen(groupId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/whats-new',
      builder: (context, state) => const WhatsNewScreen(),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          AppShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: _AppDestination.timeline.path,
              builder: (context, state) => _TimelineRouteEntry(
                initialDate: _parseDateQueryParam(
                  state.uri.queryParameters['date'],
                ),
                initialRaceId: state.uri.queryParameters['raceId'],
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: _AppDestination.favorites.path,
              builder: (context, state) => const FavoritesScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: _AppDestination.settings.path,
              builder: (context, state) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),
  ],
);

/// `/timeline?date=YYYY-MM-DD` の `date` クエリパラメータを解釈する
/// （QNTF-07）。不正・未指定の場合は null（既定＝今日のまま）。
DateTime? _parseDateQueryParam(String? value) {
  if (value == null) return null;
  return DateTime.tryParse(value);
}

/// `/timeline` ルートのエントリ。[initialDate] が指定されている場合、
/// マウント時（および同一ブランチに留まったまま date だけが変わる
/// 再遷移時）に [timelineDateProvider] へ反映する（QNTF-07:
/// 通知タップ時に対象レースの日付へ着地させるため）。[initialRaceId] が
/// 指定されている場合は[pendingRaceDeepLinkProvider]へ渡し、
/// [TimelineScreen]がその日のレース一覧読み込み後に該当レースの詳細を
/// 開く（通知タップでレース詳細まで開けるようにする）。
///
/// [TimelineScreen] 自体には手を入れず、日付反映というルーティング関心事を
/// ここに閉じ込める（`StatefulShellRoute.indexedStack` によりタブの状態は
/// 保持されるため、[initState] は最初のマウント時にしか呼ばれない。
/// 同じブランチに留まったまま date だけが変わる再遷移は
/// [didUpdateWidget] で拾う）。
class _TimelineRouteEntry extends ConsumerStatefulWidget {
  const _TimelineRouteEntry({this.initialDate, this.initialRaceId});

  final DateTime? initialDate;
  final String? initialRaceId;

  @override
  ConsumerState<_TimelineRouteEntry> createState() =>
      _TimelineRouteEntryState();
}

class _TimelineRouteEntryState extends ConsumerState<_TimelineRouteEntry> {
  @override
  void initState() {
    super.initState();
    _applyInitialDateIfPresent(widget.initialDate);
    _applyInitialRaceIdIfPresent(widget.initialRaceId);
  }

  @override
  void didUpdateWidget(covariant _TimelineRouteEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialDate != oldWidget.initialDate) {
      _applyInitialDateIfPresent(widget.initialDate);
    }
    if (widget.initialRaceId != oldWidget.initialRaceId) {
      _applyInitialRaceIdIfPresent(widget.initialRaceId);
    }
  }

  void _applyInitialDateIfPresent(DateTime? date) {
    if (date == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(timelineDateProvider.notifier).setDate(date);
    });
  }

  void _applyInitialRaceIdIfPresent(String? raceId) {
    if (raceId == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(pendingRaceDeepLinkProvider.notifier).request(raceId);
    });
  }

  @override
  Widget build(BuildContext context) => const TimelineScreen();
}

enum _AppDestination {
  timeline(
    '/timeline',
    'タイムライン',
    Icons.view_agenda_outlined,
    Icons.view_agenda,
  ),
  favorites('/favorites', 'お気に入り', Icons.star_border, Icons.star),
  settings('/settings', '設定', Icons.settings_outlined, Icons.settings);

  const _AppDestination(this.path, this.label, this.icon, this.selectedIcon);

  final String path;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

/// 下部ナビゲーション（モバイル幅）／サイドレール（広画面幅）を
/// [AppBreakpoints] で切り替えるシェル（screens.md §0）。
class AppShell extends ConsumerWidget {
  const AppShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  /// PERF-132: `_AppDestination.values` は enum 由来で不変のため、
  /// build毎（画面サイズ変化・タブ切替毎）に `.map().toList()` で再構築せず
  /// 一度だけ構築して使い回す。お気に入りタブのバッジ（QINF-05）だけは
  /// 件数に応じて変わるため、こちらは非staticにして毎buildで組み直す。
  static final List<NavigationRailDestination> _railDestinations =
      _AppDestination.values
          .map(
            (d) => NavigationRailDestination(
              icon: Icon(d.icon),
              selectedIcon: Icon(d.selectedIcon),
              label: Text(d.label),
            ),
          )
          .toList();

  static final List<NavigationDestination> _barDestinations = _AppDestination
      .values
      .map(
        (d) => NavigationDestination(
          icon: Icon(d.icon),
          selectedIcon: Icon(d.selectedIcon),
          label: d.label,
        ),
      )
      .toList();

  /// [_railDestinations]/[_barDestinations] のうち「お気に入り」タブだけを
  /// 件数バッジ付きのものへ差し替える（QINF-05: お気に入り件数は
  /// お気に入り画面のAppBarにしか出ておらず、他タブにいる間は分からなかった）。
  List<NavigationRailDestination> _railDestinationsWithBadge(int count) => [
    for (var i = 0; i < _railDestinations.length; i++)
      if (i == _AppDestination.favorites.index)
        NavigationRailDestination(
          icon: _FavoritesBadgeIcon(
            icon: Icon(_AppDestination.favorites.icon),
            count: count,
          ),
          selectedIcon: _FavoritesBadgeIcon(
            icon: Icon(_AppDestination.favorites.selectedIcon),
            count: count,
          ),
          label: Text(_AppDestination.favorites.label),
        )
      else
        _railDestinations[i],
  ];

  List<NavigationDestination> _barDestinationsWithBadge(int count) => [
    for (var i = 0; i < _barDestinations.length; i++)
      if (i == _AppDestination.favorites.index)
        NavigationDestination(
          icon: _FavoritesBadgeIcon(
            icon: Icon(_AppDestination.favorites.icon),
            count: count,
          ),
          selectedIcon: _FavoritesBadgeIcon(
            icon: Icon(_AppDestination.favorites.selectedIcon),
            count: count,
          ),
          label: _AppDestination.favorites.label,
        )
      else
        _barDestinations[i],
  ];

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  /// タブ切替のキーボードショートカット（QWEB-06）。デスクトップWebでの
  /// 回遊を速くするため、Ctrl+数字で `_AppDestination` の該当タブへ直接切り替える。
  static const _digitKeys = [
    LogicalKeyboardKey.digit1,
    LogicalKeyboardKey.digit2,
    LogicalKeyboardKey.digit3,
    LogicalKeyboardKey.digit4,
    LogicalKeyboardKey.digit5,
    LogicalKeyboardKey.digit6,
    LogicalKeyboardKey.digit7,
    LogicalKeyboardKey.digit8,
    LogicalKeyboardKey.digit9,
  ];

  Map<ShortcutActivator, VoidCallback> _tabShortcuts() => {
    for (
      var i = 0;
      i < _AppDestination.values.length && i < _digitKeys.length;
      i++
    )
      SingleActivator(_digitKeys[i], control: true): () =>
          _onDestinationSelected(i),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favoriteCount = ref.watch(
      favoriteIdsProvider.select((async) => async.value?.length ?? 0),
    );
    // 新バージョンのお知らせ（FR-04）・Server-Driven UI PoCのお知らせバナーは、
    // 常設タブのシェル全体に1度だけ組み込む（詳細はそれぞれの
    // ドキュメントコメント参照）。両者は独立した仕組みのため入れ子にする。
    return CallbackShortcuts(
      bindings: _tabShortcuts(),
      child: Focus(
        autofocus: true,
        child: AnnouncementBannerListener(
          child: WhatsNewNoticeListener(
            child: LayoutBuilder(
              builder: (context, constraints) {
                if (AppBreakpoints.isWide(constraints.maxWidth)) {
                  return Scaffold(
                    body: Row(
                      children: [
                        NavigationRail(
                          selectedIndex: navigationShell.currentIndex,
                          onDestinationSelected: _onDestinationSelected,
                          labelType: NavigationRailLabelType.all,
                          destinations: _railDestinationsWithBadge(
                            favoriteCount,
                          ),
                        ),
                        const VerticalDivider(width: 1),
                        Expanded(child: navigationShell),
                      ],
                    ),
                  );
                }

                return Scaffold(
                  body: navigationShell,
                  bottomNavigationBar: NavigationBar(
                    selectedIndex: navigationShell.currentIndex,
                    onDestinationSelected: _onDestinationSelected,
                    destinations: _barDestinationsWithBadge(favoriteCount),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// お気に入り件数を右上のバッジで示すアイコン（QINF-05）。0件のときはバッジを
/// 出さない。塗り+角丸の独自実装ではなくFlutter標準の`Badge`ウィジェットを
/// そのまま使う（front-design-layers.mdのAtomic Design対象外＝atomsに
/// 分離する必要はない）。
class _FavoritesBadgeIcon extends StatelessWidget {
  const _FavoritesBadgeIcon({required this.icon, required this.count});

  final Icon icon;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: count > 0,
      label: Text(count > 99 ? '99+' : '$count'),
      child: icon,
    );
  }
}
