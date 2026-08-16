/// 日本の祝日判定（「国民の祝日に関する法律」の現行制度に基づく実装）。
///
/// 対象範囲は2016年（山の日 施行年）〜2099年（春分・秋分の近似計算式が
/// 有効な範囲）。この範囲外の日付は常に false を返す。
///
/// 天皇の代替わり等に伴う一度限りの祝日（即位の日 2019-05-01・
/// 即位礼正殿の儀 2019-10-22）や、東京オリンピック特例による海の日・
/// スポーツの日・山の日の一時的な移動（2020年・2021年）は反映していない。
/// 本アプリはレーススケジュールカレンダーであり、法改正以前の一時的な
/// 祝日移動まで追従する必要性は低いと判断したスコープ外。
library;

const _minSupportedYear = 2016;
const _maxSupportedYear = 2099;

/// [date] が日本の祝日（振替休日・国民の休日を含む）かどうかを判定する。
bool isJapaneseHoliday(DateTime date) {
  final year = date.year;
  if (year < _minSupportedYear || year > _maxSupportedYear) return false;

  final normalized = DateTime(date.year, date.month, date.day);
  final holidays = _holidaySetForYear(year);
  return holidays.contains(normalized);
}

/// [year]の祝日一覧（基本の祝日＋国民の休日＋振替休日）を求める。
Set<DateTime> _holidaySetForYear(int year) {
  final base = _baseHolidaysOf(year);
  final withNationalHoliday = _withNationalHolidaySandwich(base);
  return _withSubstituteHolidays(withNationalHoliday);
}

DateTime _d(int year, int month, int day) => DateTime(year, month, day);

/// 春分の日（近似式。1980年〜2099年の範囲で有効）。
int _vernalEquinoxDay(int year) {
  final base = (20.8431 + 0.242194 * (year - 1980)).floor();
  return base - ((year - 1980) / 4).floor();
}

/// 秋分の日（近似式。1980年〜2099年の範囲で有効）。
int _autumnalEquinoxDay(int year) {
  final base = (23.2488 + 0.242194 * (year - 1980)).floor();
  return base - ((year - 1980) / 4).floor();
}

/// [year]年[month]月の第[nth][weekday]曜日（ハッピーマンデー対象の祝日用）。
DateTime _nthWeekdayOfMonth(int year, int month, int weekday, int nth) {
  final firstOfMonth = DateTime(year, month, 1);
  final offsetToFirstWeekday = (weekday - firstOfMonth.weekday) % 7;
  return firstOfMonth.add(
    Duration(days: offsetToFirstWeekday + 7 * (nth - 1)),
  );
}

/// 振替休日・国民の休日を含まない、固定日＋計算日の祝日一覧。
Set<DateTime> _baseHolidaysOf(int year) => {
  _d(year, 1, 1), // 元日
  _nthWeekdayOfMonth(year, 1, DateTime.monday, 2), // 成人の日
  _d(year, 2, 11), // 建国記念の日
  if (year >= 2020) _d(year, 2, 23) else _d(year, 12, 23), // 天皇誕生日
  _d(year, 3, _vernalEquinoxDay(year)), // 春分の日
  _d(year, 4, 29), // 昭和の日
  _d(year, 5, 3), // 憲法記念日
  _d(year, 5, 4), // みどりの日
  _d(year, 5, 5), // こどもの日
  _nthWeekdayOfMonth(year, 7, DateTime.monday, 3), // 海の日
  _d(year, 8, 11), // 山の日
  _nthWeekdayOfMonth(year, 9, DateTime.monday, 3), // 敬老の日
  _d(year, 9, _autumnalEquinoxDay(year)), // 秋分の日
  _nthWeekdayOfMonth(year, 10, DateTime.monday, 2), // スポーツの日
  _d(year, 11, 3), // 文化の日
  _d(year, 11, 23), // 勤労感謝の日
};

/// 「国民の休日」（祝日と祝日に挟まれた、それ自体は祝日でも日曜日でもない日）
/// を[base]に加える。
Set<DateTime> _withNationalHolidaySandwich(Set<DateTime> base) {
  final sandwiched = <DateTime>{};
  for (final holiday in base) {
    final between = holiday.add(const Duration(days: 1));
    final afterBetween = between.add(const Duration(days: 1));
    if (base.contains(afterBetween) &&
        !base.contains(between) &&
        between.weekday != DateTime.sunday) {
      sandwiched.add(between);
    }
  }
  return {...base, ...sandwiched};
}

/// 日曜日と重なった祝日を、翌日以降で最初に祝日でない日へ振り替える。
Set<DateTime> _withSubstituteHolidays(Set<DateTime> holidays) {
  final substitutes = <DateTime>{};
  for (final holiday in holidays) {
    if (holiday.weekday != DateTime.sunday) continue;
    var candidate = holiday.add(const Duration(days: 1));
    while (holidays.contains(candidate) || substitutes.contains(candidate)) {
      candidate = candidate.add(const Duration(days: 1));
    }
    substitutes.add(candidate);
  }
  return {...holidays, ...substitutes};
}
