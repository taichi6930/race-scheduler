import 'grade_tier.dart';
import 'race_type.dart';

/// タイムラインの絞り込みチップの種別。
enum TimelineFilterMode {
  /// 重賞のみ（design-system.md §2.2 の isSpecified 判定）。
  grade,

  /// お気に入りのみ。
  favorite,
}

/// タイムラインのフィルタ状態（重賞のみ／お気に入り／階層・区分・競走場）。
///
/// 「対象の公営競技」は設定画面（`settingsProvider`）の値と連動・永続化する
/// ため、ここには持たせない（screens.md §1.2）。それ以外の絞り込み条件は
/// `TimelineFilterNotifier` が `shared_preferences` に永続化し、アプリを
/// 終了・再起動しても直前の状態を復元する。
///
/// [gradeOnly]・[favoriteOnly] は独立にON/OFFできる（排他ではない）。
/// 両方ONの場合は「重賞 または お気に入り」のOR結合で表示する。
///
/// [gradeTiers]・[keibaTypes]・[venues] は、上記のOR結合とは独立した
/// 絞り込み軸（`enabledDisciplines` と同じくAND条件）。空集合は「絞り込み
/// なし」を意味する。
class TimelineFilterState {
  const TimelineFilterState({
    this.gradeOnly = false,
    this.favoriteOnly = false,
    this.gradeTiers = const {},
    this.keibaTypes = const {},
    this.venues = const {},
  });

  /// 「重賞のみ」チップがONか。
  final bool gradeOnly;

  /// 「お気に入り」チップがONか。
  final bool favoriteOnly;

  /// [gradeOnly] ON時にさらに絞り込む階層（GⅠ/GⅡ/GⅢ）。空集合なら絞り込みなし。
  final Set<GradeTier> gradeTiers;

  /// 「競馬」に含まれるJRA/NAR/海外のうち表示対象とする種別。空集合なら絞り込みなし。
  final Set<RaceType> keibaTypes;

  /// 表示対象とする競走場（`RaceEntity.raceCourse`）。空集合なら絞り込みなし。
  final Set<String> venues;

  TimelineFilterState copyWith({
    bool? gradeOnly,
    bool? favoriteOnly,
    Set<GradeTier>? gradeTiers,
    Set<RaceType>? keibaTypes,
    Set<String>? venues,
  }) {
    return TimelineFilterState(
      gradeOnly: gradeOnly ?? this.gradeOnly,
      favoriteOnly: favoriteOnly ?? this.favoriteOnly,
      gradeTiers: gradeTiers ?? this.gradeTiers,
      keibaTypes: keibaTypes ?? this.keibaTypes,
      venues: venues ?? this.venues,
    );
  }
}
