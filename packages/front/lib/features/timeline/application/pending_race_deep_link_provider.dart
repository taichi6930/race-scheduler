import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 通知タップ経由で開くべきレースID。
///
/// 通知タップ時点ではその日のレース一覧がまだ読み込まれていないため、
/// `app_router.dart`の`_TimelineRouteEntry`が[TimelineFilterProvider]相当の
/// 一時状態としてここへ「開きたいレースID」を置き、`timeline_screen.dart`が
/// その日のレース一覧読み込み後に一致するレースを見つけ次第、詳細を開いて
/// [clear]する（一覧が空/該当レース無しの場合は開かず残り続けるため、
/// 呼び出し元で日付遷移時に上書き・クリアする想定はしていない＝一度
/// 設定したら消費されるまで保持する単純な受け渡し用途に限定する）。
final pendingRaceDeepLinkProvider =
    NotifierProvider<PendingRaceDeepLinkNotifier, String?>(
      PendingRaceDeepLinkNotifier.new,
    );

class PendingRaceDeepLinkNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void request(String raceId) => state = raceId;

  void clear() => state = null;
}
