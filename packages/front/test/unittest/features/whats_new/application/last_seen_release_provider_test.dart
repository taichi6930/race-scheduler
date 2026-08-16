// LastSeenReleaseTagNotifier のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                        |
// | ---- | -------------------------------------------- | ---------------------------------------------- |
// | T-01 | 永続化された値が無い（初回起動）            | 初期値はnull                                |
// | T-02 | 永続化された値がある                        | 永続化された値を初期値として復元する         |
// | T-03 | markSeenを呼ぶ                              | stateが更新され、shared_preferencesに永続化される |
// | T-04 | markSeen後に別インスタンスで復元            | 永続化した値が読み直せる                    |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/features/whats_new/application/last_seen_release_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kLastSeenReleaseTag = 'whats_new_last_seen_release_tag';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer() async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('[T-01] 永続化された値が無い_初期値はnull', () async {
    final container = await buildContainer();

    expect(container.read(lastSeenReleaseTagProvider), isNull);
  });

  test('[T-02] 永続化された値がある_復元される', () async {
    SharedPreferences.setMockInitialValues({
      _kLastSeenReleaseTag: 'v1.0.0',
    });
    final container = await buildContainer();

    expect(container.read(lastSeenReleaseTagProvider), 'v1.0.0');
  });

  test('[T-03] markSeenを呼ぶ_stateが更新され永続化される', () async {
    final container = await buildContainer();

    final succeeded = await container
        .read(lastSeenReleaseTagProvider.notifier)
        .markSeen('v1.2.0');

    expect(succeeded, isTrue);
    expect(container.read(lastSeenReleaseTagProvider), 'v1.2.0');
  });

  test('[T-04] markSeen後に別インスタンスで復元_永続化した値が読み直せる', () async {
    final container = await buildContainer();
    await container.read(lastSeenReleaseTagProvider.notifier).markSeen(
      'v1.3.0',
    );

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(_kLastSeenReleaseTag), 'v1.3.0');
  });
}
