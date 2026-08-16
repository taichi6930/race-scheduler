/// フェイクdatasource共通の疑似ネットワーク遅延。
///
/// 実APIらしい体感（ローディングスケルトンが一瞬見える程度）を再現するため、
/// 即時返却ではなくわずかに待たせる。
Future<void> mockNetworkDelay() =>
    Future<void>.delayed(const Duration(milliseconds: 250));
