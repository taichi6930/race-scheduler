import { RaceType } from '@race-schedule/core';

import {
    CHROME_STYLE,
    FRONT_COLORS,
    faviconFor,
    renderAdminHeader,
} from './adminPageChrome';

/**
 * `GET /backfill` が返すバックフィル（R2キャッシュのみでの再同期）実行画面の
 * HTML。生スクレイピングは行わず（`cacheOnly: true` 固定、api側で強制）、
 * 既にR2にキャッシュされた過去のHTMLを現在のパーサーで再パース・再Upsertする
 * だけのため、対象サイトへの新規アクセスは発生しない。
 *
 * front（`/backfill`画面）から移設したもの（2026-08-08、確実に運用者専用の
 * 機能であるため）。配色・favicon・環境バッジ等の共通部分は
 * `adminPageChrome.ts`に集約している。
 */

const RACE_TYPE_VALUES: readonly string[] = Object.values(RaceType);

const PAGE_STYLE = `
${CHROME_STYLE}
.group { background: ${FRONT_COLORS.surface}; border: 1px solid ${FRONT_COLORS.line}; border-radius: 0.5rem; padding: 1rem; margin-top: 1rem; }
.group h2 { font-size: 0.9375rem; margin: 0 0 0.75rem; }
.checkbox-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; font-size: 0.875rem; }
.field-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; font-size: 0.875rem; }
.field-row label { width: 6rem; flex-shrink: 0; }
input[type="date"], select { font-size: 0.875rem; padding: 0.25rem; }
button { font-size: 0.875rem; padding: 0.4rem 1rem; border-radius: 0.375rem; border: none; background: ${FRONT_COLORS.brand}; color: #fff; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
.result { font-size: 0.875rem; margin-top: 0.5rem; }
`;

/**
 * ページ本体HTMLを組み立てる。
 * @param isProduction - production環境なら true
 * @returns `<body>`直下のHTML
 */
const buildPageBody = (isProduction: boolean): string => {
    const raceTypeRows = RACE_TYPE_VALUES.map(
        (raceType) => `
    <label class="checkbox-row">
      <input type="checkbox" name="raceType" value="${raceType}" ${raceType === RaceType.KEIRIN ? 'checked' : ''}>
      ${raceType}
    </label>`,
    ).join('');

    return `
${renderAdminHeader('バックフィル実行', isProduction, '/backfill')}
<p class="hint">R2に既にキャッシュされたHTMLだけを使って再パース・再Upsertします。生スクレイピング（対象サイトへの新規アクセス）は行いません。</p>
<p id="error" class="error" hidden></p>
<div class="group">
  <h2>レース種別</h2>
  ${raceTypeRows}
</div>
<div class="group">
  <h2>期間</h2>
  <div class="field-row"><label for="startDate">開始日</label><input type="date" id="startDate"></div>
  <div class="field-row"><label for="finishDate">終了日</label><input type="date" id="finishDate"></div>
  <div class="field-row">
    <label for="target">対象データ</label>
    <select id="target">
      <option value="race" selected>レース情報</option>
      <option value="place">開催情報</option>
      <option value="both">両方</option>
    </select>
  </div>
</div>
<div class="group">
  <h2>操作</h2>
  <button id="run">実行</button>
  <span id="running" class="hint" hidden>実行中…</span>
</div>
<div id="result" class="group" hidden>
  <h2>結果</h2>
  <div id="result-body"></div>
</div>
`;
};

/**
 * ページ埋め込みスクリプトを組み立てる。
 * @returns `<script>`要素の中身
 */
const buildPageScript = (): string => `
(function () {
  var errorEl = document.getElementById('error');
  var runButton = document.getElementById('run');
  var runningEl = document.getElementById('running');
  var resultEl = document.getElementById('result');
  var resultBodyEl = document.getElementById('result-body');

  function jstDateString(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(date);
  }
  function today() {
    return jstDateString(new Date());
  }
  function daysAgo(days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    return jstDateString(date);
  }
  document.getElementById('startDate').value = daysAgo(30);
  document.getElementById('finishDate').value = today();

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  function clearError() {
    errorEl.hidden = true;
  }
  function selectedRaceTypes() {
    var checkboxes = document.querySelectorAll('input[name="raceType"]:checked');
    return Array.prototype.map.call(checkboxes, function (el) {
      return el.value;
    });
  }
  function formatResult(label, result, notCachedKey) {
    var notCached = result[notCachedKey] || [];
    return label + ': 成功' + result.successCount + '件 / 失敗' +
      result.failureCount + '件 / キャッシュ無し' + notCached.length + '件';
  }
  function runBackfill(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error((data && data.message) || '実行に失敗しました（' + res.status + '）');
        }, function () {
          throw new Error('実行に失敗しました（' + res.status + '）');
        });
      }
      return res.json();
    });
  }

  runButton.addEventListener('click', function () {
    clearError();
    var raceTypeList = selectedRaceTypes();
    if (raceTypeList.length === 0) {
      showError('レース種別を1つ以上選択してください');
      return;
    }
    var startDate = document.getElementById('startDate').value;
    var finishDate = document.getElementById('finishDate').value;
    if (startDate > finishDate) {
      showError('開始日は終了日より前にしてください');
      return;
    }
    var target = document.getElementById('target').value;
    var body = { startDate: startDate, finishDate: finishDate, raceTypeList: raceTypeList };

    runButton.disabled = true;
    runningEl.hidden = false;
    resultEl.hidden = true;

    var tasks = [];
    if (target === 'place' || target === 'both') {
      tasks.push(
        runBackfill('/backfill/api/place', body).then(function (result) {
          return formatResult('開催情報', result, 'notCachedKeys');
        }),
      );
    }
    if (target === 'race' || target === 'both') {
      tasks.push(
        runBackfill('/backfill/api/race', body).then(function (result) {
          return formatResult('レース情報', result, 'notCachedPlaceIds');
        }),
      );
    }

    Promise.allSettled(tasks)
      .then(function (settled) {
        resultBodyEl.innerHTML = '';
        var errors = [];
        settled.forEach(function (result) {
          if (result.status === 'fulfilled') {
            var p = document.createElement('p');
            p.textContent = result.value;
            resultBodyEl.appendChild(p);
          } else {
            errors.push(result.reason && result.reason.message || '実行に失敗しました');
          }
        });
        resultEl.hidden = false;
        if (errors.length > 0) {
          showError(errors.join(' / '));
        } else {
          clearError();
        }
      })
      .finally(function () {
        runButton.disabled = false;
        runningEl.hidden = true;
      });
  });
})();
`;

/**
 * バックフィル実行画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジを出し分ける。
 * @returns `GET /backfill` のレスポンスボディとして返すHTML文字列
 */
export const renderBackfillPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>バックフィル実行（${titleSuffix}） — race-schedule admin</title>
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
