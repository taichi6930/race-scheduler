import {
    RACE_DETAIL_FIELD_KEYS,
    RACE_DETAIL_FIELDS,
} from '@race-schedule/core';

import {
    CHROME_STYLE,
    FRONT_COLORS,
    faviconFor,
    renderAdminHeader,
} from './adminPageChrome';

/**
 * `GET /race-detail-layout` が返すレース詳細レイアウト編集キット画面のHTML
 * （race-detail-sdui-design.md §1.4）。
 *
 * 編集できるのは「どのフィールドを・どの順で・どんなラベルで出すか」という
 * kvセクションのフィールド参照のみ（§1.2）。links/playersセクションは
 * 読み込んだ構成をそのまま保持し、この画面からは変更しない。
 *
 * production環境も編集可能にする（§1.4: 機能フラグ画面と異なり読み取り専用にしない）。
 * 事故防止は保存前の「プレビュー→適用」の2段で担保する。
 */

/** サーバ側フィールドカタログから、画面に埋め込む `{key, defaultLabel}` の一覧を作る。 */
const FIELD_CATALOG = RACE_DETAIL_FIELD_KEYS.map((key) => ({
    key,
    defaultLabel: RACE_DETAIL_FIELDS[key].defaultLabel,
}));

const PAGE_STYLE = `
${CHROME_STYLE}
.usage-steps { background: ${FRONT_COLORS.surface}; border: 1px solid ${FRONT_COLORS.line}; border-radius: 0.5rem; padding: 1rem 1rem 1rem 2rem; margin: 0.75rem 0; font-size: 0.875rem; line-height: 1.6; }
.usage-steps li { margin-bottom: 0.25rem; }
.usage-steps li:last-child { margin-bottom: 0; }
table { border-collapse: collapse; width: 100%; margin-top: 1rem; background: ${FRONT_COLORS.surface}; }
th, td { border: 1px solid ${FRONT_COLORS.line}; padding: 0.5rem; text-align: left; font-size: 0.875rem; }
th { background: ${FRONT_COLORS.surface2}; }
caption { caption-side: bottom; text-align: left; font-size: 0.8125rem; color: ${FRONT_COLORS.ink2}; padding-top: 0.5rem; }
td input[type="text"] { font-size: 0.875rem; padding: 0.25rem; width: 100%; box-sizing: border-box; }
select { font-size: 0.875rem; padding: 0.35rem; }
button { font-size: 0.875rem; padding: 0.35rem 0.9rem; border-radius: 0.375rem; border: none; background: ${FRONT_COLORS.brand}; color: #fff; cursor: pointer; }
button.secondary { background: ${FRONT_COLORS.surface2}; color: ${FRONT_COLORS.ink}; border: 1px solid ${FRONT_COLORS.line}; }
button:disabled { opacity: 0.5; cursor: default; }
.move-buttons button { padding: 0.15rem 0.5rem; margin-right: 0.25rem; }
.preview-controls { margin-top: 1.5rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.preview-controls select#preview-race-select { min-width: 22rem; }
.apply-warning { color: ${FRONT_COLORS.danger}; font-size: 0.8125rem; margin: 0.35rem 0 0; }
.preview-output { margin-top: 1rem; }
.preview-output table { margin-top: 0.5rem; }
.preview-output h3 { font-size: 0.875rem; margin: 1rem 0 0.25rem; }
`;

/**
 * ページ本体HTMLを組み立てる。
 * @param isProduction - production環境なら true
 * @returns `<body>`直下のHTML
 */
const buildPageBody = (isProduction: boolean): string => `
${renderAdminHeader('レース詳細レイアウト編集キット（競輪）', isProduction, '/race-detail-layout')}
<p class="hint">競輪のレース詳細画面（kvセクション）に表示するフィールドの選択・順序・ラベルを調整できます。</p>
<ol class="usage-steps">
  <li>下の表で表示したいフィールドにチェックを入れます。ラベル欄は空欄のままなら既定のラベル（プレースホルダーの文字）で表示されます。</li>
  <li>↑↓ボタンで表示順を並び替えます（チェックを外した項目も含め、表全体の並び順が保存されます）。</li>
  <li>「プレビュー用レース」で確認したいレースを選び、「プレビュー」ボタンを押すと実際の値で解決した結果を下に表示します。</li>
  <li>内容に問題が無ければ「適用」ボタンで保存します。保存すると<strong>テスト環境・本番環境ともにレース詳細画面へすぐに反映されます</strong>。</li>
</ol>
<p id="error" class="error" role="alert" tabindex="-1" hidden></p>
<table id="fields" hidden>
  <caption>「フィールド」列のカッコ内は内部キーです。「表示ラベル」を入力すると既定のラベルの代わりに使われます。</caption>
  <thead>
    <tr><th>表示</th><th>フィールド</th><th>表示ラベル</th><th>並び替え</th></tr>
  </thead>
  <tbody id="fields-body"></tbody>
</table>
<div class="preview-controls">
  <label for="preview-race-select">プレビュー用レース</label>
  <select id="preview-race-select"></select>
  <button id="preview-button" type="button" class="secondary">プレビュー</button>
  <button id="apply-button" type="button">適用</button>
</div>
<p class="apply-warning">「適用」は保存操作です。テスト環境・本番環境ともに即座にレース詳細画面へ反映されます。</p>
<p id="preview-error" class="error" role="alert" tabindex="-1" hidden></p>
<div id="preview-output" class="preview-output"></div>
`;

/** API呼び出しのタイムアウト（ミリ秒）。QADM-03: 応答が返らないままボタンが固まるのを防ぐ。 */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * ページ埋め込みスクリプトを組み立てる。
 * @returns `<script>`要素の中身
 */
const buildPageScript = (): string => `
(function () {
  var FETCH_TIMEOUT_MS = ${FETCH_TIMEOUT_MS};
  var FIELD_CATALOG = ${JSON.stringify(FIELD_CATALOG)};
  var errorEl = document.getElementById('error');
  var tableEl = document.getElementById('fields');
  var tbodyEl = document.getElementById('fields-body');
  var previewErrorEl = document.getElementById('preview-error');
  var previewOutputEl = document.getElementById('preview-output');
  var previewButton = document.getElementById('preview-button');
  var applyButton = document.getElementById('apply-button');
  var raceSelectEl = document.getElementById('preview-race-select');
  var otherSections = [];
  // QADM-05: 未保存の変更を持ったままタブを閉じる・別画面へ移動する事故を防ぐ。
  var dirty = false;
  function markDirty() {
    dirty = true;
  }
  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
  // 行は動的に生成されるため、チェックボックス・ラベル入力の変更検知は
  // tbodyEl への委譲イベントで行う。
  tbodyEl.addEventListener('change', markDirty);
  tbodyEl.addEventListener('input', markDirty);

  // QADM-08: エラー要素は操作対象から離れた位置に出るため、スクリーンリーダー
  // 利用者・目視の双方が見落とさないようエラー要素へフォーカスを移す。
  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
    el.focus();
  }
  function clearError(el) {
    el.hidden = true;
  }
  // QADM-03: タイムアウトを設定し、応答が返らないままボタンが固まるのを防ぐ。
  function fetchWithTimeout(path, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    var opts = Object.assign({}, options, { signal: controller.signal });
    return fetch(path, opts).catch(function (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('タイムアウトしました（' + (FETCH_TIMEOUT_MS / 1000) + '秒）。再度お試しください');
      }
      throw err;
    }).finally(function () {
      clearTimeout(timer);
    });
  }
  function labelForKey(key) {
    var found = FIELD_CATALOG.filter(function (f) { return f.key === key; })[0];
    return found ? found.defaultLabel : key;
  }

  function renderRows(orderedKeys, includedKeys, labels) {
    tbodyEl.innerHTML = '';
    orderedKeys.forEach(function (key) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-key', key);

      var toggleCell = document.createElement('td');
      var toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'field-toggle';
      toggle.checked = includedKeys.indexOf(key) !== -1;
      toggleCell.appendChild(toggle);
      tr.appendChild(toggleCell);

      var nameCell = document.createElement('td');
      nameCell.textContent = labelForKey(key) + '（' + key + '）';
      tr.appendChild(nameCell);

      var labelCell = document.createElement('td');
      var labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'field-label';
      labelInput.placeholder = labelForKey(key);
      labelInput.value = labels[key] || '';
      labelCell.appendChild(labelInput);
      tr.appendChild(labelCell);

      var moveCell = document.createElement('td');
      moveCell.className = 'move-buttons';
      var upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.textContent = '↑';
      upButton.addEventListener('click', function () {
        var prev = tr.previousElementSibling;
        if (prev) {
          tbodyEl.insertBefore(tr, prev);
          markDirty();
        }
      });
      var downButton = document.createElement('button');
      downButton.type = 'button';
      downButton.textContent = '↓';
      downButton.addEventListener('click', function () {
        var next = tr.nextElementSibling;
        if (next) {
          tbodyEl.insertBefore(next, tr);
          markDirty();
        }
      });
      moveCell.appendChild(upButton);
      moveCell.appendChild(downButton);
      tr.appendChild(moveCell);

      tbodyEl.appendChild(tr);
    });
    tableEl.hidden = false;
  }

  function formatRaceOptionLabel(race) {
    var date = new Date(race.datetime);
    var datePart = isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return datePart + ' ' + race.raceCourse + ' ' + race.raceNumber + 'R ' +
      (race.raceGrade ? race.raceGrade + ' ' : '') + race.raceName;
  }

  function loadRaceOptions() {
    raceSelectEl.innerHTML = '';
    raceSelectEl.disabled = true;
    previewButton.disabled = true;
    fetchWithTimeout('/race-detail-layout/api/races')
      .then(function (res) {
        if (!res.ok) {
          showError(previewErrorEl, 'プレビュー候補レースの読み込みに失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.races.length === 0) {
          var emptyOption = document.createElement('option');
          emptyOption.textContent = '直近14日以内に競輪の開催予定がありません';
          raceSelectEl.appendChild(emptyOption);
          return;
        }
        data.races.forEach(function (race) {
          var option = document.createElement('option');
          option.value = race.raceId;
          option.textContent = formatRaceOptionLabel(race);
          raceSelectEl.appendChild(option);
        });
        raceSelectEl.disabled = false;
        previewButton.disabled = false;
      })
      .catch(function () {
        showError(previewErrorEl, 'プレビュー候補レースの読み込みに失敗しました');
      });
  }

  function loadConfig() {
    clearError(errorEl);
    fetchWithTimeout('/race-detail-layout/api')
      .then(function (res) {
        if (!res.ok) {
          showError(errorEl, '読み込みに失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        var kvSection = data.config.sections.filter(function (s) { return s.type === 'kv'; })[0];
        otherSections = data.config.sections.filter(function (s) { return s.type !== 'kv'; });
        var includedKeys = (kvSection ? kvSection.fields : []).map(function (f) { return f.key; });
        var labels = {};
        (kvSection ? kvSection.fields : []).forEach(function (f) {
          if (f.label) labels[f.key] = f.label;
        });
        var remainingKeys = FIELD_CATALOG.map(function (f) { return f.key; })
          .filter(function (key) { return includedKeys.indexOf(key) === -1; });
        renderRows(includedKeys.concat(remainingKeys), includedKeys, labels);
        dirty = false;
      })
      .catch(function () {
        showError(errorEl, '読み込みに失敗しました');
      });
  }

  function buildConfig() {
    var kvFields = [];
    Array.prototype.forEach.call(tbodyEl.querySelectorAll('tr'), function (tr) {
      var toggle = tr.querySelector('.field-toggle');
      if (!toggle.checked) return;
      var key = tr.getAttribute('data-key');
      var labelValue = tr.querySelector('.field-label').value.trim();
      var field = { key: key };
      if (labelValue && labelValue !== labelForKey(key)) field.label = labelValue;
      kvFields.push(field);
    });
    return { sections: [{ type: 'kv', fields: kvFields }].concat(otherSections) };
  }

  function renderPreviewOutput(ui) {
    previewOutputEl.innerHTML = '';
    ui.sections.forEach(function (section) {
      var heading = document.createElement('h3');
      if (section.type === 'kv') {
        heading.textContent = 'KV';
        previewOutputEl.appendChild(heading);
        var table = document.createElement('table');
        section.rows.forEach(function (row) {
          var tr = document.createElement('tr');
          var th = document.createElement('th');
          th.textContent = row.label;
          var td = document.createElement('td');
          td.textContent = row.value;
          tr.appendChild(th);
          tr.appendChild(td);
          table.appendChild(tr);
        });
        previewOutputEl.appendChild(table);
      } else if (section.type === 'links') {
        heading.textContent = 'リンク';
        previewOutputEl.appendChild(heading);
        var list = document.createElement('ul');
        section.items.forEach(function (item) {
          var li = document.createElement('li');
          li.textContent = item.label + ': ' + item.url;
          list.appendChild(li);
        });
        previewOutputEl.appendChild(list);
      } else if (section.type === 'players') {
        heading.textContent = section.title + '（' + section.rows.length + '件、★' + (section.watchToggle ? '有効' : '無効') + '）';
        previewOutputEl.appendChild(heading);
      }
    });
  }

  previewButton.addEventListener('click', function () {
    clearError(previewErrorEl);
    var raceId = raceSelectEl.value;
    if (!raceId) {
      showError(previewErrorEl, 'プレビュー用レースを選択してください');
      return;
    }
    fetchWithTimeout('/race-detail-layout/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: buildConfig(), raceId: raceId }),
    })
      .then(function (res) {
        if (!res.ok) {
          showError(previewErrorEl, 'プレビューに失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) renderPreviewOutput(data);
      })
      .catch(function () {
        showError(previewErrorEl, 'プレビューに失敗しました');
      });
  });

  applyButton.addEventListener('click', function () {
    clearError(errorEl);
    applyButton.disabled = true;
    fetchWithTimeout('/race-detail-layout/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: buildConfig() }),
    })
      .then(function (res) {
        if (!res.ok) {
          showError(errorEl, '適用に失敗しました（' + res.status + '）');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) loadConfig();
      })
      .catch(function () {
        showError(errorEl, '適用に失敗しました');
      })
      .finally(function () {
        applyButton.disabled = false;
      });
  });

  loadConfig();
  loadRaceOptions();
})();
`;

/**
 * レース詳細レイアウト編集キット画面のHTML全体を組み立てる。
 * @param isProduction - production環境なら true。favicon・環境バッジを出し分ける。
 * @returns `GET /race-detail-layout` のレスポンスボディとして返すHTML文字列
 */
export const renderRaceDetailLayoutPage = (isProduction: boolean): string => {
    const titleSuffix = isProduction ? 'prod' : 'test';
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>レース詳細レイアウト編集キット（${titleSuffix}） — race-schedule admin</title>
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
