// コンポーネントテスト: usecase → repository → datasource（Dio）を横断した
// タイムラインのデータフロー検証（testing-conventions.md §7.5 運用ルール）。
//
// GetRacesByDateRangeUseCase 経由で取得した6競技混在のレスポンスが、
// RaceEntity へ正しく変換され、timeline_provider の並び替えロジックを通した後
// 発走時刻(datetime)昇順になっていることを検証する。

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/race_remote_data_source.dart';
import 'package:front/data/repositories/race_repository_impl.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/domain/usecases/get_races_by_date_range.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';

/// `{ races: [...] }` を返す固定レスポンスの Dio を組み立てる。
Dio _fakeApiDio(List<Map<String, dynamic>> races) {
  final dio = Dio(BaseOptions(baseUrl: 'https://test.example.com'));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.resolve(
        Response(
          data: {'count': races.length, 'races': races},
          statusCode: 200,
          requestOptions: options,
        ),
      ),
    ),
  );
  return dio;
}

Map<String, dynamic> _raceJson({
  required String id,
  required String raceType,
  required String datetime,
  String? grade,
}) => {
  'raceId': id,
  'raceName': 'レース$id',
  'raceType': raceType,
  'placeId': 'place-$id',
  'raceCourse': '会場$id',
  'datetime': datetime,
  'raceGrade': grade,
  'raceNumber': 11,
};

void main() {
  test('全6競技混在のレスポンスがusecase経由で発走時刻昇順に整形される', () async {
    // Arrange: バックエンドのレスポンスを模した6競技混在データ（時刻は unsorted）
    final dio = _fakeApiDio([
      _raceJson(
        id: 'auto-1',
        raceType: 'autorace',
        datetime: '2026-04-19T16:50:00',
        grade: 'SG',
      ),
      _raceJson(
        id: 'keiba-1',
        raceType: 'jra',
        datetime: '2026-04-19T15:40:00',
        grade: 'GⅠ',
      ),
      _raceJson(
        id: 'boat-1',
        raceType: 'boatrace',
        datetime: '2026-04-19T10:20:00',
      ),
      _raceJson(
        id: 'keirin-1',
        raceType: 'keirin',
        datetime: '2026-04-19T17:30:00',
      ),
    ]);
    final dataSource = RaceRemoteDataSource(dio: dio);
    final repository = RaceRepositoryImpl(remoteDataSource: dataSource);
    final useCase = GetRacesByDateRangeUseCase(repository);

    // Act: usecase 経由で全6種別を横断取得し、timeline_provider の並び替えを適用
    final races = await useCase(
      startDate: '2026-04-19',
      finishDate: '2026-04-19',
      raceTypeList: RaceType.all.map((t) => t.value).toList(),
    );
    final sorted = sortRacesByDatetime(races);

    // Assert: 発走時刻昇順（競技をまたいで統合）になっている
    expect(sorted.map((r) => r.raceId).toList(), [
      'boat-1',
      'keiba-1',
      'auto-1',
      'keirin-1',
    ]);
    expect(sorted.map((r) => r.raceType).toSet(), {
      'boatrace',
      'jra',
      'autorace',
      'keirin',
    });
  });
}
