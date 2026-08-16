import 'package:flutter/foundation.dart';

/// アプリ全体のグローバル例外ハンドラを設定する（OBS-021）。
///
/// `FlutterError.onError`（ウィジェットツリー内で発生する同期例外）と
/// `PlatformDispatcher.instance.onError`（非同期・プラットフォームレベルの
/// 未処理例外）の両方にハンドラを登録し、キャッチされない例外が
/// 何の記録も残さず消えてしまうことを防ぐ。
///
/// クラッシュレポートSDK（Sentry/Crashlytics等）は未導入（OBS-020、別課題）
/// のため、現時点では[debugPrint]による構造化ログ出力のみを行う。将来SDKを
/// 導入する際は、本関数内のログ出力箇所にレポート送信処理を追加すればよい
/// （＝クラッシュレポート連携のための単一の差し込み点として設計している）。
///
/// `main()`の冒頭（`WidgetsFlutterBinding.ensureInitialized()`直後、他の
/// 初期化処理より前）で一度だけ呼び出すこと。
void installGlobalErrorHandlers() {
  FlutterError.onError = (FlutterErrorDetails details) {
    // 既定の動作（画面上のエラー表示・コンソールへの出力）は握りつぶさず
    // 維持したうえで、収集用のログも別途出力する。
    FlutterError.presentError(details);
    _logUncaughtError(
      source: 'FlutterError.onError',
      error: details.exception,
      stackTrace: details.stack ?? StackTrace.empty,
    );
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stackTrace) {
    // trueは「処理済みとしてクラッシュを防ぐ」という意味だが、それだけでは
    // 例外を握りつぶすことになりOBS-021が解決しようとしている問題（収集経路の
    // 欠如）を悪化させる。そのため、trueを返す前に必ずログへ出力する。
    _logUncaughtError(
      source: 'PlatformDispatcher.instance.onError',
      error: error,
      stackTrace: stackTrace,
    );
    return true;
  };
}

void _logUncaughtError({
  required String source,
  required Object error,
  required StackTrace stackTrace,
}) {
  debugPrint('[$source] キャッチされない例外が発生しました: $error\n$stackTrace');
}
