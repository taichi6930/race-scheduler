import '../../../data/datasources/announcement_remote_data_source.dart';
import '../../../domain/entities/announcement.dart';
import 'mock_network_delay.dart';

/// バックエンドに接続しない [IAnnouncementRemoteDataSource]。
///
/// モックモードでは常に「お知らせ無し」を返す（デザイン確認モードで
/// 意図しないバナーが表示されないようにするのが目的）。
class FakeAnnouncementRemoteDataSource
    implements IAnnouncementRemoteDataSource {
  @override
  Future<Announcement> getAnnouncement() async {
    await mockNetworkDelay();
    return const Announcement(enabled: false, message: '');
  }
}
