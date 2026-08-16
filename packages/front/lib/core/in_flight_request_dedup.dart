/// 同一キーの並行リクエストを共有し、重複実行を防ぐ（PERF-010/PERF-124）。
///
/// 連打・並行画面遷移で同一パラメータのHTTPリクエストが複数回発火しうる箇所
/// （`*RemoteDataSource`の一覧取得系メソッド）向けの共通ヘルパー。進行中
/// （in-flight）の[run]が同じキーで既に存在する場合は新たなリクエストを
/// 発火せず、進行中のFutureを待ち合わせて結果を共有する。完了（成功/失敗
/// 問わず）すると該当キーは自動的に解放され、次回呼び出しは新規リクエストと
/// なる。
class InFlightRequestDedup<K> {
  final Map<K, Future<dynamic>> _inFlight = {};

  /// [key]に対応する進行中のリクエストがあればそれを共有し、無ければ
  /// [request]を実行して進行中リクエストとして登録する。
  Future<T> run<T>(K key, Future<T> Function() request) {
    final existing = _inFlight[key];
    if (existing != null) {
      return existing.then((value) => value as T);
    }

    final future = request();
    _inFlight[key] = future;
    // 後始末（進行中マップからの解放）を成功/失敗どちらでも行う。
    // then(onValue, onError:) で明示的にエラーを処理することで、後始末用に
    // 作られる派生Futureが「未処理の例外」としてzoneへ報告されるのを防ぐ
    // （onErrorで処理済み扱いになる）。
    // 注意: コールバックは必ずブロック文（`{ ... }`）でvoidを返すこと。
    // `Map.remove()` の戻り値（削除された値＝このFuture自体）を式本体
    // （`=>`）でそのまま返すと、Dartの`then()`がそれを「chainすべき
    // 新たなFuture」と解釈し、同じエラーを再度subscribeして未処理エラー
    // として報告してしまう（実際に踏んだ罠）。
    future.then(
      (_) {
        _inFlight.remove(key);
      },
      onError: (Object _, StackTrace _) {
        _inFlight.remove(key);
      },
    );
    return future;
  }
}
