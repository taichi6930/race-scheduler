// ExternalLinkLauncher のデシジョンテーブル
//
// | ID   | 条件                                                       | 期待                                          |
// | ---- | ---------------------------------------------------------- | ------------------------------------------------ |
// | T-01 | resolveExternalLinkWindowName・スタンドアロンPWA判定=true  | '_self' を返す（現在のタブ内に遷移させる）        |
// | T-02 | resolveExternalLinkWindowName・スタンドアロンPWA判定=false | '_blank' を返す（新規タブで開く）                 |
// | T-03 | launchExternalUrl・javascript:スキーム（SEC-054）          | falseを返し、実際には起動しない                   |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/utils/external_link_launcher.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _FakeUrlLauncher extends UrlLauncherPlatform {
  _FakeUrlLauncher({required this.result});

  final bool result;
  bool launched = false;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launched = true;
    return result;
  }
}

void main() {
  // resolveExternalLinkWindowName: PWAスタンドアロン実行中は現在のタブ内に遷移
  // させる（window.openによる新規タブが実URLへ遷移せず空白のSafari検索開始画面
  // のまま止まるバグの回帰防止）。実ブラウザのスタンドアロン判定自体はテスト
  // 環境から差し替えられないため、判定結果を受け取る形の純粋関数として直接検証する。
  test('[T-01] resolveExternalLinkWindowName_スタンドアロンPWA判定true_selfを返す', () {
    expect(resolveExternalLinkWindowName(standalonePwa: true), '_self');
  });

  test('[T-02] resolveExternalLinkWindowName_スタンドアロンPWA判定false_blankを返す', () {
    expect(resolveExternalLinkWindowName(standalonePwa: false), '_blank');
  });

  test('[T-03] launchExternalUrl_javascriptスキーム_falseを返し起動しない', () async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    final opened = await launchExternalUrl(Uri.parse('javascript:alert(1)'));

    expect(opened, false);
    expect(fake.launched, false);
  });
}
