import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';

import '../../data/datasources/announcement_remote_data_source.dart';
import '../../data/datasources/calendar_remote_data_source.dart';
import '../../data/datasources/place_remote_data_source.dart';
import '../../data/datasources/player_remote_data_source.dart';
import '../../data/datasources/push_subscription_remote_data_source.dart';
import '../../data/datasources/race_remote_data_source.dart';
import '../../data/datasources/release_remote_data_source.dart';
import '../../data/repositories/calendar_repository_impl.dart';
import '../../data/repositories/place_repository_impl.dart';
import '../../data/repositories/player_repository_impl.dart';
import '../../data/repositories/race_repository_impl.dart';
import '../../data/repositories/release_note_repository_impl.dart';
import '../../data/repositories/trip_group_repository_impl.dart';
import '../../domain/repositories/i_calendar_repository.dart';
import '../../domain/repositories/i_place_repository.dart';
import '../../domain/repositories/i_player_repository.dart';
import '../../domain/repositories/i_race_repository.dart';
import '../../domain/repositories/i_release_note_repository.dart';
import '../../domain/repositories/i_trip_group_repository.dart';
import '../../domain/usecases/get_races_by_date_range.dart';
import '../network/auth_interceptor.dart';
import '../network/dio_retry_interceptor.dart';
import 'mock/fake_announcement_remote_data_source.dart';
import 'mock/fake_calendar_remote_data_source.dart';
import 'mock/fake_place_remote_data_source.dart';
import 'mock/fake_player_remote_data_source.dart';
import 'mock/fake_push_subscription_remote_data_source.dart';
import 'mock/fake_race_remote_data_source.dart';
import 'mock/fake_release_remote_data_source.dart';

final getIt = GetIt.instance;

void setupDependencies({required String apiBaseUrl}) {
  // Network
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );
  // 全リクエストへセッショントークンを付与し、401を検知するInterceptor。
  // トークンの読み書き・401コールバックの配線はRiverpod側
  // （SessionNotifier、lib/auth/application/session_provider.dart）が担う。
  final authInterceptor = AuthInterceptor();
  dio.interceptors.add(authInterceptor);
  getIt.registerSingleton<AuthInterceptor>(authInterceptor);
  // 一時的なエラー（ネットワークエラー・5xx）に限定した自動リトライ（PERF-009）。
  // GET以外（副作用のあるPOST/PUT/DELETE）はリトライ対象外
  // （詳細は DioRetryInterceptor のドキュメントコメントを参照）。
  dio.interceptors.add(DioRetryInterceptor(dio: dio));
  getIt.registerSingleton<Dio>(dio);

  _registerRepositories(
    raceRemoteDataSource: RaceRemoteDataSource(dio: dio),
    placeRemoteDataSource: PlaceRemoteDataSource(dio: dio),
    calendarRemoteDataSource: CalendarRemoteDataSource(dio: dio),
    playerRemoteDataSource: PlayerRemoteDataSource(dio: dio),
    pushSubscriptionRemoteDataSource: PushSubscriptionRemoteDataSource(
      dio: dio,
    ),
    releaseRemoteDataSource: ReleaseRemoteDataSource(dio: dio),
    announcementRemoteDataSource: AnnouncementRemoteDataSource(dio: dio),
  );
}

/// バックエンド（`packages/api`）に一切接続せず、固定生成データのみで
/// アプリ全体を動作させるモード（`lib/main_mock.dart` 専用）。
///
/// PRレビュー・フロント単体でのデザイン確認のために、データ層の最下層
/// （Remote DataSource）だけをフェイクへ差し替える。Repository/UseCase/
/// Provider/UI は本番と全く同じコードパスを通るため、本番相当の挙動
/// （フィルタ・お気に入り・カレンダー集計・旅程グループ検出等）を
/// ネットワーク無しで確認できる。
void setupMockDependencies() {
  _registerRepositories(
    raceRemoteDataSource: FakeRaceRemoteDataSource(),
    placeRemoteDataSource: FakePlaceRemoteDataSource(),
    calendarRemoteDataSource: FakeCalendarRemoteDataSource(),
    playerRemoteDataSource: FakePlayerRemoteDataSource(),
    pushSubscriptionRemoteDataSource: FakePushSubscriptionRemoteDataSource(),
    releaseRemoteDataSource: FakeReleaseRemoteDataSource(),
    announcementRemoteDataSource: FakeAnnouncementRemoteDataSource(),
  );
}

/// Data Sources 以下（Repository・UseCase）の登録。本番/モック共通。
void _registerRepositories({
  required IRaceRemoteDataSource raceRemoteDataSource,
  required IPlaceRemoteDataSource placeRemoteDataSource,
  required ICalendarRemoteDataSource calendarRemoteDataSource,
  required IPlayerRemoteDataSource playerRemoteDataSource,
  required IPushSubscriptionRemoteDataSource pushSubscriptionRemoteDataSource,
  required IReleaseRemoteDataSource releaseRemoteDataSource,
  required IAnnouncementRemoteDataSource announcementRemoteDataSource,
}) {
  getIt.registerSingleton<IRaceRemoteDataSource>(raceRemoteDataSource);
  getIt.registerSingleton<IPlaceRemoteDataSource>(placeRemoteDataSource);
  getIt.registerSingleton<ICalendarRemoteDataSource>(calendarRemoteDataSource);
  getIt.registerSingleton<IPlayerRemoteDataSource>(playerRemoteDataSource);
  getIt.registerSingleton<IPushSubscriptionRemoteDataSource>(
    pushSubscriptionRemoteDataSource,
  );
  getIt.registerSingleton<IReleaseRemoteDataSource>(releaseRemoteDataSource);
  getIt.registerSingleton<IAnnouncementRemoteDataSource>(
    announcementRemoteDataSource,
  );

  // Repositories
  getIt.registerSingleton<IRaceRepository>(
    RaceRepositoryImpl(remoteDataSource: getIt()),
  );
  getIt.registerSingleton<IPlaceRepository>(
    PlaceRepositoryImpl(remoteDataSource: getIt()),
  );
  getIt.registerSingleton<ICalendarRepository>(
    CalendarRepositoryImpl(remoteDataSource: getIt()),
  );
  getIt.registerSingleton<IPlayerRepository>(
    PlayerRepositoryImpl(remoteDataSource: getIt()),
  );
  getIt.registerSingleton<ITripGroupRepository>(
    TripGroupRepositoryImpl(placeRepository: getIt()),
  );
  getIt.registerSingleton<IReleaseNoteRepository>(
    ReleaseNoteRepositoryImpl(remoteDataSource: getIt()),
  );

  // Use Cases
  getIt.registerSingleton<GetRacesByDateRangeUseCase>(
    GetRacesByDateRangeUseCase(getIt()),
  );
}
