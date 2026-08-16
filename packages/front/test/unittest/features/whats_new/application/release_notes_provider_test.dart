// releaseNotesProvider / visibleReleaseNotesProvider のデシジョンテーブル
//
// | ID   | 条件                                              | 期待                                        |
// | ---- | -------------------------------------------------- | ---------------------------------------------- |
// | T-01 | repositoryが正常にリリース一覧を返す               | providerの結果に反映される                 |
// | T-02 | TTL（15分）経過                                    | 自動で再度問い合わせる                     |
// | T-03 | repositoryが失敗する                               | AsyncErrorになる                           |
// | T-04 | visibleReleaseNotesProvider: カテゴリが空のリリースを含む | カテゴリが空のリリースは除外される  |

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/release_note_category.dart';
import 'package:front/domain/entities/release_note_entity.dart';
import 'package:front/domain/repositories/i_release_note_repository.dart';
import 'package:front/features/whats_new/application/release_notes_provider.dart';

class _FakeReleaseNoteRepository implements IReleaseNoteRepository {
  _FakeReleaseNoteRepository(this._result);

  final List<ReleaseNoteEntity> Function() _result;
  int callCount = 0;

  @override
  Future<List<ReleaseNoteEntity>> getAll() async {
    callCount++;
    return _result();
  }
}

ReleaseNoteEntity _release(String tagName, {bool withCategories = true}) =>
    ReleaseNoteEntity(
      tagName: tagName,
      publishedAt: DateTime(2026, 8, 1),
      categories: withCategories
          ? const [
              ReleaseNoteCategoryEntryEntity(
                category: ReleaseNoteCategory.improvement,
                items: ['通知の重複を解消しました'],
              ),
            ]
          : const [],
    );

void main() {
  test('[T-01] repositoryが正常に返す_providerの結果に反映される', () async {
    final repository = _FakeReleaseNoteRepository(() => [_release('v1.0.0')]);
    final container = ProviderContainer(
      overrides: [releaseNoteRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final result = await container.read(releaseNotesProvider.future);

    expect(result.map((r) => r.tagName), ['v1.0.0']);
  });

  test('[T-02] TTL（15分）経過_自動で再度問い合わせる', () {
    final repository = _FakeReleaseNoteRepository(() => []);

    fakeAsync((async) {
      final container = ProviderContainer(
        overrides: [
          releaseNoteRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      container.read(releaseNotesProvider);
      async.flushMicrotasks();
      expect(repository.callCount, 1);

      async.elapse(const Duration(minutes: 15));
      container.read(releaseNotesProvider);
      async.flushMicrotasks();

      expect(repository.callCount, 2);
    });
  });

  test('[T-03] repositoryが失敗する_AsyncErrorになる', () async {
    final repository = _FakeReleaseNoteRepository(
      () => throw Exception('failed'),
    );
    final container = ProviderContainer(
      retry: (retryCount, error) => null,
      overrides: [releaseNoteRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await expectLater(
      container.read(releaseNotesProvider.future),
      throwsException,
    );
  });

  test('[T-04] visibleReleaseNotesProvider_カテゴリが空のリリースを含む_除外される', () async {
    final repository = _FakeReleaseNoteRepository(
      () => [_release('v1.1.0'), _release('v1.0.0', withCategories: false)],
    );
    final container = ProviderContainer(
      overrides: [releaseNoteRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(releaseNotesProvider.future);
    final result = container.read(visibleReleaseNotesProvider);

    expect(result.value?.map((r) => r.tagName), ['v1.1.0']);
  });
}
