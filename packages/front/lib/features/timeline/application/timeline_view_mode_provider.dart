import 'package:flutter_riverpod/flutter_riverpod.dart';

/// タイムライン画面の表示モード（日別／全期間、screens.md §1.4）。
enum TimelineViewMode {
  /// 選択中の1日ぶんのみ表示（既定）。
  day,

  /// 過去〜未来を連続スクロールで表示。
  all,
}

/// タイムラインの表示モード。セッション内のみの state（既定 `day`）。
final timelineViewModeProvider =
    NotifierProvider<TimelineViewModeNotifier, TimelineViewMode>(
      TimelineViewModeNotifier.new,
    );

class TimelineViewModeNotifier extends Notifier<TimelineViewMode> {
  @override
  TimelineViewMode build() => TimelineViewMode.day;

  void setMode(TimelineViewMode mode) => state = mode;
}
