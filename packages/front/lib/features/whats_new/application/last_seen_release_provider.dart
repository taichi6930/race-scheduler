import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/di/shared_preferences_provider.dart';
import '../../../core/persist_write.dart';

const _kLastSeenReleaseTag = 'whats_new_last_seen_release_tag';

/// 「最後に見た更新履歴のリリースタグ」を `shared_preferences` に永続化する
/// （FR-04。`timeline_filter_provider.dart` のフィルタ永続化と同じ方式）。
///
/// アプリの `pubspec.yaml` の `version` はCIでリリースタグに追従して
/// 更新されないため、比較対象は「アプリの現在バージョン」ではなく
/// 「GitHub Releases APIで確認できる最新リリースのタグ名」にしている
/// （元の要件文言からの意図的な変更。詳細はPR説明を参照）。
final lastSeenReleaseTagProvider =
    NotifierProvider<LastSeenReleaseTagNotifier, String?>(
      LastSeenReleaseTagNotifier.new,
    );

class LastSeenReleaseTagNotifier extends Notifier<String?> {
  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  String? build() => _prefs.getString(_kLastSeenReleaseTag);

  /// [tag] を「最後に見たリリース」として記録する。
  ///
  /// 更新履歴ページを開いたタイミング（[WhatsNewScreen]）、および初回起動時
  /// （比較対象が無いため通知はせず記録だけ行う、[whatsNewNoticeProvider]）
  /// の両方から呼ばれる。
  Future<bool> markSeen(String tag) async {
    state = tag;
    return persistWrite(() => _prefs.setString(_kLastSeenReleaseTag, tag));
  }
}
