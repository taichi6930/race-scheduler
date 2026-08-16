import {
    AUTORACE_STAGE_ALIAS_LIST,
    AUTORACE_STAGE_PRIORITY_LIST,
} from './autorace';
import {
    BOATRACE_STAGE_ALIAS_LIST,
    BOATRACE_STAGE_PRIORITY_LIST,
} from './boatrace';
import { KEIRIN_STAGE_ALIAS_LIST, KEIRIN_STAGE_PRIORITY_LIST } from './keirin';
import type { StageAliasEntry, StagePriorityEntry } from './types';

export type { StageAliasEntry, StagePriorityEntry } from './types';

/**
 * ステージの表記ゆれマスタ（`(raceType, stage)` 単位）。
 *
 * 競技種別（KEIRIN/AUTORACE/BOATRACE）ごとにファイル分割されたリストを
 * 元の並び順（KEIRIN → AUTORACE → BOATRACE）のまま結合したもの。
 * grade非依存（同じstageなら、どのgradeで使われていてもWebサイト表記の
 * パターンは共通）のため、優先度マスタ（{@link StagePriorityList}）とは
 * 独立して1レコードのみ持つ。フィールドの意味は {@link StageAliasEntry} を参照。
 *
 * ## 追加時の確認事項
 *
 * 新規ステージ表記を追加する際は以下を確認してください：
 * 1. **PR/issue の説明と `stage` が一致しているか確認**
 * 2. `stageByWebSite` には実際のサイトで見つかる表記を全て列挙
 * 3. `stage` は常に正規化された標準表記を使用
 */
export const StageAliasList: readonly StageAliasEntry[] = [
    ...KEIRIN_STAGE_ALIAS_LIST,
    ...AUTORACE_STAGE_ALIAS_LIST,
    ...BOATRACE_STAGE_ALIAS_LIST,
];

/**
 * ステージ優先度マスタ（`(raceType, grade, stage)` 単位）。
 *
 * 競技種別（KEIRIN/AUTORACE/BOATRACE）ごとにファイル分割されたリストを
 * 元の並び順（KEIRIN → AUTORACE → BOATRACE）のまま結合したもの。
 * フィールドの意味は {@link StagePriorityEntry} を参照。
 *
 * ## 追加時の確認事項
 *
 * 新規ステージを追加する際は以下を確認してください：
 * 1. **PR/issue の説明と `stage` が一致しているか確認**
 * 2. `stage` に対応する {@link StageAliasList} のエントリが存在するか確認
 *    （無ければ併せて追加する）
 */
export const StagePriorityList: readonly StagePriorityEntry[] = [
    ...KEIRIN_STAGE_PRIORITY_LIST,
    ...AUTORACE_STAGE_PRIORITY_LIST,
    ...BOATRACE_STAGE_PRIORITY_LIST,
];
