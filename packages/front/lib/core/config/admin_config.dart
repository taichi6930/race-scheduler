/// 管理画面（`packages/admin` Worker）のベースURL。
///
/// CI（`--dart-define=ADMIN_BASE_URL=...`）で環境ごとの値を注入する
/// （`.github/workflows/deploy-front-reusable.yml`）。development環境等、
/// 値が渡されない場合はtest環境のURLへフォールバックする
/// （admin WorkerはCloudflare Access保護のためdevelopment環境自体を持たない）。
const _rawAdminBaseUrl = String.fromEnvironment('ADMIN_BASE_URL');

final String adminBaseUrl = _rawAdminBaseUrl.isEmpty
    ? 'https://race-schedule-admin-test.tn-product.workers.dev'
    : _rawAdminBaseUrl;
