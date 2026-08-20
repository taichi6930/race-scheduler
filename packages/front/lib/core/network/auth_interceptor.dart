import 'package:dio/dio.dart';

/// 全APIリクエストへセッショントークン（`Authorization: Bearer <token>`）を
/// 付与し、401レスポンスを受けたら呼び出し元へコールバックで知らせる
/// [Interceptor]。
///
/// この[Dio]は[Notifier]/`ref`が存在しない`setupDependencies()`
/// （`service_locator.dart`、`ProviderScope`構築前に実行される）で生成される
/// ため、RiverpodのProviderを直接参照できない。[token]・[onUnauthorized]を
/// 単純なフィールド・コールバックとして公開し、Riverpod側
/// （`SessionNotifier`、`lib/auth/application/session_provider.dart`）が
/// build()時にこれらを配線することで橋渡しする
/// （`FavoriteIdsNotifier`が`_repository`をbuild()内で一度だけ解決し、
/// 以後はプレーンフィールド越しに連携する既存パターンと同じ考え方）。
class AuthInterceptor extends Interceptor {
  /// 保持中のセッショントークン。未ログイン時はnull。
  String? token;

  /// APIが401（未認証/セッション失効）を返した際に呼ばれるコールバック。
  void Function()? onUnauthorized;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final currentToken = token;
    if (currentToken != null) {
      options.headers['Authorization'] = 'Bearer $currentToken';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      onUnauthorized?.call();
    }
    handler.next(err);
  }
}
