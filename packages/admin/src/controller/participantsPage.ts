import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * `GET /participants` が返す参加者一覧画面のHTML。
 *
 * 招待から実際にパスキー(WebAuthn)登録まで済んだ参加者を運用者が確認するための
 * 閲覧専用画面（更新・削除操作は無い）。1人が複数credential（複数端末）を
 * 持つ場合はuserIdが同じ行が複数出るが、グルーピングはせずそのまま表示する
 * （YAGNI）。
 *
 * 外部CDNに依存しない自己完結ページ。このWorkerのホスト名自体がCloudflare Access
 * （Zero Trust）で保護されており、ここに到達できた時点で運用者本人の認証を通過済みの
 * ため、ページ・APIともにこのWorker自身の追加認証は行わない。
 */

const PAGE_STYLE = `
${CHROME_STYLE}
table { border-collapse: collapse; width: 100%; margin-top: 1rem; background: var(--surface); }
th, td { border: 1px solid var(--line); padding: 0.5rem; text-align: left; font-size: 0.875rem; vertical-align: top; }
th { background: var(--surface2); }
`;

const buildPageBody = (isProduction: boolean): string => `
${renderAdminHeader('参加者一覧', isProduction, '/participants')}
<p class="hint">招待から登録済みの参加者一覧です（閲覧専用）。1人が複数端末を登録している場合は行が複数出ます。</p>
<p id="loading" class="hint" role="status">読み込み中…</p>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<p id="empty" class="hint" hidden>参加者がまだいません。</p>
<table id="participants" hidden>
  <thead>
    <tr><th>ニックネーム</th><th>あなたのメモ</th><th>端末ラベル</th><th>最終ログイン日時（JST）</th><th>参加日時（JST）</th></tr>
  </thead>
  <tbody id="participants-body"></tbody>
</table>
`;

const buildPageScript = (): string => `
(function () {
  var loadingEl = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var emptyEl = document.getElementById('empty');
  var tableEl = document.getElementById('participants');
  var tbodyEl = document.getElementById('participants-body');

  // QADM-08: エラーはページ上部と離れた位置に出るため、スクリーンリーダー
  // 利用者・目視の双方が見落とさないようエラー要素へフォーカスを移す。
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
  }
  function formatDateTime(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
  function td(text) {
    var cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  }
  function renderRow(participant) {
    var tr = document.createElement('tr');
    tr.appendChild(td(participant.nickname));
    tr.appendChild(td(participant.inviteMemo || '-'));
    tr.appendChild(td(participant.deviceLabel));
    tr.appendChild(td(formatDateTime(participant.lastUsedAt)));
    tr.appendChild(td(formatDateTime(participant.userCreatedAt)));
    return tr;
  }
  function renderParticipants(participants) {
    if (participants.length === 0) {
      tableEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    tbodyEl.innerHTML = '';
    participants.forEach(function (participant) {
      tbodyEl.appendChild(renderRow(participant));
    });
    tableEl.hidden = false;
  }

  fetch('/participants/api')
    .then(function (res) {
      if (!res.ok) {
        showError('読み込みに失敗しました（' + res.status + '）');
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (data) renderParticipants(data.participants);
    })
    .catch(function () {
      showError('読み込みに失敗しました');
    })
    .finally(function () {
      loadingEl.hidden = true;
    });
})();
`;

/**
 * 参加者一覧画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジを出し分ける。
 * @returns `GET /participants` のレスポンスボディとして返すHTML文字列
 */
export const renderParticipantsPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>参加者一覧（${titleSuffix}） — race-schedule admin</title>
<link rel="icon" href="${faviconFor(isProduction)}">
<style>${PAGE_STYLE}</style>
</head>
<body>
${buildPageBody(isProduction)}
<script>${buildPageScript()}</script>
</body>
</html>
`;
};
