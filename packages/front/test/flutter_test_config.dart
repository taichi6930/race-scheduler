import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

/// `packages/front/test/` 配下の全テストに共通の前処理（QLIFE-01）。
///
/// `TestWidgetsFlutterBinding` は `testWidgets()` を使うテストでは自動的に
/// 初期化されるが、プロバイダのロジックだけを検証する plain `test()` の
/// ファイルでは初期化されない。`scheduleTtlInvalidate`
/// （`core/riverpod/ttl_refresh.dart`）が `AppLifecycleListener` を構築する
/// ようになったことで、TTLキャッシュを使うプロバイダを実際に build する
/// テストはすべて `WidgetsBinding` の初期化を必要とするようになったため、
/// テストファイルごとに個別対応せず、このファイル（Flutterが自動的に
/// 認識する規約上のファイル名）で一度だけ初期化する。
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await testMain();
}
