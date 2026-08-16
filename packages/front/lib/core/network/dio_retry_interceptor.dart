import 'package:dio/dio.dart';

/// [RequestOptions.extra] に保存するリトライ試行回数のキー。
/// 同一インターセプタが複数リクエストを並行処理しても衝突しないよう、
/// リクエストごとの [RequestOptions] インスタンスにカウンタを持たせる。
const _retryAttemptExtraKey = 'dioRetryInterceptor.attempt';

/// 一時的なエラー（ネットワークエラー・5xxレスポンス）に限定して、
/// 指数バックオフで自動的にリトライする [Interceptor]（PERF-009）。
///
/// `packages/batch/src/client/http.ts`（PERF-055, `fetchWithTimeout`）の
/// リトライ設計（一時的なエラー限定・指数バックオフ・最大リトライ回数）を
/// dio の `Interceptor` として移植したもの。外部パッケージ（`dio_smart_retry`等）
/// を追加せず、dio標準の `InterceptorsWrapper`/`Interceptor` のみで実装する。
///
/// リトライ対象は以下の**すべて**を満たすリクエストのみ:
/// - HTTPメソッドが `GET`
///   （このアプリの `RemoteDataSource` 群のうち副作用を持つ
///   `PushSubscriptionRemoteDataSource` はPOST/DELETEを使う。これらを
///   無条件にリトライすると、レスポンス未達のタイムアウト時にサーバー側で
///   購読登録・解除処理が重複しうるため対象外とする）
/// - エラー種別が一時的なもの
///   （接続系タイムアウト・接続エラー、または5xxレスポンス。
///   4xx（クライアントエラー）はリクエスト自体が不正なためリトライしない）
/// - リトライ回数が [maxRetries] 未満
///
/// ### 429（レート制限）を自動リトライ対象に含めない理由（QERR-08）
///
/// 429 は一時的なエラーではあるが、`_isRetryableError` の対象（5xx）には
/// **意図的に含めていない**。429を自動リトライすると、指数バックオフの
/// 待機時間がサーバー側のレート制限期間（api側 `RATE_LIMITER` は60秒、
/// `packages/core/src/http/rateLimitMiddleware.ts` 参照）より大幅に短いため、
/// リトライ自体がさらにレート制限を消費し状況を悪化させる。
///
/// 現状、429発生時は本インターセプタで何もせず [ErrorRetryCard] の手動
/// 「再試行」に委ねている（QERR-03未対応のため、手動再試行も同様にレート制限を
/// 消費しうる制約が残る）。QERR-04でAPI側は `Retry-After` ヘッダーを返すように
/// なったため、QERR-03でこのヘッダーを読み取り、[ErrorRetryCard] 側で
/// 待機時間表示・再試行ボタンの一時無効化を行うことで、自動・手動の両方が
/// 429を悪化させない状態にする（未対応）。
class DioRetryInterceptor extends Interceptor {
  DioRetryInterceptor({
    required this.dio,
    this.maxRetries = 2,
    this.retryDelays = const [
      Duration(milliseconds: 200),
      Duration(milliseconds: 400),
    ],
  });

  /// リトライ実行時にリクエストを再送するための[Dio]インスタンス。
  /// このインターセプタを登録する[Dio]インスタンスと同一のものを渡すこと。
  final Dio dio;

  /// 最大リトライ回数（計 `maxRetries + 1` 回まで試行する）。
  final int maxRetries;

  /// 各リトライ試行前の待機時間（指数バックオフ）のリスト。
  /// 試行回数が [retryDelays] の長さを超える場合は最後の値を使い回す。
  final List<Duration> retryDelays;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final requestOptions = err.requestOptions;
    final attempt = _attemptOf(requestOptions);

    if (!_shouldRetry(err, requestOptions, attempt)) {
      handler.next(err);
      return;
    }

    await Future<void>.delayed(_delayFor(attempt));

    final retryOptions = requestOptions.copyWith(
      extra: {...requestOptions.extra, _retryAttemptExtraKey: attempt + 1},
    );

    try {
      final response = await dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  int _attemptOf(RequestOptions requestOptions) {
    final value = requestOptions.extra[_retryAttemptExtraKey];
    if (value is int) {
      return value;
    }
    return 0;
  }

  bool _shouldRetry(
    DioException err,
    RequestOptions requestOptions,
    int attempt,
  ) {
    if (attempt >= maxRetries) {
      return false;
    }
    if (requestOptions.method.toUpperCase() != 'GET') {
      return false;
    }
    return _isRetryableError(err);
  }

  Duration _delayFor(int attempt) {
    if (retryDelays.isEmpty) {
      return Duration.zero;
    }
    final index = attempt < retryDelays.length
        ? attempt
        : retryDelays.length - 1;
    return retryDelays[index];
  }

  static bool _isRetryableError(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.badResponse:
        final statusCode = err.response?.statusCode;
        return statusCode != null && statusCode >= 500;
      case DioExceptionType.transformTimeout:
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return false;
    }
  }
}
