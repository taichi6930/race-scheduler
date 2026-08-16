import { normalizeToHalfWidth } from '../../../utilities/format';
import {
    applyReplaceRules,
    type ReplaceRule,
    STAKES_CUP_ABBREVIATIONS,
} from '../../../utilities/replaceRules';
import type { RaceCourse } from '../../model/valueObject/raceCourse';
import type { RaceName } from '../../model/valueObject/raceName';

interface NarRaceDataForRaceName {
    name: RaceName;
    place: RaceCourse;
}

interface PlaceRules {
    placeList: RaceCourse[];
    ruleList: ReplaceRule[];
    specialHandlerList?: ((name: string) => string | null)[];
}

const COMMON_RULES: ReplaceRule[] = [
    ...STAKES_CUP_ABBREVIATIONS.map(
        ({ needle, replacement }): ReplaceRule => ({
            pattern: new RegExp(needle, 'g'),
            replacement,
        }),
    ),
    { pattern: /J([交指認]) /g, replacement: '' },
    { pattern: /\u{3000}/gu, replacement: ' ' },
    { pattern: /^第\d+回/g, replacement: '' },
    // 「(準重賞(3上)」のように、グレード・年齢条件が丸括弧書きでレース名末尾に
    // そのまま残るサイトがあるため、括弧ごと除去する（Issue #2460）。
    { pattern: /\(準?重賞.*$/g, replacement: '' },
];

const SPECIAL_RACE_HANDLERS: ((name: string) => string | null)[] = [
    (name) => (name.includes('西日本3歳優駿') ? '西日本3歳優駿' : null),
    (name) => (name.includes('西日本ダービー') ? '西日本ダービー' : null),
];

const PLACE_SPECIFIC_RULES: PlaceRules[] = [
    {
        placeList: ['帯広ば'],
        ruleList: [
            {
                pattern:
                    /[2-5]?・?[3-5]?歳?(?:以上)?(?:牡馬|牝馬)?(オープン?|選抜).*/g,
                replacement: '',
            },
            {
                pattern: /.*ヤングチャンピオンシップ.*/g,
                replacement: 'ヤングチャンピオンシップ',
            },
        ],
    },
    {
        placeList: ['門別'],
        ruleList: [
            {
                pattern: /[2-4]?歳?(?:一般)?(?:牝馬)?(オー(?:プン?)?)$/g,
                replacement: '',
            },
            {
                pattern: /.*ブリーダーズゴールドジュニア.*/g,
                replacement: 'ブリーダーズゴールドジュニアC',
            },
            { pattern: /〔準重賞〕.*/g, replacement: '' },
        ],
    },
    {
        placeList: ['水沢', '盛岡'],
        ruleList: [
            {
                pattern: /(オープン|([23])歳)(?:牝馬)?.*/g,
                replacement: '',
            },
            {
                pattern: /.*岩手県知事杯ORO.*/g,
                replacement: '岩手県知事杯OROカップ',
            },
            { pattern: /.*南部杯.*/g, replacement: 'MCS南部杯' },
            {
                pattern: /.*スプリング.*/g,
                replacement: 'スプリングC（岩手）',
            },
        ],
        specialHandlerList: [(name) => (name === '2歳' ? '2歳' : null)],
    },
    {
        placeList: ['浦和', '船橋'],
        ruleList: [
            { pattern: /3歳未格選抜馬/g, replacement: '' },
            {
                pattern: /([2-4])[上歳]?(?:牝馬)?(オープン).*/g,
                replacement: '',
            },
            { pattern: /(A2|B1).*/g, replacement: '' },
            { pattern: /オープン4上$/g, replacement: 'オープン' },
        ],
    },
    {
        placeList: ['川崎'],
        ruleList: [
            { pattern: /【地方交流3歳/g, replacement: '' },
            {
                pattern: /([2-4])[上歳]?(?:牝馬)?1?(オープン).*/g,
                replacement: '',
            },
            {
                pattern: /【(国際|指定|地方|JRA・地方)交流】.*/g,
                replacement: '',
            },
            { pattern: /ホクト.*/g, replacement: '' },
            { pattern: /(A2|2歳1).*/g, replacement: '' },
            { pattern: /4歳上*/g, replacement: '' },
        ],
    },
    {
        placeList: ['大井'],
        ruleList: [
            {
                pattern: /[2-4]?[上歳]?(選定馬|(?:牝馬)?(オー(?:プン?)?)).*/g,
                replacement: '',
            },
            {
                pattern: /.*ゴールドジュニア.*/g,
                replacement: 'ゴールドジュニア（大井）',
            },
            { pattern: /メイカA2B1/g, replacement: 'メイC' },
        ],
    },
    {
        placeList: ['金沢'],
        ruleList: [
            {
                pattern: /\(金沢ファン\).*/g,
                replacement: '移転50周年記念金沢ファンセレクトC',
            },
            {
                pattern: /(【|([2-4]?歳(?:以上)?(?:牝馬)?(?:オープン)?)).*/g,
                replacement: '',
            },
            { pattern: /((A|B1)級|A1二A2)$/g, replacement: '' },
        ],
    },
    {
        placeList: ['名古屋'],
        ruleList: [
            {
                pattern: /[23]?歳?(?:牝馬)?(オープン).*/g,
                replacement: '',
            },
            {
                pattern: /.*スプリング.*/g,
                replacement: 'スプリングC（名古屋）',
            },
            { pattern: /.*尾張名古屋杯.*/g, replacement: '尾張名古屋杯' },
            { pattern: /.*あすなろ杯.*/g, replacement: 'あすなろ杯' },
            {
                pattern: /.*ネクストスター.*/g,
                replacement: 'ネクストスター名古屋',
            },
            { pattern: /(BC?)$/g, replacement: '' },
        ],
    },
    {
        placeList: ['笠松'],
        ruleList: [
            {
                pattern:
                    /(オープン|([2-4])歳)(?:以上)?(?:牡馬|牝馬|牡牝)?・?(オープン).*/g,
                replacement: '',
            },
        ],
        specialHandlerList: [
            (name) =>
                name.includes('ゴールドジュニア')
                    ? 'ゴールドジュニア（笠松）'
                    : null,
            (name) => (name.includes('東海ゴールド') ? '東海ゴールドC' : null),
        ],
    },
    {
        placeList: ['園田', '姫路'],
        ruleList: [
            {
                pattern: /([2-4])歳(?:以上)?(?:牝馬)?.*/g,
                replacement: '',
            },
        ],
    },
    {
        placeList: ['高知'],
        ruleList: [
            // 「歳」を必須にする（園田・姫路と同じ形）。「歳?」（任意）だと
            // "C3-15"（クラス番号15）の "3" のような、年齢条件と無関係な
            // 数字にまでマッチし、後続の ".*" ごと削って "C" だけが残る
            // 事故が起きる。2026年1〜8月の公式CSVで検証したところ、この
            // バグにより高知は開催日の99%（72日中71日）で複数レースが
            // 同じ名前（"C"等）に潰れていた。
            {
                pattern: /([2-4])歳(?:以上)?(?:牝馬)?.*/g,
                replacement: '',
            },
            { pattern: /((B|C)級以下)$/g, replacement: '' },
        ],
    },
    {
        placeList: ['佐賀'],
        ruleList: [
            {
                pattern: /[2-4]?歳?(?:牝馬)?(九州産|オー(?:プン?)?)$/g,
                replacement: '',
            },
            { pattern: /(A1・B)$/g, replacement: '' },
            {
                pattern: /(A1(?:・A2)?|B|3歳|2歳)$/g,
                replacement: '',
            },
        ],
    },
];

/**
 * 置換ルールを適用してレース名を組み立てる（前後空白の除去前）。
 *
 * 複数の return を持つため、前後空白の除去は呼び出し元の
 * {@link processNarRaceName} で一括して行う。
 * @param raceInfo - レース名と開催場
 */
const applyNarRaceNameRules = (raceInfo: NarRaceDataForRaceName): string => {
    // 共通系の前処理
    let temporaryRaceName = normalizeToHalfWidth(raceInfo.name);

    // 共通ルールを適用
    temporaryRaceName = applyReplaceRules(temporaryRaceName, COMMON_RULES);

    // 特別なレース判定
    for (const handler of SPECIAL_RACE_HANDLERS) {
        const result = handler(temporaryRaceName);
        if (result !== null) {
            return result;
        }
    }

    // 場所固有のルールを適用
    const placeRule = PLACE_SPECIFIC_RULES.find((rule) =>
        rule.placeList.includes(raceInfo.place),
    );

    if (!placeRule) {
        return temporaryRaceName;
    }

    // 特別ハンドラーを実行（存在する場合）
    if (placeRule.specialHandlerList) {
        for (const handler of placeRule.specialHandlerList) {
            const result = handler(temporaryRaceName);
            if (result !== null) {
                return result;
            }
        }
    }

    // 場所固有のルールを適用
    return applyReplaceRules(temporaryRaceName, placeRule.ruleList);
};

/**
 * NARのレース名を表示用に整形する。
 *
 * 回次表記（「第57回 旭川記念」）やクラス表記（「C3二」）を除去した結果、
 * レース名の前後に区切りの空白だけが残ることがあるため、最後に必ず除去する。
 * 除去しないと `" 旭川記念"` や `"C3 "` のような名称がそのままDBへ保存される
 * （2026年7月分のNARレースだけで末尾空白67件・先頭空白22件が該当した）。
 * @param raceInfo - レース名と開催場
 */
export const processNarRaceName = (raceInfo: NarRaceDataForRaceName): string =>
    applyNarRaceNameRules(raceInfo).trim();
