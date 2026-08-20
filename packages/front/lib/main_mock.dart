import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'auth/application/session_provider.dart';
import 'auth/domain/auth_session.dart';
import 'core/di/service_locator.dart';
import 'core/di/shared_preferences_provider.dart';
import 'data/repositories/local_favorites_repository.dart';
import 'features/favorites/application/favorite_ids_provider.dart';

/// モックモードでは全画面ログイン必須（招待制クローズドサービス化）を
/// バイパスし、常にログイン済みとして扱う。バックエンドに一切接続しない
/// プレビュー用途のため、招待/ログイン画面を経由させる意味が無い
/// （ponytail: 招待/ログイン画面自体の見た目を確認したい場合は、この
/// overrideを一時的に外すこと。上限=モックモードでは常にログイン済み固定、
/// アップグレード経路=必要になれば起動引数でON/OFFを切り替え可能にする）。
class _MockSessionNotifier extends SessionNotifier {
  @override
  AuthSession? build() =>
      const AuthSession(token: 'mock-token', nickname: 'プレビューユーザー');
}

/// フロントエンド単体プレビュー（モックモード）のエントリポイント。
///
/// バックエンド（`packages/api`）に一切接続せず、固定生成データのみで
/// アプリ全体（タイムライン・カレンダー・お気に入り・旅程グループ・設定）を
/// 動作確認できる。PRレビュー時や、デザイン変更の見た目確認に使う。
///
/// 起動: `flutter run -t lib/main_mock.dart -d chrome`
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  late final SharedPreferences prefs;
  await Future.wait([
    initializeDateFormatting('ja_JP', null),
    SharedPreferences.getInstance().then((value) => prefs = value),
  ]);

  setupMockDependencies();
  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        sessionProvider.overrideWith(_MockSessionNotifier.new),
        // お気に入りはRemoteFavoritesRepository（Dio経由）ではなく、
        // モックモードの他の状態と同じく端末ローカル保存にする
        // （setupMockDependencies()はDioを一切生成しないため）。
        favoritesRepositoryProvider.overrideWith(
          (ref) => LocalFavoritesRepository(ref.read(sharedPreferencesProvider)),
        ),
      ],
      child: const MyApp(),
    ),
  );
}
