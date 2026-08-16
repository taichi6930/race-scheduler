import type { RaceType } from '../../model/valueObject/raceType';

/**
 * ステージの表記ゆれエントリ。grade非依存（同じstageであれば、どのgradeで
 * 使われていてもWebサイト表記のパターンは共通）。
 *
 * - **`stage`**: 正規化されたステージ名（一貫性のある標準表記）。常に全角文字使用。
 *   例: 'S級グランプリ', 'A級ファイナル', 'SA混合ヤンググランプリ'
 * - **`stageByWebSite`**: Webサイト上で実際に表示されるステージ名のバリエーション配列。
 *   複数の表記ゆれに対応（全角・半角、略称など）。スクレイパーが実際のサイトから
 *   取得する値。
 * - **`raceType`**: レース種別（JRA, NAR, KEIRIN, AUTORACE, BOATRACE）
 */
export interface StageAliasEntry {
    stage: string;
    stageByWebSite: string[];
    raceType: RaceType;
}

/**
 * (grade, stage) 単位の重要度エントリ。
 *
 * - **`grade`**: グレード（例: 'GⅠ', 'S級', 'FⅠ'）。複数グレードで同じ
 *   priority/descriptionを共有する場合はまとめて配列で書ける。
 * - **`stage`**: {@link StageAliasEntry.stage} を参照する正規化されたステージ名。
 * - **`raceType`**: レース種別
 * - **`priority`**: 優先度（GⅠなど重要度の高い順。0～10）
 * - **`description`**: このgrade × stageの組み合わせにおけるステージの説明文
 *   （同じstageでもgradeによって文言が変わりうるため、alias側ではなくこちらに持たせる）
 * - **`specifiedOverride`**: `GradeMaster` 上は `isSpecified: false`（平場）の
 *   グレードでも、このstageに限り重賞相当として扱う例外フラグ。
 *   例: KEIRIN「全プロ競輪」（FⅡ格式だが実質重賞相当のステージ）。
 */
export interface StagePriorityEntry {
    grade: string[];
    stage: string;
    raceType: RaceType;
    priority: number;
    description: string;
    specifiedOverride?: boolean;
}
