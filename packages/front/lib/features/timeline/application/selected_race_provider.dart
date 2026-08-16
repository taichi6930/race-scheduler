import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 広画面（右にレース詳細を常駐パネル表示するとき）に表示中のレースID。
///
/// モバイル幅ではボトムシートを都度開くため参照しない（screens.md §0）。
final selectedRaceIdProvider =
    NotifierProvider<SelectedRaceIdNotifier, String?>(
      SelectedRaceIdNotifier.new,
    );

class SelectedRaceIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String raceId) => state = raceId;
}
