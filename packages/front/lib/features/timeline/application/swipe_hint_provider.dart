import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/di/shared_preferences_provider.dart';
import '../../../core/persist_write.dart';

const _kSwipeHintSeen = 'timeline_swipe_hint_seen';

/// 「左右スワイプで前日・翌日に移動できる」ヒントを表示済みかどうかを
/// `shared_preferences` に永続化する（QEMP-05。
/// `last_seen_release_provider.dart` と同じ方式）。
///
/// `timeline_screen.dart` のSemantics hintはスクリーンリーダー利用時にしか
/// 読まれないため、視覚ユーザー向けに初回のみヒントバーで案内する。
final swipeHintSeenProvider =
    NotifierProvider<SwipeHintSeenNotifier, bool>(SwipeHintSeenNotifier.new);

class SwipeHintSeenNotifier extends Notifier<bool> {
  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  bool build() => _prefs.getBool(_kSwipeHintSeen) ?? false;

  /// ヒントを見た（または閉じた）ことを記録する。
  Future<bool> markSeen() {
    state = true;
    return persistWrite(() => _prefs.setBool(_kSwipeHintSeen, true));
  }
}
