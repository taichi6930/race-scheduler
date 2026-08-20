import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/service_locator.dart';
import '../../data/datasources/dio_call_handler.dart';
import '../domain/auth_session.dart';
import '../domain/i_auth_repository.dart';

/// [IAuthRepository]の実装（`/auth/*`をDioで直接呼ぶ）。
///
/// レース/選手等の他リソースと異なりモデル/エンティティの変換が無い
/// 単純なDTO（[AuthChallenge]/[AuthSession]）のみのため、
/// `data/datasources`層を separate に設けず1ファイルで完結させる
/// （`TripGroupRepositoryImpl`同様、必要が無い層は増やさない）。
class AuthRepositoryImpl implements IAuthRepository {
  AuthRepositoryImpl({required this.dio});

  final Dio dio;

  @override
  Future<bool> verifyInvite(String inviteToken) {
    return handleDioCall(() async {
      final response = await dio.post(
        '/auth/invite/verify',
        data: {'token': inviteToken},
      );
      final data = response.data as Map<String, dynamic>;
      return data['valid'] == true;
    });
  }

  @override
  Future<AuthChallenge?> fetchRegisterOptions(String inviteToken) async {
    try {
      return await handleDioCall(() async {
        final response = await dio.post(
          '/auth/register/options',
          data: {'inviteToken': inviteToken},
        );
        return _challengeFromJson(response.data as Map<String, dynamic>);
      });
    } on ApiCallException catch (e) {
      if (e.statusCode == 400) return null;
      rethrow;
    }
  }

  @override
  Future<AuthSession?> verifyRegister({
    required String challengeId,
    required String nickname,
    required Map<String, dynamic> credentialResponse,
  }) async {
    try {
      return await handleDioCall(() async {
        final response = await dio.post(
          '/auth/register/verify',
          data: {
            'challengeId': challengeId,
            'nickname': nickname,
            'credentialResponse': credentialResponse,
          },
        );
        return _sessionFromJson(response.data as Map<String, dynamic>);
      });
    } on ApiCallException catch (e) {
      if (e.statusCode == 400) return null;
      rethrow;
    }
  }

  @override
  Future<AuthChallenge> fetchLoginOptions() {
    return handleDioCall(() async {
      final response = await dio.post('/auth/login/options');
      return _challengeFromJson(response.data as Map<String, dynamic>);
    });
  }

  @override
  Future<AuthSession?> verifyLogin({
    required String challengeId,
    required Map<String, dynamic> credentialResponse,
  }) async {
    try {
      return await handleDioCall(() async {
        final response = await dio.post(
          '/auth/login/verify',
          data: {
            'challengeId': challengeId,
            'credentialResponse': credentialResponse,
          },
        );
        return _sessionFromJson(response.data as Map<String, dynamic>);
      });
    } on ApiCallException catch (e) {
      if (e.statusCode == 401) return null;
      rethrow;
    }
  }

  AuthChallenge _challengeFromJson(Map<String, dynamic> json) =>
      AuthChallenge(
        challengeId: json['challengeId'] as String,
        options: json['options'] as Map<String, dynamic>,
      );

  AuthSession _sessionFromJson(Map<String, dynamic> json) => AuthSession(
    token: json['sessionToken'] as String,
    nickname: json['nickname'] as String,
  );
}

/// [IAuthRepository]の実装を提供する。
final authRepositoryProvider = Provider<IAuthRepository>(
  (ref) => AuthRepositoryImpl(dio: getIt<Dio>()),
);
