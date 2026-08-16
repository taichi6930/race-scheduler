import '../../../data/datasources/release_remote_data_source.dart';
import '../../../data/models/release_model.dart';
import 'mock_network_delay.dart';

/// バックエンド（GitHub API含む）に一切接続せず、固定サンプルデータのみで
/// 更新履歴ページを動作確認できる [IReleaseRemoteDataSource]。モックモード専用。
class FakeReleaseRemoteDataSource implements IReleaseRemoteDataSource {
  @override
  Future<List<ReleaseModel>> getReleases() async {
    await mockNetworkDelay();
    return [
      ReleaseModel(
        tagName: 'v1.3.0',
        name: 'v1.3.0',
        publishedAt: DateTime.now().toIso8601String(),
        body:
            '## 📱 フロントの変更\n'
            '- 更新履歴ページを追加しました\n'
            '- お気に入り登録のアイコンを見やすくしました\n\n'
            '## ✨ 新しく取れる情報\n'
            '- レース結果の確定タイミングを表示するようになりました\n\n'
            '## 🎉 改善\n'
            '- 通知の重複を解消しました',
      ),
      ReleaseModel(
        tagName: 'v1.2.0',
        name: 'v1.2.0',
        publishedAt: DateTime.now()
            .subtract(const Duration(days: 14))
            .toIso8601String(),
        body: '## 🔧 バックエンドのみ\n- APIのレスポンス速度を改善しました',
      ),
    ];
  }
}
