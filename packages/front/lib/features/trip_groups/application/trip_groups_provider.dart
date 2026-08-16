import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/trip_group_entity.dart';
import '../../../domain/repositories/i_trip_group_repository.dart';
import '../../settings/application/settings_provider.dart';

/// [ITripGroupRepository] の実装（`getIt` 経由）を提供する。
final tripGroupRepositoryProvider = Provider<ITripGroupRepository>(
  (ref) => getIt<ITripGroupRepository>(),
);

/// 全旅程グループの候補日検出結果（`GET /trip-group`）。
///
/// [settingsProvider] の `tripToleranceDays`/`tripLookaheadDays` を watch し、
/// 値が変わるたびに再取得する。[defaultCacheTtl] 経過後は値が変わらなくても
/// 自動で再取得する（[scheduleTtlInvalidate]）。
final tripGroupsProvider = FutureProvider<List<TripGroupEntity>>((ref) async {
  scheduleTtlInvalidate(ref, defaultCacheTtl);
  final repository = ref.watch(tripGroupRepositoryProvider);
  final settings = ref.watch(settingsProvider);
  return repository.getAll(
    lookaheadDays: settings.tripLookaheadDays,
    toleranceDays: settings.tripToleranceDays,
  );
});

/// [groupId] に一致する旅程グループを [tripGroupsProvider] の結果から探す。
///
/// 一覧取得が未完了・エラーの場合は `null`（詳細画面側でローディング/エラー表示）。
/// 該当グループが見つからない場合も `null`。
TripGroupEntity? findTripGroupById(
  List<TripGroupEntity>? groups,
  String groupId,
) {
  if (groups == null) return null;
  for (final group in groups) {
    if (group.id == groupId) return group;
  }
  return null;
}
