import 'race_type.dart';

/// レースのグレード重要度階層。
///
/// 開催盤の配色は「競技」ではなく「グレード」の重要度だけに意味を持たせる
/// （design-system.md §2.2）。並び順は design-system.md の tier 番号（1〜4, 0）に対応する。
enum GradeTier {
  /// tier 1: 最高峰（SG・GP・GⅠ 等）
  top,

  /// tier 2: 上位重賞（GⅡ 等）
  high,

  /// tier 3: 重賞（GⅢ 等）
  mid,

  /// tier 4: 準重賞・特別（Listed・オープン・全プロ競輪(FⅡ例外) 等）
  low,

  /// tier 0: 無印（一般競走）
  none,
}

class _GradeEntry {
  const _GradeEntry(this.tier, this.isSpecified);

  final GradeTier tier;
  final bool isSpecified;
}

/// (raceType, gradeName) -> (階層, 重賞フラグ) の対応表。
///
/// `packages/core/src/domain/master/gradeMaster.ts` の `GradeMasterList`
/// （`gradeName` × `raceType` × `isSpecified`）を単一の正典とし、
/// front(Dart) 用に手動で同期した静的テーブル。バックエンドのグレードマスタが
/// 変更された場合は、このテーブルも追従させること。
///
/// tier（重要度の見た目階層）は design-system.md §2.2 の定義に基づく front 側の
/// 判断であり、バックエンドには対応する数値フィールドはない。
const Map<RaceType, Map<String, _GradeEntry>> _gradeTable = {
  RaceType.jra: {
    'GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅡ': _GradeEntry(GradeTier.high, true),
    'GⅢ': _GradeEntry(GradeTier.mid, true),
    'JpnⅠ': _GradeEntry(GradeTier.top, true),
    'JpnⅡ': _GradeEntry(GradeTier.high, true),
    'JpnⅢ': _GradeEntry(GradeTier.mid, true),
    'J.GⅠ': _GradeEntry(GradeTier.top, true),
    'J.GⅡ': _GradeEntry(GradeTier.high, true),
    'J.GⅢ': _GradeEntry(GradeTier.mid, true),
    'Listed': _GradeEntry(GradeTier.low, true),
    '重賞': _GradeEntry(GradeTier.low, true),
    'オープン特別': _GradeEntry(GradeTier.low, true),
    '格付けなし': _GradeEntry(GradeTier.none, false),
    'オープン': _GradeEntry(GradeTier.low, true),
    '3勝クラス': _GradeEntry(GradeTier.none, false),
    '2勝クラス': _GradeEntry(GradeTier.none, false),
    '1勝クラス': _GradeEntry(GradeTier.none, false),
    '1600万下': _GradeEntry(GradeTier.none, false),
    '1000万下': _GradeEntry(GradeTier.none, false),
    '900万下': _GradeEntry(GradeTier.none, false),
    '500万下': _GradeEntry(GradeTier.none, false),
    '未勝利': _GradeEntry(GradeTier.none, false),
    '未出走': _GradeEntry(GradeTier.none, false),
    '新馬': _GradeEntry(GradeTier.none, false),
  },
  RaceType.nar: {
    'GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅡ': _GradeEntry(GradeTier.high, true),
    'GⅢ': _GradeEntry(GradeTier.mid, true),
    'JpnⅠ': _GradeEntry(GradeTier.top, true),
    'JpnⅡ': _GradeEntry(GradeTier.high, true),
    'JpnⅢ': _GradeEntry(GradeTier.mid, true),
    'Listed': _GradeEntry(GradeTier.low, true),
    '重賞': _GradeEntry(GradeTier.low, true),
    '地方重賞': _GradeEntry(GradeTier.low, true),
    '地方準重賞': _GradeEntry(GradeTier.low, true),
    'オープン特別': _GradeEntry(GradeTier.low, true),
    'オープン': _GradeEntry(GradeTier.low, true),
    '格付けなし': _GradeEntry(GradeTier.none, false),
    '未格付': _GradeEntry(GradeTier.none, false),
    '一般': _GradeEntry(GradeTier.none, false),
  },
  RaceType.overseas: {
    'GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅡ': _GradeEntry(GradeTier.high, true),
    'GⅢ': _GradeEntry(GradeTier.mid, true),
    'Listed': _GradeEntry(GradeTier.low, true),
    '格付けなし': _GradeEntry(GradeTier.none, true),
  },
  RaceType.keirin: {
    'GP': _GradeEntry(GradeTier.top, true),
    'GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅡ': _GradeEntry(GradeTier.high, true),
    'GⅢ': _GradeEntry(GradeTier.mid, true),
    // FⅠ・FⅡは平場（無印）。ただし「全プロ競輪」のみ例外的に重賞相当
    // として扱う（_keirinZenproSpecifiedStages 参照）。
    'FⅠ': _GradeEntry(GradeTier.none, false),
    'FⅡ': _GradeEntry(GradeTier.none, false),
  },
  RaceType.autorace: {
    'SG': _GradeEntry(GradeTier.top, true),
    '特GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅠ': _GradeEntry(GradeTier.top, true),
    'GⅡ': _GradeEntry(GradeTier.high, true),
    '開催': _GradeEntry(GradeTier.none, false),
  },
  RaceType.boatrace: {
    'SG': _GradeEntry(GradeTier.top, true),
    'PGⅠ': _GradeEntry(GradeTier.top, true),
    'GⅠ': _GradeEntry(GradeTier.high, false),
    'GⅡ': _GradeEntry(GradeTier.mid, false),
    'GⅢ': _GradeEntry(GradeTier.mid, false),
    '一般': _GradeEntry(GradeTier.none, false),
  },
};

/// KEIRIN「全プロ競輪」の特有ステージ名（grade は FⅡ だが例外的に重賞相当）。
///
/// `packages/core/src/domain/policy/calendarInclusion.ts` の
/// `KEIRIN_ZENPRO_SPECIFIED_STAGES` を単一の正典とし、front(Dart) 用に
/// 手動で同期した静的テーブル。バックエンドが変更された場合はこちらも
/// 追従させること。
const _keirinZenproSpecifiedStages = {
  'S級スーパープロピストレーサー賞',
  'S級ダイナミックステージ',
  'S級ワンダーステージ',
  'S級優秀',
  'S級特別優秀',
  'S級特選',
  'S級選抜',
};

/// KEIRIN の「全プロ競輪」例外ステージ（grade=FⅡ）かどうかを判定する。
bool _isKeirinZenproSpecifiedStage(
  RaceType raceType,
  String grade,
  String? stage,
) =>
    raceType == RaceType.keirin &&
    grade == 'FⅡ' &&
    stage != null &&
    _keirinZenproSpecifiedStages.contains(stage);

/// grade（+全プロ競輪ステージ例外）から、そのレースの重要度階層を判定する。
/// 未知の grade・null・空文字は [GradeTier.none] を返す。
/// [stage] は KEIRIN の全プロ競輪例外判定にのみ使用する（省略可）。
GradeTier gradeTierOf(RaceType raceType, String? grade, [String? stage]) {
  if (grade == null || grade.isEmpty) return GradeTier.none;
  if (_isKeirinZenproSpecifiedStage(raceType, grade, stage)) {
    return GradeTier.low;
  }
  return _gradeTable[raceType]?[grade]?.tier ?? GradeTier.none;
}

/// grade（+全プロ競輪ステージ例外）が「重賞（指定レース）」として扱われるか
/// どうかを判定する。「重賞のみ」フィルタ（既定 ON）の判定に使う
/// （design-system.md §2.2）。
///
/// バックエンド（`GET /race`）は `RaceEntity.isCalendarSpecified` として、
/// グレードに加えKEIRIN/AUTORACE/BOATRACEはステージ優先度（負け戦除外）も
/// 加味した、より精密な判定を計算済みで返す。この関数はgrade単体のみで
/// 判定する簡易フォールバックであり、両者は完全には一致しない
/// （例: KEIRINのGⅠでも優先度の低いステージはAPI側ではfalseになるが、
/// この関数はgradeがisSpecifiedであればtrueを返す）。
/// 呼び出し側はまずAPI値を優先し（`race.isCalendarSpecified ??
/// isCalendarSpecifiedGrade(...)`）、この関数は値が無い場合
/// （手動生成したエンティティ等）のフォールバックとして使うこと。
/// [stage] は KEIRIN の全プロ競輪例外判定にのみ使用する（省略可）。
bool isCalendarSpecifiedGrade(
  RaceType raceType,
  String? grade, [
  String? stage,
]) {
  if (grade == null || grade.isEmpty) return false;
  if (_isKeirinZenproSpecifiedStage(raceType, grade, stage)) return true;
  return _gradeTable[raceType]?[grade]?.isSpecified ?? false;
}

/// [raceType] において [tier] 階層に属する、重賞（isSpecified）のグレード名
/// 一覧（テーブル定義順）。[GradeTierChipsBar] のラベル生成に使う
/// （例: ボートレースの最高峰は「GⅠ」ではなく「SG」「PGⅠ」であり、単一の
/// 「GⅠ」ラベルだけでは競技によって階層が異なることが伝わらないため）。
List<String> specifiedGradeNamesOfTier(RaceType raceType, GradeTier tier) => [
  for (final entry in (_gradeTable[raceType] ?? const {}).entries)
    if (entry.value.tier == tier && entry.value.isSpecified) entry.key,
];
