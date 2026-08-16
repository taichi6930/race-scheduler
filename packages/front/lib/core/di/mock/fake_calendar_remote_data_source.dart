import '../../../data/datasources/calendar_remote_data_source.dart';
import '../../../data/models/calendar_race_model.dart';
import 'mock_network_delay.dart';

/// バックエンドに接続しない [ICalendarRemoteDataSource]。
///
/// 現状 UI から呼び出されていない（DI登録のみ）ため空リストで十分だが、
/// モックモードでも呼び出し自体はエラーにならないようにしておく。
class FakeCalendarRemoteDataSource implements ICalendarRemoteDataSource {
  @override
  Future<List<CalendarRaceModel>> getCalendarRaces({
    required String startDate,
    required String finishDate,
    required List<String> raceTypeList,
  }) async {
    await mockNetworkDelay();
    return const [];
  }
}
