import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/release_note_entity.dart';
import '../../../domain/entities/release_note_parser.dart';
import '../../../domain/repositories/i_release_note_repository.dart';

/// [IReleaseNoteRepository] の実装（`getIt` 経由）を提供する。
final releaseNoteRepositoryProvider = Provider<IReleaseNoteRepository>(
  (ref) => getIt<IReleaseNoteRepository>(),
);

/// GitHub Releases一覧（公開済み・新しい順、FR-02）。
///
/// [defaultCacheTtl] 経過後は自動で再取得する（NFR-01）。取得失敗時は
/// [AsyncError] となり、画面側（[WhatsNewScreen]）がエラー表示・再試行導線を
/// 出す（クラッシュしない）。
final releaseNotesProvider = FutureProvider<List<ReleaseNoteEntity>>((
  ref,
) async {
  scheduleTtlInvalidate(ref, defaultCacheTtl);
  final repository = ref.watch(releaseNoteRepositoryProvider);
  return repository.getAll();
});

/// [releaseNotesProvider] のうち、本文パースでカテゴリが1件以上得られた
/// リリースだけを残した表示対象一覧（[visibleReleaseNotes]、NFR-02）。
final visibleReleaseNotesProvider =
    Provider<AsyncValue<List<ReleaseNoteEntity>>>((ref) {
      final releasesAsync = ref.watch(releaseNotesProvider);
      return releasesAsync.whenData(visibleReleaseNotes);
    });
