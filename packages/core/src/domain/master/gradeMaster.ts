import { RaceType } from '../model/valueObject/raceType';

/**
 * BOATRACE で取得するグレードコード（hcd）。
 * '01'=SG/PG1, '02'=G1/G2, '03'=G3, '06'=MASTERS
 */
export const BOATRACE_HCD_CODES = ['01', '02', '03', '06'] as const;

/**
 * グレードの重要度階層。
 *
 * front（design-system.md §2.2）の見た目階層と対応する。tier 自体は
 * バックエンドのビジネスロジック（`isSpecified`・priority判定）には使用せず、
 * front での色分け表示のためだけに存在する分類。
 */
export type GradeTier = 'top' | 'high' | 'mid' | 'low' | 'none';

/** グレード1件分のマスタエントリ。 */
export interface GradeMasterEntry {
    /**
     * 重賞相当（指定レース）かどうか。
     * 例えばSGはBOATRACEとAUTORACEの両方で指定レースであるが、GⅠはBOATRACEでは
     * 指定レースではない。カレンダー登録可否は本フィールド単体ではなく
     * `domain/policy/calendarInclusion.ts` の判定（priority等の追加条件込み）を使うこと。
     */
    readonly isSpecified: boolean;
    /** グレードの重要度階層（front表示用）。 */
    readonly tier: GradeTier;
}

/**
 * グレードのマスタ（`raceType` → `grade名` → エントリ）。
 *
 * `(raceType, grade)` を主キーとする構造で、全消費側（グレードのバリデーション・
 * 重賞判定・front表示）はこの1テーブルを直接引く。グレード名は一般的な表記を
 * 使用しているが、実際のデータソースによっては異なる表記がされている可能性が
 * あるため、注意が必要である。
 *
 * front(Dart) の `packages/front/lib/domain/entities/grade_tier.dart` は本マスタを
 * 単一の正典とし、手動で同期した静的テーブルを持つ。バックエンドのグレードマスタが
 * 変更された場合は、そちらも追従させること。
 */
export const GradeMaster: Readonly<
    Record<RaceType, Readonly<Record<string, GradeMasterEntry>>>
> = {
    [RaceType.JRA]: {
        GⅠ: { isSpecified: true, tier: 'top' },
        GⅡ: { isSpecified: true, tier: 'high' },
        GⅢ: { isSpecified: true, tier: 'mid' },
        JpnⅠ: { isSpecified: true, tier: 'top' },
        JpnⅡ: { isSpecified: true, tier: 'high' },
        JpnⅢ: { isSpecified: true, tier: 'mid' },
        'J.GⅠ': { isSpecified: true, tier: 'top' },
        'J.GⅡ': { isSpecified: true, tier: 'high' },
        'J.GⅢ': { isSpecified: true, tier: 'mid' },
        Listed: { isSpecified: true, tier: 'low' },
        重賞: { isSpecified: true, tier: 'low' },
        オープン特別: { isSpecified: true, tier: 'low' },
        格付けなし: { isSpecified: false, tier: 'none' },
        オープン: { isSpecified: true, tier: 'low' },
        '3勝クラス': { isSpecified: false, tier: 'none' },
        '2勝クラス': { isSpecified: false, tier: 'none' },
        '1勝クラス': { isSpecified: false, tier: 'none' },
        '1600万下': { isSpecified: false, tier: 'none' },
        '1000万下': { isSpecified: false, tier: 'none' },
        '900万下': { isSpecified: false, tier: 'none' },
        '500万下': { isSpecified: false, tier: 'none' },
        未勝利: { isSpecified: false, tier: 'none' },
        未出走: { isSpecified: false, tier: 'none' },
        新馬: { isSpecified: false, tier: 'none' },
    },
    [RaceType.NAR]: {
        GⅠ: { isSpecified: true, tier: 'top' },
        GⅡ: { isSpecified: true, tier: 'high' },
        GⅢ: { isSpecified: true, tier: 'mid' },
        JpnⅠ: { isSpecified: true, tier: 'top' },
        JpnⅡ: { isSpecified: true, tier: 'high' },
        JpnⅢ: { isSpecified: true, tier: 'mid' },
        Listed: { isSpecified: true, tier: 'low' },
        重賞: { isSpecified: true, tier: 'low' },
        地方重賞: { isSpecified: true, tier: 'low' },
        地方準重賞: { isSpecified: true, tier: 'low' },
        オープン特別: { isSpecified: true, tier: 'low' },
        オープン: { isSpecified: true, tier: 'low' },
        格付けなし: { isSpecified: false, tier: 'none' },
        一般: { isSpecified: false, tier: 'none' },
        未格付: { isSpecified: false, tier: 'none' },
    },
    [RaceType.OVERSEAS]: {
        GⅠ: { isSpecified: true, tier: 'top' },
        GⅡ: { isSpecified: true, tier: 'high' },
        GⅢ: { isSpecified: true, tier: 'mid' },
        Listed: { isSpecified: true, tier: 'low' },
        格付けなし: { isSpecified: true, tier: 'none' },
    },
    [RaceType.KEIRIN]: {
        GP: { isSpecified: true, tier: 'top' },
        GⅠ: { isSpecified: true, tier: 'top' },
        GⅡ: { isSpecified: true, tier: 'high' },
        GⅢ: { isSpecified: true, tier: 'mid' },
        // FⅠ・FⅡは平場（無印）。ただし「全プロ競輪」の一部ステージのみ例外的に
        // 重賞相当として扱う（gradeStageMaster/keirin.ts の specifiedOverride 参照）。
        FⅠ: { isSpecified: false, tier: 'none' },
        FⅡ: { isSpecified: false, tier: 'none' },
    },
    [RaceType.AUTORACE]: {
        SG: { isSpecified: true, tier: 'top' },
        特GⅠ: { isSpecified: true, tier: 'top' },
        GⅠ: { isSpecified: true, tier: 'top' },
        GⅡ: { isSpecified: true, tier: 'high' },
        開催: { isSpecified: false, tier: 'none' },
    },
    [RaceType.BOATRACE]: {
        SG: { isSpecified: true, tier: 'top' },
        PGⅠ: { isSpecified: true, tier: 'top' },
        GⅠ: { isSpecified: false, tier: 'high' },
        GⅡ: { isSpecified: false, tier: 'mid' },
        GⅢ: { isSpecified: false, tier: 'mid' },
        一般: { isSpecified: false, tier: 'none' },
    },
};
