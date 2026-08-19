import 'package:freezed_annotation/freezed_annotation.dart';

import '../../domain/entities/release_note_entity.dart';
import '../../domain/entities/release_note_parser.dart';

part 'release_model.freezed.dart';
part 'release_model.g.dart';

/// `GET /repos/{owner}/{repo}/releases` のレスポンス要素1件分。
@freezed
abstract class ReleaseModel with _$ReleaseModel {
  const factory ReleaseModel({
    @JsonKey(name: 'tag_name') required String tagName,
    @JsonKey(name: 'name') String? name,
    @JsonKey(name: 'body') String? body,
    @JsonKey(name: 'published_at') String? publishedAt,
    @JsonKey(name: 'draft') @Default(false) bool draft,
    @JsonKey(name: 'prerelease') @Default(false) bool prerelease,
  }) = _ReleaseModel;

  factory ReleaseModel.fromJson(Map<String, dynamic> json) =>
      _$ReleaseModelFromJson(json);

  const ReleaseModel._();

  ReleaseNoteEntity toEntity() {
    return ReleaseNoteEntity(
      tagName: tagName,
      name: name,
      publishedAt: _parsePublishedAt(publishedAt),
      categories: parseReleaseNoteBody(body),
    );
  }
}

/// `published_at` が欠損・不正な日時文字列の場合は最古扱い（UNIXエポック）に
/// フォールバックする。呼び出し元（[ReleaseNoteRepositoryImpl]）が新しい順に
/// ソートする際、この種のレコードが自然に末尾へ回るだけで済み、例外にしない
/// （NFR-01: APIレスポンスの多少の欠損でクラッシュしない）。
DateTime _parsePublishedAt(String? value) {
  if (value == null) {
    return DateTime.fromMillisecondsSinceEpoch(0);
  }
  return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
}
