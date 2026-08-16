import '../../core/jst_time.dart';
import '../../domain/entities/place_entity.dart';
import '../../domain/entities/trip_group_course_entity.dart';
import '../../domain/entities/trip_group_entity.dart';
import '../../domain/entities/trip_group_master.dart';
import '../../domain/entities/trip_match_finder.dart';
import '../../domain/repositories/i_place_repository.dart';
import '../../domain/repositories/i_trip_group_repository.dart';

/// `docs/specs/SPEC-TRIP-001.md` の既定値と同じ（設定未指定時のフォールバック）。
/// 実際の呼び出し元（`trip_groups_provider.dart`）は常に
/// `settingsProvider`（既定値付き）の値を渡すため、通常はこの分岐に
/// 到達しない。
const int _defaultTripLookaheadDays = 180;
const int _defaultTripToleranceDays = 2;

/// 検索対象期間（開始日・終了日、`yyyy-MM-dd`）。
class _DateRange {
  const _DateRange({required this.startDate, required this.finishDate});

  final String startDate;
  final String finishDate;
}

DateTime _dateOnly(DateTime dateTime) =>
    DateTime(dateTime.year, dateTime.month, dateTime.day);

_DateRange _buildDateRange(int lookaheadDays) {
  final today = _dateOnly(jstNow());
  final finish = today.add(Duration(days: lookaheadDays));
  return _DateRange(
    startDate: formatDateForApi(today),
    finishDate: formatDateForApi(finish),
  );
}

/// グループ内に登場する raceType を重複無く抽出する。
List<String> _distinctRaceTypes(List<TripGroupCourseEntity> courses) => [
  for (final raceType in {for (final course in courses) course.raceType})
    raceType,
];

/// 開催場情報が指定 course の開催（raceType・locationCode 一致）かどうか。
bool _isPlaceOfCourse(PlaceEntity place, TripGroupCourseEntity course) {
  if (place.raceType != course.raceType) {
    return false;
  }
  return place.locationCode == course.placeCode;
}

/// 指定 course に該当する開催場情報の JST 開催日一覧（昇順・重複なし）を作る。
List<String> _uniqueSortedDatesForCourse(
  List<PlaceEntity> places,
  TripGroupCourseEntity course,
) {
  final dates = <String>{};
  for (final place in places) {
    if (_isPlaceOfCourse(place, course)) {
      dates.add(toJstDateKey(parseJstDateTime(place.datetime)));
    }
  }
  final sorted = dates.toList()..sort();
  return sorted;
}

/// 旅程グループ候補日検出を front 側でローカル計算するリポジトリ実装。
///
/// もともとは専用の `GET /trip-group` エンドポイント（api）を呼んでいたが、
/// 「旅行のやつ、変な立ち位置だから api にあまり手を入れたくない」という
/// 判断のもと、既存の汎用エンドポイントのみを使い front 側でマッチングを
/// 計算する設計に変更した（マッチングアルゴリズム自体は `packages/core/
/// src/domain/service/tripMatchFinder.ts` と同一ロジックを
/// [findTripCandidates]（`domain/entities/trip_match_finder.dart`）へ
/// ポートしたもの）。候補日検出には開催日・会場・raceTypeのみで足り、
/// レース単位のフルデータ（出走表・レース名等）は不要なため、当初使って
/// いた `GET /race` より軽量な `GET /place`（[IPlaceRepository]）に
/// 切り替えた。1グループに複数raceTypeが混在しうるため、raceCourse名の
/// raceTypeをまたいだ衝突（例: 小倉はJRA/KEIRIN双方に存在）を避けるべく、
/// raceTypeごとに1回ずつfetchを呼び分ける。
class TripGroupRepositoryImpl implements ITripGroupRepository {
  TripGroupRepositoryImpl({required this.placeRepository});

  final IPlaceRepository placeRepository;

  @override
  Future<List<TripGroupEntity>> getAll({
    int? lookaheadDays,
    int? toleranceDays,
  }) async {
    final effectiveLookaheadDays = lookaheadDays ?? _defaultTripLookaheadDays;
    final effectiveToleranceDays = toleranceDays ?? _defaultTripToleranceDays;
    final range = _buildDateRange(effectiveLookaheadDays);

    final results = <TripGroupEntity>[];
    for (final group in tripGroupMasterList) {
      results.add(await _fetchGroup(group, range, effectiveToleranceDays));
    }
    return results;
  }

  Future<TripGroupEntity> _fetchGroup(
    TripGroupMasterEntry group,
    _DateRange range,
    int toleranceDays,
  ) async {
    final courseHeldDates = await _fetchCourseHeldDates(group.courses, range);
    if (group.courses.length == 1) {
      return TripGroupEntity(
        id: group.id,
        name: group.name,
        courses: group.courses,
        heldDates: courseHeldDates.first.dates,
      );
    }
    return TripGroupEntity(
      id: group.id,
      name: group.name,
      courses: group.courses,
      candidates: findTripCandidates(
        courseHeldDates,
        toleranceDays: toleranceDays,
      ),
    );
  }

  Future<List<CourseHeldDates>> _fetchCourseHeldDates(
    List<TripGroupCourseEntity> courses,
    _DateRange range,
  ) async {
    final raceTypes = _distinctRaceTypes(courses);
    final placesByType = await Future.wait(
      raceTypes.map(
        (raceType) => _fetchPlacesForType(raceType, courses, range),
      ),
    );
    final allPlaces = placesByType.expand((places) => places).toList();
    return [
      for (final course in courses)
        CourseHeldDates(
          course: course,
          dates: _uniqueSortedDatesForCourse(allPlaces, course),
        ),
    ];
  }

  Future<List<PlaceEntity>> _fetchPlacesForType(
    String raceType,
    List<TripGroupCourseEntity> courses,
    _DateRange range,
  ) {
    final locationList = [
      for (final course in courses)
        if (course.raceType == raceType) course.placeCode,
    ];
    return placeRepository.getPlacesByDateRange(
      startDate: range.startDate,
      finishDate: range.finishDate,
      raceTypeList: [raceType],
      locationList: locationList,
    );
  }
}
