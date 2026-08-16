import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';

/// ビジュアルリグレッション（ゴールデン）テスト共通ヘルパー。
///
/// テスト実行環境（マシン・フォント）に依存する差分を避けるため、
/// サーフェスサイズ・devicePixelRatio を固定し、`flutter_test` 既定の
/// 決定的フォールバックフォントで描画する（実フォントは読み込まない）。
Future<void> pumpGolden(
  WidgetTester tester,
  Widget child, {
  Size surfaceSize = const Size(360, 640),
  bool dark = false,
}) async {
  tester.view.physicalSize = surfaceSize * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      debugShowCheckedModeBanner: false,
      home: Scaffold(body: Center(child: child)),
    ),
  );
  await tester.pump();
}
