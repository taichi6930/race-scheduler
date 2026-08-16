/// レースIDから安定した通知ID（32bit正の整数）を導出する。
///
/// `String.hashCode` は Dart の仕様上、実行間の安定性を保証しないため、
/// FNV-1a で決定的に計算する（同一 raceId は常に同一IDになる）。
int notificationIdFor(String raceId) {
  var hash = 0x811c9dc5 & 0x7fffffff;
  for (final codeUnit in raceId.codeUnits) {
    hash ^= codeUnit;
    hash = (hash * 0x01000193) & 0x7fffffff;
  }
  return hash;
}
