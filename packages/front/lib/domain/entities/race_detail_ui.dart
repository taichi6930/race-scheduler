import 'race_link.dart';
import 'race_player_entity.dart';

/// レース詳細のセクション型UIスキーマ（`GET /ui/race-detail` のレスポンス、
/// race-detail-sdui-design.md）。
///
/// front を再デプロイせずAPI側だけで [sections] の内容（フィールドの選択・
/// 順序・ラベル）を変更できる。[schemaVersion] は将来セクション種別を拡張する
/// 際、frontの解釈可否を判定するために予約している（現時点ではv1のみ）。
class RaceDetailUi {
  const RaceDetailUi({required this.schemaVersion, required this.sections});

  final int schemaVersion;

  /// 解釈できたセクションのみ（未知の`type`はパース時点で除外済み）。
  final List<RaceDetailUiSection> sections;
}

/// レース詳細の1セクション。`type`ごとに具象クラスへ振り分ける
/// （`TimelineRow`と同じsealed classパターン）。
sealed class RaceDetailUiSection {
  const RaceDetailUiSection();
}

/// 発走時刻・会場等のキーバリュー一覧セクション。
class RaceDetailKvSection extends RaceDetailUiSection {
  const RaceDetailKvSection({required this.rows});

  final List<RaceDetailKvRow> rows;
}

/// [RaceDetailKvSection] の1行。
class RaceDetailKvRow {
  const RaceDetailKvRow({required this.label, required this.value});

  final String label;
  final String value;
}

/// 外部リンク（netkeirin出馬表・レース動画・YouTube公式配信等）セクション。
class RaceDetailLinksSection extends RaceDetailUiSection {
  const RaceDetailLinksSection({required this.items});

  final List<RaceLink> items;
}

/// 出走選手ロスターセクション。
class RaceDetailPlayersSection extends RaceDetailUiSection {
  const RaceDetailPlayersSection({
    required this.title,
    required this.watchToggle,
    required this.players,
  });

  final String title;

  /// ★（注目選手トグル）を表示するか。
  final bool watchToggle;
  final List<RacePlayerEntity> players;
}
