import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * `GET /flags` が返す機能フラグ管理画面のHTML（admin-package-design.md 参照）。
 *
 * 外部CDNに依存しない自己完結ページ。このWorkerのホスト名自体がCloudflare Access
 * （Zero Trust）で保護されており、ここに到達できた時点で運用者本人の認証を通過済みの
 * ため、ページ・APIともにこのWorker自身の追加認証は行わない。
 *
 * 配色・favicon・環境バッジ等の共通部分は`adminPageChrome.ts`に集約している。
 */

const PAGE_STYLE = `
${CHROME_STYLE}
table { border-collapse: collapse; width: 100%; margin-top: 1rem; background: var(--surface); }
th, td { border: 1px solid var(--line); padding: 0.5rem; text-align: left; font-size: 0.875rem; }
th { background: var(--surface2); }
.switch-cell { display: flex; align-items: center; gap: 0.5rem; }
.switch { position: relative; display: inline-block; width: 2.75rem; height: 1.5rem; flex-shrink: 0; }
.switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.switch .slider { position: absolute; inset: 0; background: #ccc; border-radius: 1.5rem; transition: background-color 0.15s; pointer-events: none; }
.switch .slider::before { content: ""; position: absolute; left: 0.15rem; top: 0.15rem; width: 1.2rem; height: 1.2rem; background: #fff; border-radius: 50%; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.switch input:checked + .slider { background: var(--brand); }
.switch input:checked + .slider::before { transform: translateX(1.25rem); }
.switch input:disabled + .slider { opacity: 0.5; }
.switch-state { font-size: 0.875rem; }
`;

/**
 * ページ本体HTMLを組み立てる。
 * @param isProduction - production環境なら true
 * @returns `<body>`直下のHTML
 */
const buildPageBody = (isProduction: boolean): string => {
    const hint = isProduction
        ? 'この画面は閲覧のみです。本番環境ではフラグの切り替えはできません。'
        : 'この環境の機能フラグを個別にON/OFFできます。';
    return `
${renderAdminHeader('機能フラグ管理', isProduction, '/flags')}
<p class="hint">${hint}</p>
<p id="loading" class="hint" role="status">読み込み中…</p>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<p id="empty" class="hint" hidden>登録済みの機能フラグがありません。</p>
<table id="flags" hidden>
  <thead>
    <tr><th>キー</th><th>説明</th><th>DB値</th><th>環境変数既定値</th><th>有効/無効</th><th>更新日時（JST）</th></tr>
  </thead>
  <tbody id="flags-body"></tbody>
</table>
`;
};

/**
 * ページ埋め込みスクリプトを組み立てる。
 * @param isProduction - production環境なら true（trueの場合、スイッチを読み取り専用にする）
 * @returns `<script>`要素の中身
 */
const buildPageScript = (isProduction: boolean): string => `
(function () {
  var READ_ONLY = ${isProduction ? 'true' : 'false'};
  var loadingEl = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var emptyEl = document.getElementById('empty');
  var tableEl = document.getElementById('flags');
  var tbodyEl = document.getElementById('flags-body');

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
  function formatBool(value) {
    if (value === undefined || value === null) return '(未設定)';
    return value ? 'ON' : 'OFF';
  }
  function formatUpdatedAt(value) {
    if (!value) return '-';
    var iso = value.indexOf('T') === -1 ? value.replace(' ', 'T') + 'Z' : value;
    var date = new Date(iso);
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
  function renderSwitchCell(flag) {
    var cell = document.createElement('td');
    var wrapper = document.createElement('div');
    wrapper.className = 'switch-cell';
    var label = document.createElement('label');
    label.className = 'switch';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!flag.effectiveEnabled;
    checkbox.disabled = READ_ONLY;
    checkbox.setAttribute('aria-label', flag.label + '（' + flag.key + '）を有効化');
    var slider = document.createElement('span');
    slider.className = 'slider';
    label.appendChild(checkbox);
    label.appendChild(slider);
    var stateText = document.createElement('span');
    stateText.className = 'switch-state';
    stateText.textContent = formatBool(flag.effectiveEnabled);
    if (!READ_ONLY) {
      checkbox.addEventListener('change', function () {
        var nextEnabled = checkbox.checked;
        checkbox.disabled = true;
        setFlag(flag.key, nextEnabled, checkbox, stateText);
      });
    }
    wrapper.appendChild(label);
    wrapper.appendChild(stateText);
    cell.appendChild(wrapper);
    return cell;
  }
  function renderRow(flag) {
    var tr = document.createElement('tr');
    tr.appendChild(td(flag.key));
    tr.appendChild(td(flag.label));
    tr.appendChild(td(formatBool(flag.storedEnabled)));
    tr.appendChild(td(formatBool(flag.envDefault)));
    tr.appendChild(renderSwitchCell(flag));
    tr.appendChild(td(formatUpdatedAt(flag.updatedAt)));
    return tr;
  }
  function renderFlags(flags) {
    if (flags.length === 0) {
      tableEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    tbodyEl.innerHTML = '';
    flags.forEach(function (flag) {
      tbodyEl.appendChild(renderRow(flag));
    });
    tableEl.hidden = false;
  }
  function loadFlags() {
    clearError();
    fetch('/flags/api')
      .then(function (res) {
        if (!res.ok) {
          showError('読み込みに失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) renderFlags(data.flags);
      })
      .catch(function () {
        showError('読み込みに失敗しました');
      })
      .finally(function () {
        // QADM-12: 初回読み込みが終わるまで一覧が空白のままだったのを解消する。
        loadingEl.hidden = true;
      });
  }
  function revertSwitch(checkboxEl, stateTextEl, previousEnabled) {
    if (!checkboxEl) return;
    checkboxEl.checked = previousEnabled;
    checkboxEl.disabled = false;
    if (stateTextEl) stateTextEl.textContent = formatBool(previousEnabled);
  }
  function setFlag(key, enabled, checkboxEl, stateTextEl) {
    clearError();
    fetch('/flags/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, enabled: enabled }),
    })
      .then(function (res) {
        if (!res.ok) {
          showError('更新に失敗しました（' + res.status + '）');
          revertSwitch(checkboxEl, stateTextEl, !enabled);
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) renderFlags(data.flags);
      })
      .catch(function () {
        showError('更新に失敗しました');
        revertSwitch(checkboxEl, stateTextEl, !enabled);
      });
  }

  loadFlags();
})();
`;

/**
 * 機能フラグ管理画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジ・
 *   スイッチの読み取り専用化を出し分ける（isProductionAdmin()の結果を
 *   featureFlagsController.tsから渡す）。
 * @returns `GET /flags` のレスポンスボディとして返すHTML文字列
 */
export const renderFeatureFlagsPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>機能フラグ管理（${titleSuffix}） — race-schedule admin</title>
<link rel="icon" href="${faviconFor(isProduction)}">
<style>${PAGE_STYLE}</style>
</head>
<body>
${buildPageBody(isProduction)}
<script>${buildPageScript(isProduction)}</script>
</body>
</html>
`;
};
