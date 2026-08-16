import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/service_locator.dart';
import '../../../domain/entities/race_detail_ui.dart';
import '../../../domain/repositories/i_race_repository.dart';

/// [raceId] のレース詳細画面のセクション型UIスキーマを取得する
/// （`GET /ui/race-detail`、race-detail-sdui-design.md）。
///
/// KV一覧・外部リンク・出走選手ロスターの3セクションを1回のfetchでまとめて
/// 取得する（従来のraceLinksProvider/racePlayersProvider相当の内容を
/// 統合したもの）。取得中・取得失敗時は呼び出し側で[AsyncValue]の
/// loading/errorを「セクション無し」として扱い、詳細画面をブロックしない
/// （raceLinksProvider/racePlayersProviderと同じ方針）。
final raceDetailUiProvider = FutureProvider.autoDispose
    .family<RaceDetailUi, String>((ref, raceId) async {
      return getIt<IRaceRepository>().getRaceDetailUi(raceId);
    });
