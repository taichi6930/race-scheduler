/**
 * メインAPI（@race-schedule/api）の `GET /race` が返す1レース分の要約。
 * レース詳細レイアウト編集キットのプレビュー用レース選択に使う、admin側で見た
 * 最小限のDTO（レスポンスの全フィールドではなく、選択肢の表示に必要な項目のみ）。
 */
export interface RaceSummary {
    raceId: string;
    raceName: string;
    raceCourse: string;
    raceNumber: number;
    raceGrade: string;
    /** JST ISO 8601形式の文字列（例: "2026-08-09T10:00:00+09:00"） */
    datetime: string;
}
