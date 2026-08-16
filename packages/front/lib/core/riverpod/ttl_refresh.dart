import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// APIレスポンスをキャッシュするプロバイダ全般に適用する既定のTTL（有効期限）。
///
/// この時間が経過すると自動的に再取得（APIへの再フェッチ）が走る。手動で
/// 最新化したい場合は各画面の更新ボタン・pull-to-refreshで即時に無効化できる。
const defaultCacheTtl = Duration(minutes: 15);

/// [ttl] 経過後にプロバイダ自身を無効化し、次に参照された際の再取得を促す。
///
/// `FutureProvider`/`FutureProvider.family` の build 内から呼び出すことで、
/// 「一定時間はキャッシュを再利用しつつ、期限切れ後は自動で最新化する」という
/// TTLベースのキャッシュ失効を実現する。build が再実行されるたびにタイマーは
/// 張り直され、プロバイダが破棄される際は [Ref.onDispose] でタイマーを解放する。
void scheduleTtlInvalidate(Ref ref, Duration ttl) {
  final timer = Timer(ttl, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}
