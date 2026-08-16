import '../../../data/models/place_model.dart';
import '../../../data/models/race_model.dart';
import '../../../domain/entities/race_type.dart';

/// フロントエンド単体プレビュー（モックモード）用の1件分の生成元データ。
///
/// バックエンド（`packages/api`）に一切接続せず、`FakeRaceRemoteDataSource` /
/// `FakePlaceRemoteDataSource` がこのデータから [RaceModel] / [PlaceModel] を
/// 組み立てる。PRレビュー時に `flutter run -t lib/main_mock.dart` で
/// 実際のデータ流れ（フィルタ・お気に入り・カレンダー集計等）込みで画面を
/// すぐ確認できるようにするための固定データ生成器。
class MockVenueTemplate {
  const MockVenueTemplate({
    required this.raceType,
    required this.raceCourse,
    required this.locationCode,
    required this.namePrefix,
    required this.featureRaceNames,
  });

  final RaceType raceType;
  final String raceCourse;
  final String locationCode;

  /// 平場レース名の接頭辞（例: 「東京」→「東京特別」）。
  final String namePrefix;

  /// この会場で開催される重賞級レース名の候補（周期的に登場させる）。
  final List<String> featureRaceNames;
}

/// 8会場（6競技）を横断する固定テンプレート。
///
/// 「高知」（nar）と「高知」（keirin）はコース名・[locationCode] を
/// `trip_group_master.dart` の `kochi` グループ（placeCode 31/74）と
/// 一致させてあり、モックモードでも旅程グループ候補日検出のデモが機能する。
const List<MockVenueTemplate> mockVenueTemplates = [
  MockVenueTemplate(
    raceType: RaceType.jra,
    raceCourse: '東京',
    locationCode: 'jra-tokyo',
    namePrefix: '府中',
    featureRaceNames: ['東京優駿（日本ダービー）', 'ジャパンカップ', '安田記念'],
  ),
  MockVenueTemplate(
    raceType: RaceType.jra,
    raceCourse: '中山',
    locationCode: 'jra-nakayama',
    namePrefix: '中山',
    featureRaceNames: ['皐月賞', '有馬記念', '中山記念'],
  ),
  MockVenueTemplate(
    raceType: RaceType.nar,
    raceCourse: '高知',
    locationCode: '31',
    namePrefix: '土佐',
    featureRaceNames: ['黒潮菊花賞', '高知記念'],
  ),
  MockVenueTemplate(
    raceType: RaceType.keirin,
    raceCourse: '高知',
    locationCode: '74',
    namePrefix: '土佐',
    featureRaceNames: ['高知記念', 'ふるさとダービー'],
  ),
  MockVenueTemplate(
    raceType: RaceType.nar,
    raceCourse: '大井',
    locationCode: 'nar-ooi',
    namePrefix: '大井',
    featureRaceNames: ['東京大賞典', '帝王賞'],
  ),
  MockVenueTemplate(
    raceType: RaceType.autorace,
    raceCourse: '川口',
    locationCode: 'autorace-kawaguchi',
    namePrefix: '川口',
    featureRaceNames: ['スーパースター王座決定戦', '川口記念'],
  ),
  MockVenueTemplate(
    raceType: RaceType.boatrace,
    raceCourse: '戸田',
    locationCode: 'boatrace-toda',
    namePrefix: '戸田',
    featureRaceNames: ['SGボートレースクラシック', '戸田記念'],
  ),
  MockVenueTemplate(
    raceType: RaceType.keirin,
    raceCourse: '京王閣',
    locationCode: 'keirin-keioukaku',
    namePrefix: '京王閣',
    featureRaceNames: ['寛仁親王牌', '京王閣記念'],
  ),
];

/// [raceType] ごとの「重賞級」グレード表記（design/grade_tier.dartのテーブルに準拠）。
const Map<RaceType, List<String>> _gradeCycle = {
  RaceType.jra: ['GⅠ', 'GⅡ', 'GⅢ'],
  RaceType.nar: ['JpnⅠ', '地方重賞', '地方準重賞'],
  RaceType.keirin: ['GⅠ', 'GⅡ', 'GⅢ'],
  RaceType.autorace: ['SG', 'GⅠ', 'GⅡ'],
  RaceType.boatrace: ['SG', 'PGⅠ', 'GⅠ'],
  RaceType.overseas: ['GⅠ', 'GⅡ', 'GⅢ'],
};

/// [raceType] の平場グレード表記（重賞に該当しない一般競走）。
const Map<RaceType, String> _plainGrade = {
  RaceType.jra: '1勝クラス',
  RaceType.nar: '一般',
  RaceType.keirin: 'FⅠ',
  RaceType.autorace: '開催',
  RaceType.boatrace: '一般',
  RaceType.overseas: '格付けなし',
};

/// モック用に生成した1レース分のデータ（[RaceModel] 変換前の中間表現）。
class MockRaceFixture {
  const MockRaceFixture({
    required this.raceId,
    required this.raceName,
    required this.raceType,
    required this.placeId,
    required this.raceCourse,
    required this.locationCode,
    required this.dateTime,
    required this.raceGrade,
    required this.raceNumber,
    required this.isCalendarSpecified,
  });

  final String raceId;
  final String raceName;
  final RaceType raceType;
  final String placeId;
  final String raceCourse;
  final String locationCode;
  final DateTime dateTime;
  final String? raceGrade;
  final int raceNumber;
  final bool isCalendarSpecified;

  RaceModel toRaceModel() => RaceModel(
    raceId: raceId,
    raceName: raceName,
    raceType: raceType.value,
    placeId: placeId,
    raceCourse: raceCourse,
    datetime: dateTime.toIso8601String(),
    raceGrade: raceGrade,
    raceNumber: raceNumber,
    locationCode: locationCode,
    isCalendarSpecified: isCalendarSpecified,
  );
}

/// モック用に生成した1会場・1日分の開催データ（[PlaceModel] 変換前の中間表現）。
class MockPlaceFixture {
  const MockPlaceFixture({
    required this.placeId,
    required this.raceType,
    required this.raceCourse,
    required this.locationCode,
    required this.dateTime,
    required this.placeGrade,
  });

  final String placeId;
  final RaceType raceType;
  final String raceCourse;
  final String locationCode;
  final DateTime dateTime;
  final String? placeGrade;

  PlaceModel toPlaceModel() => PlaceModel(
    placeId: placeId,
    raceType: raceType.value,
    raceCourse: raceCourse,
    locationCode: locationCode,
    datetime: dateTime.toIso8601String(),
    placeGrade: placeGrade,
    isRaceListAvailable: true,
  );
}

/// [anchor] を基準に、開催中の会場・レース・グレードを決定論的に組み立てる
/// （同一プロセス内では同じ入力に対し常に同じ結果を返す）。
class MockScheduleGenerator {
  MockScheduleGenerator({DateTime? anchor}) : anchor = anchor ?? DateTime.now();

  final DateTime anchor;

  DateTime get _anchorDate => DateTime(anchor.year, anchor.month, anchor.day);

  /// [dayOffset]（[_anchorDate] からの日数差）にその会場が開催しているかどうか。
  ///
  /// 会場ごとに周期（2〜4日おき）をずらし、日によって開催会場の組み合わせが
  /// 変わるようにする（カレンダー月表示・旅程グループ検出のデモに厚みを出す）。
  bool _isVenueActive(int templateIndex, int dayOffset) {
    final cycle = 2 + (templateIndex % 3);
    final phase = templateIndex;
    return (dayOffset + phase) % cycle == 0;
  }

  /// [dayOffset] 日目にその会場が開催する場合の、レース数（8〜11レース）。
  int _raceCountFor(int templateIndex, int dayOffset) =>
      8 + (templateIndex + dayOffset).abs() % 4;

  /// [dayOffset] 日目のその会場の目玉レースのグレード（無い日もある）。
  ///
  /// 10日周期でGⅠ級、3日周期でGⅢ級、それ以外は平場のみとし、実際の開催
  /// カレンダーに近い「重賞は時々」という分布を作る。
  String? _featureGradeFor(RaceType raceType, int dayOffset) {
    final cycle = _gradeCycle[raceType]!;
    if (dayOffset % 10 == 0) return cycle[0];
    if (dayOffset % 5 == 0) return cycle[1];
    if (dayOffset % 3 == 0) return cycle[2];
    return null;
  }

  /// [startOffset]〜[endOffset]（[_anchorDate] からの日数、負値は過去）の
  /// 範囲で開催中の全レースを生成する。
  List<MockRaceFixture> generateRaces({
    required int startOffset,
    required int endOffset,
  }) {
    final races = <MockRaceFixture>[];
    for (var dayOffset = startOffset; dayOffset <= endOffset; dayOffset++) {
      final date = _anchorDate.add(Duration(days: dayOffset));
      for (var t = 0; t < mockVenueTemplates.length; t++) {
        final template = mockVenueTemplates[t];
        if (!_isVenueActive(t, dayOffset)) continue;

        final raceCount = _raceCountFor(t, dayOffset);
        final featureGrade = _featureGradeFor(template.raceType, dayOffset);
        final featureName =
            template.featureRaceNames[dayOffset.abs() %
                template.featureRaceNames.length];
        final placeId = 'mock-${template.locationCode}-$dayOffset';

        for (var raceNumber = 1; raceNumber <= raceCount; raceNumber++) {
          final isFeature = raceNumber == raceCount && featureGrade != null;
          final startMinutes = 10 * 60 + (raceNumber - 1) * 35;
          final raceTime = date.add(
            Duration(hours: startMinutes ~/ 60, minutes: startMinutes % 60),
          );
          races.add(
            MockRaceFixture(
              raceId: '$placeId-r$raceNumber',
              raceName: isFeature
                  ? featureName
                  : '${template.namePrefix}${_plainRaceSuffix(raceNumber)}',
              raceType: template.raceType,
              placeId: placeId,
              raceCourse: template.raceCourse,
              locationCode: template.locationCode,
              dateTime: raceTime,
              raceGrade: isFeature
                  ? featureGrade
                  : _plainGrade[template.raceType],
              raceNumber: raceNumber,
              isCalendarSpecified: isFeature,
            ),
          );
        }
      }
    }
    return races;
  }

  /// [startOffset]〜[endOffset] の範囲で開催中の会場一覧を生成する
  /// （旅程グループ候補日検出・`GET /place` 相当）。
  List<MockPlaceFixture> generatePlaces({
    required int startOffset,
    required int endOffset,
  }) {
    final places = <MockPlaceFixture>[];
    for (var dayOffset = startOffset; dayOffset <= endOffset; dayOffset++) {
      final date = _anchorDate.add(Duration(days: dayOffset));
      for (var t = 0; t < mockVenueTemplates.length; t++) {
        final template = mockVenueTemplates[t];
        if (!_isVenueActive(t, dayOffset)) continue;

        final featureGrade = _featureGradeFor(template.raceType, dayOffset);
        places.add(
          MockPlaceFixture(
            placeId: 'mock-${template.locationCode}-$dayOffset',
            raceType: template.raceType,
            raceCourse: template.raceCourse,
            locationCode: template.locationCode,
            dateTime: date,
            placeGrade: featureGrade,
          ),
        );
      }
    }
    return places;
  }
}

const _plainRaceSuffixes = ['特別', 'ステークス', '短距離ハンデ', '未勝利戦', '新馬戦'];

String _plainRaceSuffix(int raceNumber) =>
    _plainRaceSuffixes[raceNumber % _plainRaceSuffixes.length];
