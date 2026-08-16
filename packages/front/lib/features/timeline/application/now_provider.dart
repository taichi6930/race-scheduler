import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/jst_time.dart';

/// 現在時刻（日本時間）を30秒間隔で流す（NOWディバイダの位置・行の
/// 「あとN分」表示用）。
///
/// 秒単位の精度が必要な Next Race カードのライブカウントダウンは、
/// 画面全体の再描画を避けるため自身の `Timer` で個別に管理する
/// （[NextRaceCard] 参照）。参照されなくなると自動的に停止する。
final nowProvider = StreamProvider.autoDispose<DateTime>((ref) async* {
  yield jstNow();
  yield* Stream.periodic(const Duration(seconds: 30), (_) => jstNow());
});
