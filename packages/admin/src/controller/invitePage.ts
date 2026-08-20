import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * `GET /invite` が返す招待発行画面のHTML。
 *
 * frontを招待制のクローズドサービスにしたことに伴い、運用者（あなた）が
 * 招待を発行し、招待された人がその招待URLからパスキー(WebAuthn)を登録して
 * ログインする、という流れの起点となる画面。
 *
 * 外部CDNに依存しない自己完結ページ。このWorkerのホスト名自体がCloudflare Access
 * （Zero Trust）で保護されており、ここに到達できた時点で運用者本人の認証を通過済みの
 * ため、ページ・APIともにこのWorker自身の追加認証は行わない。
 */

const PAGE_STYLE = `
${CHROME_STYLE}
.group { background: var(--surface); border: 1px solid var(--line); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem; }
.group h2 { font-size: 0.9375rem; margin: 0 0 0.75rem; }
.field-row { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.3rem 0; font-size: 0.875rem; }
textarea { font: inherit; font-size: 0.875rem; padding: 0.4rem; resize: vertical; }
button { font-size: 0.875rem; padding: 0.4rem 1rem; border-radius: 0.375rem; border: none; background: var(--brand); color: #fff; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
.result-row { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
.result-row input { flex: 1; font-size: 0.875rem; padding: 0.4rem; }
.copy-status { font-size: 0.8125rem; color: var(--ink2); }
`;

const buildPageBody = (isProduction: boolean): string => `
${renderAdminHeader('招待発行', isProduction, '/invite')}
<p class="hint">招待を発行すると招待URLが発行されます。URLを本人へ共有すると、そのURLからパスキー(WebAuthn)を登録してログインできるようになります。</p>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<div class="group">
  <h2>招待の発行</h2>
  <div class="field-row">
    <label for="memo">メモ（任意・あなた専用。本人には表示されません）</label>
    <textarea id="memo" rows="2" maxlength="200"></textarea>
  </div>
  <button id="issue">発行</button>
  <span id="issuing" class="hint" role="status" hidden>発行中…</span>
</div>
<div id="result" class="group" role="status" hidden>
  <h2>発行された招待URL</h2>
  <div class="result-row">
    <input id="invite-url" type="text" readonly>
    <button id="copy" type="button">コピー</button>
  </div>
  <p id="copy-status" class="copy-status" role="status"></p>
</div>
`;

const buildPageScript = (): string => `
(function () {
  var errorEl = document.getElementById('error');
  var memoEl = document.getElementById('memo');
  var issueButton = document.getElementById('issue');
  var issuingEl = document.getElementById('issuing');
  var resultEl = document.getElementById('result');
  var inviteUrlEl = document.getElementById('invite-url');
  var copyButton = document.getElementById('copy');
  var copyStatusEl = document.getElementById('copy-status');

  // QADM-08: エラーはページ上部と離れた位置に出るため、スクリーンリーダー
  // 利用者・目視の双方が見落とさないようエラー要素へフォーカスを移す。
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
  }
  function clearError() {
    errorEl.hidden = true;
  }

  issueButton.addEventListener('click', function () {
    clearError();
    resultEl.hidden = true;
    copyStatusEl.textContent = '';
    var memo = memoEl.value.trim();

    issueButton.disabled = true;
    issuingEl.hidden = false;

    fetch('/invite/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo: memo.length > 0 ? memo : null }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error((data && data.message) || '発行に失敗しました（' + res.status + '）');
          }, function () {
            throw new Error('発行に失敗しました（' + res.status + '）');
          });
        }
        return res.json();
      })
      .then(function (data) {
        inviteUrlEl.value = data.inviteUrl;
        resultEl.hidden = false;
      })
      .catch(function (err) {
        showError((err && err.message) || '発行に失敗しました');
      })
      .finally(function () {
        issueButton.disabled = false;
        issuingEl.hidden = true;
      });
  });

  copyButton.addEventListener('click', function () {
    inviteUrlEl.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrlEl.value).then(function () {
        copyStatusEl.textContent = 'コピーしました';
      }, function () {
        copyStatusEl.textContent = 'コピーに失敗しました。手動で選択してコピーしてください';
      });
    } else {
      copyStatusEl.textContent = 'このブラウザは自動コピーに対応していません。手動で選択してコピーしてください';
    }
  });
})();
`;

/**
 * 招待発行画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジを出し分ける。
 * @returns `GET /invite` のレスポンスボディとして返すHTML文字列
 */
export const renderInvitePage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>招待発行（${titleSuffix}） — race-schedule admin</title>
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
