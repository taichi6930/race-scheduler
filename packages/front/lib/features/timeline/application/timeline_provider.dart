import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/jst_time.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../domain/usecases/get_races_by_date_range.dart';

/// タイムラインに表示中の日付（既定は日本時間の今日）。
///
/// アプリバーの日付送り・カレンダーの日タップから更新される
/// （technical-design.md §4）。
final timelineDateProvider = NotifierProvider<TimelineDateNotifier, DateTime>(
  TimelineDateNotifier.new,
);

class TimelineDateNotifier extends Notifier<DateTime> {
  @override
  DateTime build() => dateOnly(jstNow());

  void goToPrevDay() => state = state.subtract(const Duration(days: 1));

  void goToNextDay() => state = state.add(const Duration(days: 1));

  void setDate(DateTime date) => state = dateOnly(date);
}

/// 時刻を切り捨てて日付だけにする。
DateTime dateOnly(DateTime dateTime) =>
    DateTime(dateTime.year, dateTime.month, dateTime.day);

/// レース一覧を発走時刻（`datetime`、ISO8601文字列）昇順にソートする。
/// 元のリストは変更しない。
List<RaceEntity> sortRacesByDatetime(List<RaceEntity> races) {
  final sorted = [...races];
  sorted.sort((a, b) => a.datetime.compareTo(b.datetime));
  return sorted;
}

/// 指定日の全公営競技のレースを、発走時刻順に1本のタイムラインとして取得する。
///
/// バックエンド `/race` は `raceTypeList` に全6種別を渡せば横断取得できるため、
/// リクエストは1回で済む（technical-design.md §3）。
///
/// `autoDispose` を付与し、日付送り（前日/翌日）で訪問した日付のキャッシュが
/// 参照されなくなった後も解放されずに単調増加し続けることを防ぐ（PERF-001）。
/// ダウンストリームの [visibleTimelineRacesProvider] も同様に `autoDispose`
/// にしないと、非 autoDispose な購読者がこの provider を永久に生かし続けて
/// しまい解放が働かないため、両方に付与している。
///
/// 同じ日付を表示し続けている間もAPIを叩き直せるよう、[defaultCacheTtl] 経過後
/// に自動で再取得する（[scheduleTtlInvalidate]）。すぐ最新化したい場合は
/// 画面側の更新ボタン・pull-to-refreshで `ref.invalidate` する。
final timelineProvider = FutureProvider.autoDispose
    .family<List<RaceEntity>, DateTime>((ref, date) async {
      scheduleTtlInvalidate(ref, defaultCacheTtl);
      final useCase = getIt<GetRacesByDateRangeUseCase>();
      final dateStr = formatDateForApi(date);
      final races = await useCase(
        startDate: dateStr,
        finishDate: dateStr,
        raceTypeList: RaceType.all.map((type) => type.value).toList(),
      );
      return sortRacesByDatetime(races);
    });
