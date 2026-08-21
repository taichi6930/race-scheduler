import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * `GET /join-requests` が返す参加リクエスト一覧画面のHTML。
 *
 * 招待コードを持たないユーザーがfrontから直接送った参加リクエスト（pending状態）
 * を運用者が確認し、承認（招待トークンが発行される）または却下する画面。
 * 承認・却下すると一覧から消える（pending状態のみ表示するため）。
 *
 * 外部CDNに依存しない自己完結ページ。このWorkerのホスト名自体がCloudflare Access
 * （Zero Trust）で保護されており、ここに到達できた時点で運用者本人の認証を通過済みの
 * ため、ページ・APIともにこのWorker自身の追加認証は行わない。
 */

const PAGE_STYLE = `
${CHROME_STYLE}
table { border-collapse: collapse; width: 100%; margin-top: 1rem; background: var(--surface); }
th, td { border: 1px solid var(--line); padding: 0.5rem; text-align: left; font-size: 0.875rem; vertical-align: middle; }
th { background: var(--surface2); }
button { font-size: 0.8125rem; padding: 0.3rem 0.8rem; border-radius: 0.375rem; border: none; color: #fff; cursor: pointer; margin-right: 0.4rem; }
button:disabled { opacity: 0.5; cursor: default; }
.approve { background: var(--brand); }
.reject { background: var(--danger); }
`;

const buildPageBody = (isProduction: boolean): string => `
${renderAdminHeader('参加リクエスト', isProduction, '/join-requests')}
<p class="hint">招待コードなしで送られた参加リクエスト（承認待ち）の一覧です。承認すると招待トークンが発行され、リクエスト元の端末で自動的に登録が続行されます。</p>
<p id="loading" class="hint" role="status">読み込み中…</p>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<p id="empty" class="hint" hidden>承認待ちの参加リクエストはありません。</p>
<table id="requests" hidden>
  <thead>
    <tr><th>ニックネーム</th><th>操作</th></tr>
  </thead>
  <tbody id="requests-body"></tbody>
</table>
`;

const buildPageScript = (): string => `
(function () {
  var loadingEl = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var emptyEl = document.getElementById('empty');
  var tableEl = document.getElementById('requests');
  var tbodyEl = document.getElementById('requests-body');

  // QADM-08: エラーはページ上部と離れた位置に出るため、スクリーンリーダー
  // 利用者・目視の双方が見落とさないようエラー要素へフォーカスを移す。
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
  }

  function loadRequests() {
    return fetch('/join-requests/api')
      .then(function (res) {
        if (!res.ok) {
          showError('読み込みに失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) renderRequests(data.requests);
      })
      .catch(function () {
        showError('読み込みに失敗しました');
      })
      .finally(function () {
        loadingEl.hidden = true;
      });
  }

  function decide(id, action, row) {
    var buttons = row.querySelectorAll('button');
    buttons.forEach(function (button) { button.disabled = true; });

    fetch('/join-requests/api/' + encodeURIComponent(id) + '/' + action, {
      method: 'POST',
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error(
            (action === 'approve' ? '承認' : '却下') + 'に失敗しました（' + res.status + '）',
          );
        }
        return loadRequests();
      })
      .catch(function (err) {
        showError((err && err.message) || '処理に失敗しました');
        buttons.forEach(function (button) { button.disabled = false; });
      });
  }

  function renderRow(request) {
    var tr = document.createElement('tr');
    var nicknameCell = document.createElement('td');
    nicknameCell.textContent = request.nickname;
    tr.appendChild(nicknameCell);

    var actionCell = document.createElement('td');
    var approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.className = 'approve';
    approveButton.textContent = '承認';
    approveButton.addEventListener('click', function () {
      decide(request.id, 'approve', tr);
    });
    var rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.className = 'reject';
    rejectButton.textContent = '却下';
    rejectButton.addEventListener('click', function () {
      decide(request.id, 'reject', tr);
    });
    actionCell.appendChild(approveButton);
    actionCell.appendChild(rejectButton);
    tr.appendChild(actionCell);
    return tr;
  }

  function renderRequests(requests) {
    if (requests.length === 0) {
      tableEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    tbodyEl.innerHTML = '';
    requests.forEach(function (request) {
      tbodyEl.appendChild(renderRow(request));
    });
    tableEl.hidden = false;
  }

  loadRequests();
})();
`;

/**
 * 参加リクエスト一覧画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジを出し分ける。
 * @returns `GET /join-requests` のレスポンスボディとして返すHTML文字列
 */
export const renderJoinRequestsPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>参加リクエスト（${titleSuffix}） — race-schedule admin</title>
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
