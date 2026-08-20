import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/jst_time.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../domain/usecases/get_races_by_date_range.dart';
import '../../favorites/application/favorite_ids_provider.dart';
import '../../settings/application/settings_provider.dart';
import 'month_key.dart';
import 'timeline_filter_provider.dart';
import 'timeline_provider.dart';

/// 指定月（[monthKey]）の全公営競技のレースを取得する。
///
/// `FutureProvider.family` は `autoDispose` を付けない限りパラメータ（月キー）
/// ごとに結果を保持し続けるため、これ自体が「同じ月を再取得しない」キャッシュ
/// として機能する（`timelineProvider(DateTime)` と同じ方針。
/// technical-design.md §11.1）。無期限に保持し続けると内容が陳腐化するため、
/// [defaultCacheTtl] 経過後は自動で再取得する（[scheduleTtlInvalidate]）。
final monthRaceChunkProvider = FutureProvider.family<List<RaceEntity>, String>((
  ref,
  monthKey,
) async {
  scheduleTtlInvalidate(ref, defaultCacheTtl);
  final useCase = getIt<GetRacesByDateRangeUseCase>();
  final (start, finish) = monthDateRange(monthKey);
  final races = await useCase(
    startDate: start,
    finishDate: finish,
    raceTypeList: RaceType.all.map((type) => type.value).toList(),
  );
  return sortRacesByDatetime(races);
});

/// 全期間タイムラインで現在読み込み済みの月キー一覧（昇順）。
///
/// 初期値は「今日を含む月とその前後1ヶ月」（日別モードと同じ初速の体感を
/// 確保するため）。`loadEarlier`/`loadLater` で隣接月を1件ずつ追加する。
final loadedMonthsProvider =
    NotifierProvider<LoadedMonthsNotifier, List<String>>(
      LoadedMonthsNotifier.new,
    );

/// 同時に保持する月数の上限（PERF-002）。
///
/// `monthRaceChunkProvider` は `autoDispose` を付けていない`FutureProvider.family`
/// のため、読み込んだ月は明示的に破棄しない限り無期限にメモリへ残り続ける。
/// 上限を超えたら、表示範囲外になった端の月を破棄する（下記 [LoadedMonthsNotifier]）。
/// 初期値3ヶ月 + 前後を数年分スクロールしても現実的な範囲に収まる値として12ヶ月とする。
const _maxLoadedMonths = 12;

class LoadedMonthsNotifier extends Notifier<List<String>> {
  @override
  List<String> build() {
    final current = monthKeyOf(dateOnly(jstNow()));
    return [offsetMonthKey(current, -1), current, offsetMonthKey(current, 1)];
  }

  /// 過去方向にもう1ヶ月読み込む。
  ///
  /// 直近で追加した最も過去側の月がまだ取得中の場合は何もしない
  /// （高速スクロール中に大量の月を一気に叩くのを防ぐ、technical-design.md §11.1）。
  /// 上限（[_maxLoadedMonths]）を超える場合は、最も未来側の月をキャッシュから破棄する
  /// （PERF-002: 過去方向にスクロールし続けているのに未来側を保持し続ける意味は薄いため）。
  void loadEarlier() {
    final earliest = state.first;
    if (ref.read(monthRaceChunkProvider(earliest)).isLoading) return;
    final next = [offsetMonthKey(earliest, -1), ...state];
    if (next.length > _maxLoadedMonths) {
      final dropped = next.removeLast();
      ref.invalidate(monthRaceChunkProvider(dropped));
    }
    state = next;
  }

  /// 未来方向にもう1ヶ月読み込む（[loadEarlier] の未来版）。
  void loadLater() {
    final latest = state.last;
    if (ref.read(monthRaceChunkProvider(latest)).isLoading) return;
    final next = [...state, offsetMonthKey(latest, 1)];
    if (next.length > _maxLoadedMonths) {
      final dropped = next.removeAt(0);
      ref.invalidate(monthRaceChunkProvider(dropped));
    }
    state = next;
  }
}

/// 全期間タイムラインの表示対象データ（読み込み済み月の統合・フィルタ適用後）。
class AllTimelineData {
  const AllTimelineData({
    required this.races,
    required this.isLoadingEarlier,
    required this.isLoadingLater,
    required this.earliestMonthHasError,
    required this.latestMonthHasError,
  });

  /// 読み込み済み月のうち取得成功分を統合・ソート・フィルタ適用したレース一覧。
  final List<RaceEntity> races;

  /// 最も過去側の月を取得中かどうか（先頭に読み込み中インジケータを出す）。
  final bool isLoadingEarlier;

  /// 最も未来側の月を取得中かどうか（末尾に読み込み中インジケータを出す）。
  final bool isLoadingLater;

  final bool earliestMonthHasError;
  final bool latestMonthHasError;
}

/// [loadedMonthsProvider] の各月の取得結果を統合・日時順にソートしたレース一覧。
///
/// フィルタ（[timelineFilterProvider]）や対象競技（[settingsProvider]）には
/// 依存しないため、それらの切り替えではこのproviderは再計算されず、Riverpodが
/// キャッシュ済みの値をそのまま返す（PERF-025: 全月分の連結+ソートは月数に
/// 比例したコストがあり、フィルタチップをON/OFFするたびに繰り返す必要はない）。
final _allTimelineSortedRacesProvider = Provider<List<RaceEntity>>((ref) {
  final months = ref.watch(loadedMonthsProvider);
  final races = <RaceEntity>[];
  for (final month in months) {
    final chunk = ref.watch(monthRaceChunkProvider(month));
    final data = chunk.value;
    if (data != null) races.addAll(data);
  }
  return sortRacesByDatetime(races);
});

/// [loadedMonthsProvider] の各月を統合し、日別モードと同じフィルタ
/// （重賞のみ/お気に入り/対象競技）を適用した全期間タイムラインのデータ。
final allTimelineRacesProvider = Provider<AllTimelineData>((ref) {
  final months = ref.watch(loadedMonthsProvider);
  final filter = ref.watch(timelineFilterProvider);
  final enabledDisciplines = ref.watch(
    settingsProvider.select((s) => s.enabledDisciplines),
  );
  final favorites = ref.watch(favoriteIdsProvider).value ?? const <String>{};

  final sortedRaces = ref.watch(_allTimelineSortedRacesProvider);
  final filtered = applyTimelineFilter(
    sortedRaces,
    filter,
    enabledDisciplines,
    favorites,
  );

  final earliest = ref.watch(monthRaceChunkProvider(months.first));
  final latest = ref.watch(monthRaceChunkProvider(months.last));

  return AllTimelineData(
    races: filtered,
    isLoadingEarlier: earliest.isLoading,
    isLoadingLater: latest.isLoading,
    earliestMonthHasError: earliest.hasError,
    latestMonthHasError: latest.hasError,
  );
});

/// 全期間タイムラインで現在読み込み済みの月に含まれる競走場選択肢一覧
/// （[VenueChipsBar] 用）。全期間モードから利用する。
final allTimelineVenuesProvider = Provider<List<String>>((ref) {
  final races = ref.watch(_allTimelineSortedRacesProvider);
  final enabledDisciplines = ref.watch(
    settingsProvider.select((s) => s.enabledDisciplines),
  );
  return visibleVenuesOf(races, enabledDisciplines);
});
