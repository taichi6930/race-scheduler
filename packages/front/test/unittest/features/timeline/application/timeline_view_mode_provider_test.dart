// timeline_view_mode_provider.dart のデシジョンテーブル
//
// | ID   | 対象                     | 条件                | 期待                    |
// | ---- | ------------------------ | -------------------- | ----------------------- |
// | T-01 | TimelineViewModeNotifier | 初期状態              | TimelineViewMode.day    |
// | T-02 | TimelineViewModeNotifier | setMode(all)          | TimelineViewMode.all    |
// | T-03 | TimelineViewModeNotifier | setMode(day)を再度呼ぶ | TimelineViewMode.day    |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/features/timeline/application/timeline_view_mode_provider.dart';

void main() {
  group('TimelineViewModeNotifier', () {
    test('[T-01] 初期状態_day', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(timelineViewModeProvider), TimelineViewMode.day);
    });

    test('[T-02] setMode(all)_allになる', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(timelineViewModeProvider.notifier);

      notifier.setMode(TimelineViewMode.all);

      expect(container.read(timelineViewModeProvider), TimelineViewMode.all);
    });

    test('[T-03] setMode(day)を再度呼ぶ_dayのまま', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(timelineViewModeProvider.notifier);

      notifier.setMode(TimelineViewMode.all);
      notifier.setMode(TimelineViewMode.day);

      expect(container.read(timelineViewModeProvider), TimelineViewMode.day);
    });
  });
}
