import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 「お気に入り」タブ内の「レース／選手」サブタブ切り替え（KPLAYER-07）。
enum FavoritesSubTab { races, players }

/// 選択中のサブタブ。画面遷移のたびにリセットしてよいため永続化はしない。
final favoritesSubTabProvider =
    NotifierProvider<FavoritesSubTabNotifier, FavoritesSubTab>(
      FavoritesSubTabNotifier.new,
    );

class FavoritesSubTabNotifier extends Notifier<FavoritesSubTab> {
  @override
  FavoritesSubTab build() => FavoritesSubTab.races;

  void select(FavoritesSubTab tab) => state = tab;
}
