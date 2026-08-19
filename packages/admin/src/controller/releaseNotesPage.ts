import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * `GET /release-notes` が返す更新履歴一覧画面のHTML。
 *
 * frontの更新履歴画面（What's New）は公開リポジトリ（race-scheduler）分しか
 * 表示しないため、分割元の非公開リポジトリ（race-schedule）分を含む全件を
 * 確認できる運用者専用の画面として用意した（ユーザー依頼: 「非公開の更新は
 * 自分だけ見れるようにしたい」）。閲覧専用（更新・削除操作は無い）。
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
.repo-badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; font-weight: bold; }
.repo-badge.public { background: var(--brand); color: #fff; }
.repo-badge.private { background: var(--danger); color: #fff; }
details summary { cursor: pointer; color: var(--brand); }
details pre { white-space: pre-wrap; word-break: break-word; font-size: 0.8125rem; margin: 0.5rem 0 0; }
`;

const buildPageBody = (isProduction: boolean): string => `
${renderAdminHeader('更新履歴（全リポジトリ）', isProduction, '/release-notes')}
<p class="hint">分割元の非公開リポジトリ（race-schedule）分を含む全リリースを確認できます（閲覧専用）。</p>
<p id="loading" class="hint" role="status">読み込み中…</p>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<p id="empty" class="hint" hidden>登録済みのリリースがありません。</p>
<table id="notes" hidden>
  <thead>
    <tr><th>バージョン</th><th>リポジトリ</th><th>公開日時（JST）</th><th>状態</th><th>本文</th></tr>
  </thead>
  <tbody id="notes-body"></tbody>
</table>
`;

const buildPageScript = (): string => `
(function () {
  var loadingEl = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var emptyEl = document.getElementById('empty');
  var tableEl = document.getElementById('notes');
  var tbodyEl = document.getElementById('notes-body');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
  }
  function td(node) {
    var cell = document.createElement('td');
    if (typeof node === 'string') {
      cell.textContent = node;
    } else {
      cell.appendChild(node);
    }
    return cell;
  }
  function formatPublishedAt(value) {
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
      hour12: false,
    });
  }
  function renderRepoBadge(sourceRepo) {
    var span = document.createElement('span');
    var isPublic = sourceRepo === 'race-scheduler';
    span.className = 'repo-badge ' + (isPublic ? 'public' : 'private');
    span.textContent = isPublic ? '公開 (' + sourceRepo + ')' : '非公開 (' + sourceRepo + ')';
    return span;
  }
  function renderState(note) {
    var parts = [];
    if (note.draft) parts.push('draft');
    if (note.prerelease) parts.push('prerelease');
    return parts.length > 0 ? parts.join(', ') : '-';
  }
  function renderBody(body) {
    if (!body) return document.createTextNode('-');
    var details = document.createElement('details');
    var summary = document.createElement('summary');
    summary.textContent = '本文を表示';
    var pre = document.createElement('pre');
    pre.textContent = body;
    details.appendChild(summary);
    details.appendChild(pre);
    return details;
  }
  function renderRow(note) {
    var tr = document.createElement('tr');
    tr.appendChild(td(note.name || note.tag_name));
    tr.appendChild(td(renderRepoBadge(note.source_repo)));
    tr.appendChild(td(formatPublishedAt(note.published_at)));
    tr.appendChild(td(renderState(note)));
    tr.appendChild(td(renderBody(note.body)));
    return tr;
  }
  function renderNotes(notes) {
    if (notes.length === 0) {
      tableEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    tbodyEl.innerHTML = '';
    notes.forEach(function (note) {
      tbodyEl.appendChild(renderRow(note));
    });
    tableEl.hidden = false;
  }

  fetch('/release-notes/api')
    .then(function (res) {
      if (!res.ok) {
        showError('読み込みに失敗しました（' + res.status + '）');
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (data) renderNotes(data);
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
 * 更新履歴一覧画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジの出し分けに使う。
 * @returns `GET /release-notes` のレスポンスボディとして返すHTML文字列
 */
export const renderReleaseNotesPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>更新履歴（${titleSuffix}） — race-schedule admin</title>
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
