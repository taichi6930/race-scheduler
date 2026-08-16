import 'package:dio/dio.dart';

import 'dio_call_handler.dart';

/// Web Push の購読・発火予約をバックエンド（api）へ登録・削除するデータソース。
abstract class IPushSubscriptionRemoteDataSource {
  /// 購読を登録する（既に存在する場合は更新）。導出された購読IDを返す。
  Future<String> upsertSubscription({
    required String endpoint,
    required String p256dh,
    required String auth,
  });

  /// 購読を解除する。紐づく発火予約もサーバ側であわせて削除される。
  Future<void> removeSubscription({required String endpoint});

  /// 発火予約を登録する（既に存在する場合は上書き、冪等）。
  Future<void> upsertRequest({
    required String subscriptionId,
    required String raceId,
    required int fireAtMs,
    required String title,
    required String body,
    String? url,
  });

  /// 発火予約を取り消す。
  Future<void> removeRequest({
    required String subscriptionId,
    required String raceId,
  });

  /// 指定の購読へテスト通知を即時送信する（配信テスト機能）。成功時 true を返す。
  Future<bool> sendTest({required String subscriptionId});
}

class PushSubscriptionRemoteDataSource
    implements IPushSubscriptionRemoteDataSource {
  final Dio dio;

  PushSubscriptionRemoteDataSource({required this.dio});

  @override
  Future<String> upsertSubscription({
    required String endpoint,
    required String p256dh,
    required String auth,
  }) {
    return handleDioCall(() async {
      final response = await dio.post(
        '/push/subscription',
        data: {
          'endpoint': endpoint,
          'keys': {'p256dh': p256dh, 'auth': auth},
        },
      );
      final data = response.data;
      if (data is Map<String, dynamic> && data['id'] is String) {
        return data['id'] as String;
      }
      throw Exception('Failed to upsert push subscription');
    });
  }

  @override
  Future<void> removeSubscription({required String endpoint}) {
    return handleDioCall(() async {
      await dio.delete('/push/subscription', data: {'endpoint': endpoint});
    });
  }

  @override
  Future<void> upsertRequest({
    required String subscriptionId,
    required String raceId,
    required int fireAtMs,
    required String title,
    required String body,
    String? url,
  }) {
    return handleDioCall(() async {
      await dio.post(
        '/push/request',
        data: {
          'subscriptionId': subscriptionId,
          'raceId': raceId,
          'fireAtMs': fireAtMs,
          'title': title,
          'body': body,
          'url': ?url,
        },
      );
    });
  }

  @override
  Future<void> removeRequest({
    required String subscriptionId,
    required String raceId,
  }) {
    return handleDioCall(() async {
      await dio.delete(
        '/push/request',
        data: {'subscriptionId': subscriptionId, 'raceId': raceId},
      );
    });
  }

  @override
  Future<bool> sendTest({required String subscriptionId}) {
    return handleDioCall(() async {
      final response = await dio.post(
        '/push/test',
        data: {'subscriptionId': subscriptionId},
      );
      final data = response.data;
      return data is Map<String, dynamic> && data['ok'] == true;
    });
  }
}
