import 'dart:async';

import 'package:flutter/widgets.dart'
    show AppLifecycleListener, AppLifecycleState;
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// APIレスポンスをキャッシュするプロバイダ全般に適用する既定のTTL（有効期限）。
///
/// この時間が経過すると自動的に再取得（APIへの再フェッチ）が走る。手動で
/// 最新化したい場合は各画面の更新ボタン・pull-to-refreshで即時に無効化できる。
const defaultCacheTtl = Duration(minutes: 15);

DateTime? _pausedAt;

/// アプリが非表示（バックグラウンド等）→ [AppLifecycleState.resumed] へ復帰した
/// タイミングで、直前の非表示時間を通知するストリーム（QLIFE-01）。
///
/// [Timer] ベースのTTL失効（本ファイル下部の [scheduleTtlInvalidate]）だけでは、
/// モバイルでアプリが停止中はタイマー自体が動かず、ブラウザのバックグラウンド
/// タブでも間引かれる。そのため「朝スマホを開くと昨夜の一覧のまま」という
/// 鮮度の穴が生まれる。復帰イベント自体を別経路で捕捉し、非表示時間がTTLを
/// 超えていれば再取得を促す。
final _resumedAfterBackground = StreamController<Duration>.broadcast();

AppLifecycleListener? _lifecycleListener;

/// [_lifecycleListener] を（アプリ全体で一度だけ）起動する。
///
/// [scheduleTtlInvalidate] の初回呼び出し時に遅延初期化する。TTLを使う
/// プロバイダが1つも無ければ購読先も無いため、生成コスト自体は無害。
void _ensureLifecycleListenerStarted() {
  _lifecycleListener ??= AppLifecycleListener(
    onStateChange: (state) {
      switch (state) {
        case AppLifecycleState.resumed:
          final pausedAt = _pausedAt;
          _pausedAt = null;
          if (pausedAt != null) {
            _resumedAfterBackground.add(DateTime.now().difference(pausedAt));
          }
          break;
        case AppLifecycleState.inactive:
        case AppLifecycleState.hidden:
        case AppLifecycleState.paused:
          // 複数回連続で非表示系の状態を経由する場合があるため、最初の
          // 非表示時刻だけを記録する（上書きしない）。
          _pausedAt ??= DateTime.now();
          break;
        case AppLifecycleState.detached:
          // 何もしない（アプリ終了間際の状態のため、再取得の判定対象外）。
          break;
      }
    },
  );
}

/// 非表示だった時間 [backgroundDuration] が [ttl] 以上であれば、復帰時に
/// 再取得すべきと判定する（QLIFE-01の判定ロジック本体。純粋関数として
/// 切り出し、実際のアプリライフサイクルをモックせず直接テストできるようにする）。
bool shouldInvalidateOnResume(Duration backgroundDuration, Duration ttl) =>
    backgroundDuration >= ttl;

/// [ttl] 経過後にプロバイダ自身を無効化し、次に参照された際の再取得を促す。
///
/// `FutureProvider`/`FutureProvider.family` の build 内から呼び出すことで、
/// 「一定時間はキャッシュを再利用しつつ、期限切れ後は自動で最新化する」という
/// TTLベースのキャッシュ失効を実現する。build が再実行されるたびにタイマーは
/// 張り直され、プロバイダが破棄される際は [Ref.onDispose] でタイマーを解放する。
///
/// あわせて、非表示時間が [ttl] を超えた状態でアプリが前面に復帰した場合も
/// 無効化する（QLIFE-01）。バックグラウンド中は [Timer] が動作しない
/// 環境があるための保険。
void scheduleTtlInvalidate(Ref ref, Duration ttl) {
  _ensureLifecycleListenerStarted();

  final timer = Timer(ttl, ref.invalidateSelf);
  final subscription = _resumedAfterBackground.stream
      .where(
        (backgroundDuration) => shouldInvalidateOnResume(backgroundDuration, ttl),
      )
      .listen((_) => ref.invalidateSelf());

  ref.onDispose(() {
    timer.cancel();
    unawaited(subscription.cancel());
  });
}
