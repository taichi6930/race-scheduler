import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// [handleDioCall] が [DioException] から分類するエラー種別（QERR-05）。
///
/// QERR-01（文言の出し分け）・QERR-03（429時のリトライ導線分離）が
/// 呼び出し元でこの値を見て挙動を変えられるようにするための最小限の分類。
enum ApiErrorKind {
  /// ネットワーク接続不可（オフライン等）・接続確立自体の失敗。
  connection,

  /// 接続・送信・受信のいずれかがタイムアウトした。
  timeout,

  /// HTTPレスポンスは返ったがエラーステータス（4xx/5xx）だった。
  /// [ApiCallException.statusCode] に実際のステータスコードが入る。
  badResponse,

  /// リクエストがキャンセルされた。
  cancel,

  /// 上記以外（証明書エラー・その他予期しない失敗）。
  other,
}

/// [handleDioCall] が [DioException] をラップして投げる例外。
///
/// 呼び出し元は [kind] / [statusCode] を見て原因を判別できる
/// （オフライン・タイムアウト・HTTPステータス・その他）。
/// `toString()` は従来の `Exception('API Error: <message>')` と同じ
/// 表示形式を維持し、この値に依存する既存コードへの影響を避ける。
class ApiCallException implements Exception {
  ApiCallException({
    required this.kind,
    required this.statusCode,
    required String message,
  }) : _message = message;

  final ApiErrorKind kind;
  final int? statusCode;
  final String _message;

  @override
  String toString() => 'Exception: API Error: $_message';
}

/// [DioExceptionType] を [ApiErrorKind] へ分類する。
ApiErrorKind _classify(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionError:
      return ApiErrorKind.connection;
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.transformTimeout:
      return ApiErrorKind.timeout;
    case DioExceptionType.badResponse:
      return ApiErrorKind.badResponse;
    case DioExceptionType.cancel:
      return ApiErrorKind.cancel;
    case DioExceptionType.badCertificate:
    case DioExceptionType.unknown:
      return ApiErrorKind.other;
  }
}

/// dio呼び出しを実行し、[DioException] を [ApiCallException] へ変換する。
/// 各 RemoteDataSource の
/// `try { ... } on DioException catch (e) { throw Exception('API Error: ${e.message}'); }`
/// という定型をここに集約する。
///
/// [call] 内で明示的に投げた別の [Exception]（例: `Failed to load races`）は
/// [DioException] ではないためそのまま伝播する（挙動を変えない）。
///
/// 変換前に [debugPrint] でログ出力する（OBS-022）。クライアント側APIエラー率が
/// 従来は一切収集されていなかったため、`global_error_handler.dart`（OBS-021）と
/// 同じ「[debugPrint]による構造化ログ、将来のクラッシュレポートSDK連携時は
/// この差し込み点にレポート送信処理を追加すればよい」という設計を踏襲する。
Future<T> handleDioCall<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (e) {
    debugPrint(
      '[handleDioCall] API呼び出しに失敗しました: '
      '${e.requestOptions.method} ${e.requestOptions.path} '
      '(${e.type}) ${e.message}',
    );
    throw ApiCallException(
      kind: _classify(e),
      statusCode: e.response?.statusCode,
      message: e.message ?? e.toString(),
    );
  }
}
