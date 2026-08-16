import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/di/service_locator.dart';
import 'core/di/shared_preferences_provider.dart';

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
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const MyApp(),
    ),
  );
}
