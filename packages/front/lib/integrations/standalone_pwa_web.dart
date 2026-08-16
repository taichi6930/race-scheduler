import 'package:web/web.dart' as web;

/// ホーム画面に追加されたスタンドアロンPWAとして実行中かどうか。
///
/// iOS Safariのスタンドアロン表示（`display: standalone`）では、
/// `window.open` による新規タブが実URLへ遷移せず、Safariの空の検索開始画面の
/// まま止まるバグがある。この判定を使い、その場合だけ現在のタブ内で遷移させる
/// （[race_detail_sheet.dart] 参照）。
bool isRunningAsStandalonePwa() =>
    web.window.matchMedia('(display-mode: standalone)').matches;
