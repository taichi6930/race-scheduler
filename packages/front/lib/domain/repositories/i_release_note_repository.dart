import '../entities/release_note_entity.dart';

/// 更新履歴（GitHub Releases）を取得するリポジトリ。
abstract class IReleaseNoteRepository {
  /// 公開済み（draft・prerelease除く）のリリース一覧を、新しい順で取得する。
  Future<List<ReleaseNoteEntity>> getAll();
}
