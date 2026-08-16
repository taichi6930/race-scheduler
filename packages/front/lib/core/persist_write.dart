import 'package:flutter/foundation.dart';

/// [write]（永続化ストレージへの書き込み）を実行し、成功したかどうかを返す。
///
/// 呼び出し側の Notifier は UI へ即座に反映するため [state] の更新を待たずに
/// 永続化する設計を想定しており、本関数自体は待つ・待たないを強制しない
/// （呼び出し側が結果を使わない場合は `unawaited` で明示する）。ただし例外を
/// 無視すると、書き込み失敗（ディスク容量不足等）が誰にも気づかれずに
/// 握りつぶされてしまうため、必ず [onError]（既定はログ出力）で処理したうえで
/// 失敗を `false` として返す（PERF-107、FEDGE-04: 結果を待って失敗時にUIへ
/// エラー表示できるようにする）。
Future<bool> persistWrite(
  Future<bool> Function() write, {
  void Function(Object error, StackTrace stackTrace)? onError,
}) {
  return write().catchError((Object error, StackTrace stackTrace) {
    (onError ?? _logPersistFailure)(error, stackTrace);
    return false;
  });
}

void _logPersistFailure(Object error, StackTrace stackTrace) {
  debugPrint('persistWrite: 永続化に失敗しました: $error');
}
