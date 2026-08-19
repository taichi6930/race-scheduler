import 'package:freezed_annotation/freezed_annotation.dart';

import 'release_note_category.dart';

part 'release_note_entity.freezed.dart';

/// リリース本文（Markdown）中の1カテゴリ分（見出し＋箇条書き項目）。
@freezed
abstract class ReleaseNoteCategoryEntryEntity
    with _$ReleaseNoteCategoryEntryEntity {
  const factory ReleaseNoteCategoryEntryEntity({
    required ReleaseNoteCategory category,
    required List<String> items,
  }) = _ReleaseNoteCategoryEntryEntity;
}

/// 更新履歴ページ（GET /repos/{owner}/{repo}/releases）1件分。
///
/// [categories] は本文をパース（[parseReleaseNoteBody]）した結果で、
/// カテゴリ見出しが1つも見つからなかった場合（旧形式のリリース等）は
/// 空リストになる。空リストのリリースは一覧画面での表示対象外
/// （[visibleReleaseNotes]）とする（NFR-02）。
///
/// [sourceRepo] はリリースの取得元リポジトリ（'race-schedule' /
/// 'race-scheduler'）。race-schedule/race-scheduler分割後、更新履歴画面で
/// どちらのリポジトリ由来のリリースか一目で分かるようにするために保持する。
@freezed
abstract class ReleaseNoteEntity with _$ReleaseNoteEntity {
  const factory ReleaseNoteEntity({
    required String tagName,
    String? name,
    required DateTime publishedAt,
    required List<ReleaseNoteCategoryEntryEntity> categories,
    String? sourceRepo,
  }) = _ReleaseNoteEntity;
}
