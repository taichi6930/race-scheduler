import 'package:dio/dio.dart';

import '../../domain/repositories/i_favorites_repository.dart';

/// [IFavoritesRepository]のサーバー保存実装（`GET/POST/DELETE /favorite`）。
///
/// バックエンドは個別のレースID追加/削除のみを提供し、一括更新APIは無い。
/// 一方[IFavoritesRepository.saveFavoriteRaceIds]は「最終状態の集合」を
/// 受け取る契約（[FavoriteIdsNotifier]がPERF-112のデバウンスで複数回の
/// toggleをまとめてから呼ぶ）ため、直近にサーバーへ反映済みの集合との差分を
/// 取り、追加分はPOST・削除分はDELETEを個別発行する。
///
/// ponytail: 差分適用の途中で失敗した場合（例: 追加は成功したが削除で失敗）、
/// 内部キャッシュ（[_knownIds]）は更新前のまま保持する。次回保存時に同じ
/// 追加を再送する可能性があるが、`POST /favorite`/`DELETE /favorite`は
/// 同じraceIdに対して冪等（既に追加済み/削除済みでも200を返す設計）である
/// 前提のため実害は無い。厳密に成功した項目だけを反映したい場合は、
/// 呼び出しごとの成否を個別に追跡する実装へ拡張すること。
class RemoteFavoritesRepository implements IFavoritesRepository {
  RemoteFavoritesRepository({required this.dio});

  final Dio dio;

  Set<String>? _knownIds;

  @override
  Future<Set<String>> loadFavoriteRaceIds() async {
    final response = await dio.get('/favorite');
    final data = response.data as Map<String, dynamic>;
    final ids = (data['raceIds'] as List).cast<String>().toSet();
    _knownIds = ids;
    return ids;
  }

  @override
  Future<bool> saveFavoriteRaceIds(Set<String> raceIds) async {
    final previous = _knownIds ?? const <String>{};
    final added = raceIds.difference(previous);
    final removed = previous.difference(raceIds);
    try {
      for (final raceId in added) {
        await dio.post('/favorite', data: {'raceId': raceId});
      }
      for (final raceId in removed) {
        await dio.delete('/favorite', data: {'raceId': raceId});
      }
      _knownIds = raceIds;
      return true;
    } on DioException {
      return false;
    }
  }
}
