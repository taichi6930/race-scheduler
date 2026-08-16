/// 公営競技の種別。
///
/// バックエンド（`packages/core/src/domain/model/valueObject/raceType.ts`）の
/// `RaceType` と対応する。API とのやり取りは小文字の [value] 文字列で行う。
enum RaceType {
  jra('jra'),
  nar('nar'),
  overseas('overseas'),
  keirin('keirin'),
  autorace('autorace'),
  boatrace('boatrace');

  const RaceType(this.value);

  /// API・永続化で使う正規の文字列表現。
  final String value;

  /// API レスポンス等の文字列から [RaceType] を解決する。
  /// 未知の値の場合は [ArgumentError] を送出する。
  static RaceType fromValue(String value) => RaceType.values.firstWhere(
    (type) => type.value == value.toLowerCase(),
    orElse: () => throw ArgumentError('Unknown raceType: $value'),
  );

  /// 全公営競技（ホーム画面の既定フィルタ・API横断取得に使う）。
  static const List<RaceType> all = RaceType.values;
}

/// UI上の「公営競技」区分（4種）。
///
/// [RaceType] は API 上の6区分（JRA/NAR/OVERSEAS/KEIRIN/AUTORACE/BOATRACE）だが、
/// フィルタ・設定画面では JRA/NAR/OVERSEAS をまとめて「競馬」として扱う
/// （screens.md §1.1-2・§5-3、Artifact プロトタイプの4アイコン構成に対応）。
enum Discipline {
  keiba('🐎', '競馬', {RaceType.jra, RaceType.nar, RaceType.overseas}),
  keirin('🚲', '競輪', {RaceType.keirin}),
  boatrace('🚤', '競艇', {RaceType.boatrace}),
  autorace('🏍', 'オートレース', {RaceType.autorace});

  const Discipline(this.emoji, this.label, this.raceTypes);

  final String emoji;
  final String label;
  final Set<RaceType> raceTypes;

  /// 永続化用の正規文字列（enum名そのもの）。
  String get value => name;

  /// [type] が属する [Discipline] を返す。
  static Discipline of(RaceType type) =>
      Discipline.values.firstWhere((d) => d.raceTypes.contains(type));

  /// 永続化された文字列から [Discipline] を解決する。
  /// 未知の値の場合は [ArgumentError] を送出する。
  static Discipline fromValue(String value) => Discipline.values.firstWhere(
    (d) => d.value == value,
    orElse: () => throw ArgumentError('Unknown discipline: $value'),
  );

  /// 永続化された文字列から [Discipline] を解決する。
  /// 未知の値（旧バージョンの残骸等）の場合は `null` を返す（QSTATE-01:
  /// 壊れた永続化値で起動そのものが失敗しないようにする。呼び出し側で
  /// 無視・フィルタする用途向け。未知値でも例外にしたい場合は [fromValue] を使う）。
  static Discipline? fromValueOrNull(String value) {
    for (final d in Discipline.values) {
      if (d.value == value) return d;
    }
    return null;
  }

  /// 全区分。
  static const List<Discipline> all = Discipline.values;
}
