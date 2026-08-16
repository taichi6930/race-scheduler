import '../domain/entities/race_entity.dart';

/// レース開始前通知のスケジューラ（technical-design.md §5）。
///
/// モバイルはローカル通知（`flutter_local_notifications`）、Web はMVPでは
/// クラッシュしないスタブ実装に差し替える（Web Push は次フェーズ）。
abstract class INotificationScheduler {
  /// 通知基盤を初期化する。アプリ起動時に一度呼ぶ。
  Future<void> initialize();

  /// [race] の発走 [leadMinutes] 分前に通知をスケジュールする。
  ///
  /// 発火時刻が既に過去の場合は既存のスケジュールを取り消すのみで、
  /// 新規スケジュールは行わない。同一レースへの再呼び出しは
  /// 既存のスケジュールを上書きする（冪等）。
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  });

  /// [raceId] に対してスケジュール済みの通知を取り消す。
  Future<void> cancelRaceNotification(String raceId);

  /// スケジュール済みの通知をすべて取り消す。
  Future<void> cancelAll();
}
