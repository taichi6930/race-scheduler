import '../../../data/datasources/push_subscription_remote_data_source.dart';
import 'mock_network_delay.dart';

/// バックエンドに接続しない [IPushSubscriptionRemoteDataSource]。
///
/// Web Push はブラウザ通知権限・VAPIDキー等サーバー側の実配信が前提のため、
/// モックモードでは常に成功扱いのスタブとする（設定画面の操作がエラーで
/// 落ちないようにするのが目的で、実際に通知は飛ばない）。
class FakePushSubscriptionRemoteDataSource
    implements IPushSubscriptionRemoteDataSource {
  @override
  Future<String> upsertSubscription({
    required String endpoint,
    required String p256dh,
    required String auth,
  }) async {
    await mockNetworkDelay();
    return 'mock-subscription-id';
  }

  @override
  Future<void> removeSubscription({required String endpoint}) async {
    await mockNetworkDelay();
  }

  @override
  Future<void> upsertRequest({
    required String subscriptionId,
    required String raceId,
    required int fireAtMs,
    required String title,
    required String body,
    String? url,
  }) async {
    await mockNetworkDelay();
  }

  @override
  Future<void> removeRequest({
    required String subscriptionId,
    required String raceId,
  }) async {
    await mockNetworkDelay();
  }

  @override
  Future<bool> sendTest({required String subscriptionId}) async {
    await mockNetworkDelay();
    return true;
  }
}
