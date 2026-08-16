import '../../domain/entities/release_note_entity.dart';
import '../../domain/repositories/i_release_note_repository.dart';
import '../datasources/release_remote_data_source.dart';

class ReleaseNoteRepositoryImpl implements IReleaseNoteRepository {
  ReleaseNoteRepositoryImpl({required this.remoteDataSource});

  final IReleaseRemoteDataSource remoteDataSource;

  @override
  Future<List<ReleaseNoteEntity>> getAll() async {
    final models = await remoteDataSource.getReleases();
    final entities = models
        .where((model) => !model.draft && !model.prerelease)
        .map((model) => model.toEntity())
        .toList();
    // GitHub Releases APIは既定で新しい順を返すが、front側では明示的に
    // publishedAt降順でソートする（要件どおり。順序をAPI側の挙動に依存させない）。
    entities.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    return entities;
  }
}
