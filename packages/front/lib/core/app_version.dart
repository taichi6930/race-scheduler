/// デプロイ済みビルドを識別するバージョン文字列（QSET-05）。
///
/// `pubspec.yaml` の `version`（`1.0.0+1`固定）はリリースタグ運用と連動して
/// いないため（このリポジトリは `vX.Y.Z` のgitタグでバージョン管理しており、
/// front側の `pubspec.yaml` を都度更新する仕組みが無い）、不具合報告時に
/// 「どの版の話か」を特定する目的には使えない。代わりにデプロイ時の
/// コミットSHA（先頭7文字）を `--dart-define=APP_VERSION=...`
/// （`deploy-front-reusable.yml`）で埋め込み、実際にデプロイされたコードを
/// 一意に特定できるようにする。ローカル実行・値未設定時は 'dev' を返す。
const String appVersion = String.fromEnvironment(
  'APP_VERSION',
  defaultValue: 'dev',
);
