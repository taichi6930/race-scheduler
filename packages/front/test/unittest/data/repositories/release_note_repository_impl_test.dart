// ReleaseNoteRepositoryImpl.getAll のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                        |
// | ---- | -------------------------------------------- | ---------------------------------------------- |
// | T-01 | draft・prereleaseが混在                     | draft・prereleaseは除外される               |
// | T-02 | published_atの順序がバラバラ                | 新しい順（降順）にソートされる              |
// | T-03 | リリースが0件                                | 空リストを返す                              |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/release_remote_data_source.dart';
import 'package:front/data/models/release_model.dart';
import 'package:front/data/repositories/release_note_repository_impl.dart';

class _FakeReleaseRemoteDataSource implements IReleaseRemoteDataSource {
  _FakeReleaseRemoteDataSource(this.models);

  final List<ReleaseModel> models;

  @override
  Future<List<ReleaseModel>> getReleases() async => models;
}

ReleaseModel _release({
  required String tagName,
  required String publishedAt,
  bool draft = false,
  bool prerelease = false,
}) => ReleaseModel(
  tagName: tagName,
  publishedAt: publishedAt,
  draft: draft,
  prerelease: prerelease,
);

void main() {
  group('ReleaseNoteRepositoryImpl.getAll', () {
    test('[T-01] draft_prereleaseが混在_draft_prereleaseは除外される', () async {
      final dataSource = _FakeReleaseRemoteDataSource([
        _release(tagName: 'v1.0.0', publishedAt: '2026-08-01T00:00:00Z'),
        _release(
          tagName: 'draft-v1.1.0',
          publishedAt: '2026-08-02T00:00:00Z',
          draft: true,
        ),
        _release(
          tagName: 'v1.1.0-rc1',
          publishedAt: '2026-08-03T00:00:00Z',
          prerelease: true,
        ),
      ]);
      final repository = ReleaseNoteRepositoryImpl(remoteDataSource: dataSource);

      final result = await repository.getAll();

      expect(result.map((r) => r.tagName), ['v1.0.0']);
    });

    test('[T-02] published_atの順序がバラバラ_新しい順にソートされる', () async {
      final dataSource = _FakeReleaseRemoteDataSource([
        _release(tagName: 'v1.0.0', publishedAt: '2026-07-01T00:00:00Z'),
        _release(tagName: 'v1.2.0', publishedAt: '2026-08-01T00:00:00Z'),
        _release(tagName: 'v1.1.0', publishedAt: '2026-07-15T00:00:00Z'),
      ]);
      final repository = ReleaseNoteRepositoryImpl(remoteDataSource: dataSource);

      final result = await repository.getAll();

      expect(result.map((r) => r.tagName), ['v1.2.0', 'v1.1.0', 'v1.0.0']);
    });

    test('[T-03] リリースが0件_空リストを返す', () async {
      final dataSource = _FakeReleaseRemoteDataSource([]);
      final repository = ReleaseNoteRepositoryImpl(remoteDataSource: dataSource);

      final result = await repository.getAll();

      expect(result, isEmpty);
    });
  });
}
