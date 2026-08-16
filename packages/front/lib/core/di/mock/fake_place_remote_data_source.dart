import '../../../data/datasources/place_remote_data_source.dart';
import '../../../data/models/place_model.dart';
import 'mock_network_delay.dart';
import 'mock_race_fixtures.dart';

/// バックエンドに接続せず、固定生成データのみで動作する [IPlaceRemoteDataSource]。
///
/// モックモード専用。旅程グループ候補日検出（front側でローカル計算）が
/// 参照する開催会場一覧を返す。
class FakePlaceRemoteDataSource implements IPlaceRemoteDataSource {
  FakePlaceRemoteDataSource({MockScheduleGenerator? generator})
    : _places = (generator ?? MockScheduleGenerator()).generatePlaces(
        startOffset: -30,
        endOffset: 60,
      );

  final List<MockPlaceFixture> _places;

  @override
  Future<List<PlaceModel>> getPlacesByDateRange({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
    List<String>? locationList,
    List<String>? gradeList,
    bool? isDisplayPlaceHeldDays,
    bool? isDisplayPlaceGrade,
  }) async {
    await mockNetworkDelay();
    final start = DateTime.parse(startDate);
    final finishExclusive = DateTime.parse(
      finishDate,
    ).add(const Duration(days: 1));
    return _places
        .where(
          (place) =>
              !place.dateTime.isBefore(start) &&
              place.dateTime.isBefore(finishExclusive) &&
              raceTypeList.contains(place.raceType.value),
        )
        .map((place) => place.toPlaceModel())
        .toList();
  }
}
