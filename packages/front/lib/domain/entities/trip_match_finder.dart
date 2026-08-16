import 'trip_candidate_period_entity.dart';
import 'trip_group_course_entity.dart';

/// 1 会場が検索期間内に開催を持つ日付（JST 暦日、YYYY-MM-DD）。
///
/// バックエンド（`packages/core/src/domain/service/tripMatchFinder.ts`）の
/// `CourseHeldDates` と対応する。
class CourseHeldDates {
  const CourseHeldDates({required this.course, required this.dates});

  final TripGroupCourseEntity course;
  final List<String> dates;
}

const int _msPerDay = 24 * 60 * 60 * 1000;

/// [DateTime]（`parseJstDateTime` 等でJST壁時計表現に正規化済みのもの）から
/// JST 暦日キー（YYYY-MM-DD）を作る。
String toJstDateKey(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}

/// courseHeldDates のグルーピング・重複排除に使う一意キー。
String _courseKey(TripGroupCourseEntity course) =>
    '${course.raceType}:${course.placeCode}';

/// JST 暦日キー（YYYY-MM-DD、JST 深夜0時基準）を比較可能なタイムスタンプへ変換する。
int _dateKeyToTimestamp(String dateKey) =>
    DateTime.parse('${dateKey}T00:00:00+09:00').millisecondsSinceEpoch;

/// 1 会場・1 開催日分のエントリ。
class _DatedCourseEntry {
  const _DatedCourseEntry({required this.course, required this.date});

  final TripGroupCourseEntity course;
  final String date;
}

/// 全 course × dates のペアをフラット化し、日付昇順にソートする。
List<_DatedCourseEntry> _flattenAndSortEntries(
  List<CourseHeldDates> courseHeldDates,
) {
  final entries = <_DatedCourseEntry>[
    for (final held in courseHeldDates)
      for (final date in held.dates)
        _DatedCourseEntry(course: held.course, date: date),
  ];
  entries.sort(
    (a, b) =>
        _dateKeyToTimestamp(a.date).compareTo(_dateKeyToTimestamp(b.date)),
  );
  return entries;
}

/// 直前に採用したタイムスタンプとの差が [toleranceDays] を超えるか判定する。
/// 直前が無い（先頭要素）場合は常に false（新しいクラスタを開始しない）。
bool _exceedsTolerance(int? lastTimestamp, int timestamp, int toleranceDays) {
  if (lastTimestamp == null) {
    return false;
  }
  final gapDays = (timestamp - lastTimestamp) / _msPerDay;
  return gapDays > toleranceDays;
}

/// ソート済みエントリを「連結成分」としてクラスタリングする。
/// 直前に採用した日付との差が [toleranceDays] を超えたら新しいクラスタを開始する。
List<List<_DatedCourseEntry>> _clusterEntries(
  List<_DatedCourseEntry> entries,
  int toleranceDays,
) {
  final clusters = <List<_DatedCourseEntry>>[];
  var current = <_DatedCourseEntry>[];
  int? lastTimestamp;

  for (final entry in entries) {
    final timestamp = _dateKeyToTimestamp(entry.date);
    if (_exceedsTolerance(lastTimestamp, timestamp, toleranceDays)) {
      clusters.add(current);
      current = [];
    }
    current.add(entry);
    lastTimestamp = timestamp;
  }
  if (current.isNotEmpty) {
    clusters.add(current);
  }
  return clusters;
}

/// クラスタ内のエントリを会場ごとの開催日一覧へ集約する（日付は昇順・重複なし）。
List<TripCandidateCourseEntity> _groupClusterByCourse(
  List<_DatedCourseEntry> cluster,
) {
  final courseByKey = <String, TripGroupCourseEntity>{};
  final datesByKey = <String, List<String>>{};
  for (final entry in cluster) {
    final key = _courseKey(entry.course);
    final dates = datesByKey.putIfAbsent(key, () => []);
    courseByKey.putIfAbsent(key, () => entry.course);
    if (!dates.contains(entry.date)) {
      dates.add(entry.date);
    }
  }
  return [
    for (final key in courseByKey.keys)
      TripCandidateCourseEntity(
        course: courseByKey[key]!,
        dates: datesByKey[key]!..sort(),
      ),
  ];
}

/// 1 クラスタを候補期間へ変換する。2 種類以上の異なる course が含まれない
/// （同じ会場が連日開催しているだけの）クラスタは候補として採用しない。
TripCandidatePeriodEntity? _toCandidatePeriod(
  List<_DatedCourseEntry> cluster,
) {
  final courses = _groupClusterByCourse(cluster);
  if (courses.length < 2) {
    return null;
  }
  final sortedDates = [for (final entry in cluster) entry.date]..sort();
  return TripCandidatePeriodEntity(
    startDate: sortedDates.first,
    endDate: sortedDates.last,
    courses: courses,
  );
}

/// 2 会場以上のグループについて、候補期間（複数会場の開催が [toleranceDays] 以内に
/// 収まるクラスタ）を検出する純関数。
///
/// バックエンド（`packages/core/src/domain/service/tripMatchFinder.ts`）の
/// `findTripCandidates` と同一ロジックのfront側ポート。「旅行のやつ、変な
/// 立ち位置だから api にあまり手を入れたくない」という判断のもと、api の
/// 専用エンドポイント（`GET /trip-group`）を廃止しfront側でローカル計算する
/// 設計に変更した際に移設した。
/// @param courseHeldDates グループ内の各 course の開催日一覧
/// @param toleranceDays 「連日」とみなす最大日数差（デフォルト 2）
/// @returns 2 会場以上が関与する候補期間のみ（1 会場だけのクラスタは除外）。1 件も無ければ空配列
List<TripCandidatePeriodEntity> findTripCandidates(
  List<CourseHeldDates> courseHeldDates, {
  int toleranceDays = 2,
}) {
  final entries = _flattenAndSortEntries(courseHeldDates);
  final clusters = _clusterEntries(entries, toleranceDays);
  final candidates = <TripCandidatePeriodEntity>[];
  for (final cluster in clusters) {
    final candidate = _toCandidatePeriod(cluster);
    if (candidate != null) {
      candidates.add(candidate);
    }
  }
  return candidates;
}
