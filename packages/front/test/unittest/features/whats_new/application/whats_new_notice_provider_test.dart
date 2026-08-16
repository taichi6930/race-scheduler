// whatsNewNoticeProvider のデシジョンテーブル
//
// | ID   | 条件                                                    | 期待                                          |
// | ---- | -------------------------------------------------------- | ------------------------------------------------ |
// | T-01 | GitHub APIの取得に失敗する                                | falseを返す（お知らせしない、NFR-01）           |
// | T-02 | リリースが1件も無い                                       | falseを返す                                     |
// | T-03 | 「最後に見たタグ」が未保存（初回起動）                    | falseを返し、最新タグを静かに記録する           |
// | T-04 | 「最後に見たタグ」と最新タグが一致                        | falseを返す                                     |
// | T-05 | 「最後に見たタグ」と最新タグが異なる                      | trueを返し、記録はまだ更新しない                |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/release_note_entity.dart';
import 'package:front/domain/repositories/i_release_note_repository.dart';
import 'package:front/features/whats_new/application/last_seen_release_provider.dart';
import 'package:front/features/whats_new/application/release_notes_provider.dart';
import 'package:front/features/whats_new/application/whats_new_notice_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeReleaseNoteRepository implements IReleaseNoteRepository {
  _FakeReleaseNoteRepository(this._result);

  final List<ReleaseNoteEntity> Function() _result;

  @override
  Future<List<ReleaseNoteEntity>> getAll() async => _result();
}

ReleaseNoteEntity _release(String tagName) => ReleaseNoteEntity(
  tagName: tagName,
  publishedAt: DateTime(2026, 8, 1),
  categories: const [],
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer(
    List<ReleaseNoteEntity> Function() result,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      retry: (retryCount, error) => null,
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        releaseNoteRepositoryProvider.overrideWithValue(
          _FakeReleaseNoteRepository(result),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('[T-01] GitHub APIの取得に失敗する_falseを返す', () async {
    final container = await buildContainer(() => throw Exception('failed'));

    final result = await container.read(whatsNewNoticeProvider.future);

    expect(result, isFalse);
  });

  test('[T-02] リリースが1件も無い_falseを返す', () async {
    final container = await buildContainer(() => []);

    final result = await container.read(whatsNewNoticeProvider.future);

    expect(result, isFalse);
  });

  test('[T-03] 最後に見たタグが未保存_falseを返し最新タグを静かに記録する', () async {
    final container = await buildContainer(() => [_release('v1.2.0')]);

    final result = await container.read(whatsNewNoticeProvider.future);

    expect(result, isFalse);
    expect(container.read(lastSeenReleaseTagProvider), 'v1.2.0');
  });

  test('[T-04] 最後に見たタグと最新タグが一致_falseを返す', () async {
    SharedPreferences.setMockInitialValues({
      'whats_new_last_seen_release_tag': 'v1.2.0',
    });
    final container = await buildContainer(() => [_release('v1.2.0')]);

    final result = await container.read(whatsNewNoticeProvider.future);

    expect(result, isFalse);
  });

  test('[T-05] 最後に見たタグと最新タグが異なる_trueを返し記録は更新しない', () async {
    SharedPreferences.setMockInitialValues({
      'whats_new_last_seen_release_tag': 'v1.1.0',
    });
    final container = await buildContainer(() => [_release('v1.2.0')]);

    final result = await container.read(whatsNewNoticeProvider.future);

    expect(result, isTrue);
    expect(container.read(lastSeenReleaseTagProvider), 'v1.1.0');
  });
}
