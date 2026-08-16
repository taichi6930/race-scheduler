import 'package:flutter/foundation.dart' show debugPrint;

/// 「今」を常に日本時間（Asia/Tokyo, UTC+9固定・サマータイムなし）として返す。
///
/// このアプリは日本の公営競技専用のため、閲覧者の端末のタイムゾーン設定に
/// 関わらず、常に日本時間で表示・判定する必要がある
/// （`DateTime.now()` は端末のローカルタイムゾーンに依存するため、そのまま
/// 使うと海外の端末で発走時刻とのズレが生じる）。
///
/// レースの `datetime`（API から届く ISO8601 文字列）は `+09:00` オフセット
/// 付きの日本時間なので、[parseJstDateTime] で本関数と同じ「UTC基準+9時間」
/// 表現（[DateTime.isUtc] が true で、フィールドの値がJSTの壁時計時刻と
/// 一致するオブジェクト）に揃えてから比較・演算する。
DateTime jstNow() => DateTime.now().toUtc().add(const Duration(hours: 9));

/// レースの `datetime` 文字列を、[jstNow] と同じ表現の JST 壁時計
/// [DateTime] として解釈する。
///
/// API は `datetime` を `+09:00` オフセット付きISO8601文字列で返す。
/// オフセット付き文字列を `DateTime.parse` すると、Dartは正しいUTC瞬間へ
/// 変換した上で `isUtc: true` のオブジェクトを返す（フィールドの値はJSTより
/// 9時間過去にずれる）。そのままフィールドを表示・演算に使うと発走時刻が
/// 9時間早く見える不具合になるため、ここで9時間進めて[jstNow]と同じ
/// 「UTC基準+9時間」表現に正規化する。
///
/// オフセットなしの文字列（`isUtc: false`）が渡された場合は、その数値を
/// そのままJSTの壁時計時刻とみなして返す（変換しない）。
///
/// QJST-08: openapi仕様上APIの`datetime`は常に`+09:00`オフセット付きの
/// ため、このオフセットなし分岐は本来通らないはずである。もし通った場合
/// （APIの仕様退行等）、無変換でそのまま返す挙動自体は変えないが、9時間
/// ズレた表示が無警告で発生しうるため、`global_error_handler.dart` /
/// `dio_call_handler.dart`（OBS-021/OBS-022）と同じ[debugPrint]ベースの
/// 構造化ログで検知できるようにする。
DateTime parseJstDateTime(String datetime) {
  final parsed = DateTime.parse(datetime);
  if (!parsed.isUtc) {
    debugPrint(
      '[parseJstDateTime] オフセットなしのdatetime文字列を受け取りました（想定外）: $datetime',
    );
  }
  return parsed.isUtc ? parsed.add(const Duration(hours: 9)) : parsed;
}

/// [DateTime] を API が受け付ける `yyyy-MM-dd` 形式の文字列へ整形する。
String formatDateForApi(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}

/// [DateTime] を `年月日` 形式の日本語ラベル（例: `2026年4月19日`、ゼロパディングなし）
/// に整形する。
String formatJapaneseDateLabel(DateTime date) {
  return '${date.year}年${date.month}月${date.day}日';
}
