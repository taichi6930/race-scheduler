import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/release_note_entity.dart';
import 'last_seen_release_provider.dart';
import 'release_notes_provider.dart';

/// 新バージョン初回起動時のお知らせ表示要否（FR-04）。
///
/// アプリ起動直後に一度だけ判定する想定（[WhatsNewNoticeListener]が
/// `.future` を1回読むだけで、TTLによる再取得（[releaseNotesProvider]）には
/// 追従しない。起動中に何度もお知らせがポップアップし直すのを避けるため）。
///
/// - GitHub Releases APIの取得に失敗した場合はお知らせしない（`false`、NFR-01）
/// - リリースが1件も無い場合もお知らせしない（`false`）
/// - 「最後に見たタグ」が未保存（初回起動）の場合は、現在の最新タグを
///   静かに記録したうえで `false` を返す（初めて使うユーザーに「追いつくべき
///   更新」は無いため）
/// - 「最後に見たタグ」と最新タグが異なる場合のみ `true`
///   （記録の更新はここでは行わない。[WhatsNewScreen] を訪れた時点で更新する）
final whatsNewNoticeProvider = FutureProvider<bool>((ref) async {
  List<ReleaseNoteEntity> releases;
  try {
    releases = await ref.read(releaseNotesProvider.future);
  } on Exception {
    return false;
  }
  if (releases.isEmpty) {
    return false;
  }

  final newestTag = releases.first.tagName;
  final lastSeenTag = ref.read(lastSeenReleaseTagProvider);
  if (lastSeenTag == null) {
    await ref.read(lastSeenReleaseTagProvider.notifier).markSeen(newestTag);
    return false;
  }
  return lastSeenTag != newestTag;
});
