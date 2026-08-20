import 'package:flutter/foundation.dart';

/// ログイン状態をgo_routerの`redirect`から同期的に判定するための橋渡し。
///
/// `appRouter`（`lib/navigation/app_router.dart`）はモジュールレベルの
/// 定数のためRiverpodの`ref`を持てない。[SessionNotifier]
/// （`session_provider.dart`）がセッション変更のたびに[update]でここへ
/// 反映し、あわせて[ChangeNotifier.notifyListeners]（`GoRouter.refreshListenable`
/// 経由）でredirectの再評価をトリガーする（`AuthInterceptor`がDio側で
/// 同じ理由からプレーンフィールドで橋渡しするのと同じ設計）。
class AuthRouterState extends ChangeNotifier {
  bool isLoggedIn = false;

  void update(bool loggedIn) {
    if (isLoggedIn == loggedIn) return;
    isLoggedIn = loggedIn;
    notifyListeners();
  }
}

/// アプリ全体で1つだけ存在する[AuthRouterState]。
final authRouterState = AuthRouterState();
