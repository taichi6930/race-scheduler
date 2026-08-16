import 'package:flutter/foundation.dart' show kIsWeb, visibleForTesting;
import 'package:url_launcher/url_launcher.dart';

import '../../integrations/standalone_pwa.dart';

/// 外部ブラウザ/アプリで開いてよいURLスキームの許可リスト（SEC-054）。
///
/// [launchExternalUrl] に渡される [Uri] はバックエンドの応答や設定値をそのまま
/// 使うことがあるため、`javascript:`等の危険なスキームが紛れ込んでいてもそのまま
/// 起動してしまう。http/https限定にすることで、多層防御とする。
const allowedExternalUrlSchemes = {'http', 'https'};

/// [url] を外部ブラウザ/アプリで開く。
///
/// ホーム画面に追加されたスタンドアロンPWA（iOS Safari）では、`window.open` に
/// よる新規タブが実URLへ遷移せず空白のSafari検索開始画面のまま止まるバグがある
/// ため、その場合は `webOnlyWindowName: '_self'` で現在のタブ内に遷移させる
/// （それ以外のWeb環境・ネイティブアプリでは従来どおり新規タブ/外部アプリで開く）。
Future<bool> launchExternalUrl(Uri url) {
  if (!allowedExternalUrlSchemes.contains(url.scheme)) {
    return Future.value(false);
  }
  return launchUrl(
    url,
    mode: LaunchMode.externalApplication,
    webOnlyWindowName: resolveExternalLinkWindowName(
      standalonePwa: kIsWeb && isRunningAsStandalonePwa(),
    ),
  );
}

/// [launchExternalUrl] の遷移先ウィンドウ判定ロジック（分岐条件を引数化して
/// 単体テスト可能にしたもの。実ブラウザ判定 [isRunningAsStandalonePwa] 自体は
/// テスト環境から差し替えられないため、判定結果を受け取る形にしている）。
@visibleForTesting
String resolveExternalLinkWindowName({required bool standalonePwa}) =>
    standalonePwa ? '_self' : '_blank';
