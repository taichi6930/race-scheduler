import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/di/service_locator.dart';
import 'core/di/shared_preferences_provider.dart';
import 'core/global_error_handler.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  installGlobalErrorHandlers();

  const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://race-schedule-test.tn-product.workers.dev',
  );

  late final SharedPreferences prefs;
  await Future.wait([
    initializeDateFormatting('ja_JP', null),
    SharedPreferences.getInstance().then((value) => prefs = value),
  ]);

  setupDependencies(apiBaseUrl: apiBaseUrl);
  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const MyApp(),
    ),
  );
}
