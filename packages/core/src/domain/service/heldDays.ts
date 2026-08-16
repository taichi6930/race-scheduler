/**
 * 開催場ごとの「開催回数(heldTimes) → 開催日数(heldDayTimes)」の出現回数を
 * 積み上げて記録するカウンタ。
 * @remarks
 * placeはHTMLスクレイピング由来の文字列で任意の値を取り得るため、
 * `Record<string, ...>`のブラケット表記で実装すると`place === '__proto__'`のとき
 * プロトタイプチェーンを書き換えてしまう（CodeQL: prototype-polluting assignment）。
 * Mapはキーが常にプレーンな値として扱われこのクラスの問題が原理的に発生しないため採用する。
 */
export type HeldDayTimesCounter = Map<string, Map<number, number>>;

/**
 * 指定した開催場・開催回数の出現をカウンタへ積み上げ、その時点での
 * 開催日数（何日目の開催か）を返す。
 *
 * JRAの月間開催カレンダーは「開催場 × 開催回数」の組み合わせが月をまたいで
 * 複数回登場するため、登場するたびに1を加算した値が開催日数となる。
 * @param counter - 積み上げ用カウンタ（呼び出し側で使い回すことでカレンダー全体を通した通し番号になる）
 * @param place - 開催場名
 * @param heldTimes - 開催回数
 * @returns この呼び出し時点での開催日数（1始まり）
 */
export const accumulateHeldDayTimes = (
    counter: HeldDayTimesCounter,
    place: string,
    heldTimes: number,
): number => {
    const placeCounter = counter.get(place) ?? new Map<number, number>();
    if (!counter.has(place)) {
        counter.set(place, placeCounter);
    }
    const heldDayTimes = (placeCounter.get(heldTimes) ?? 0) + 1;
    placeCounter.set(heldTimes, heldDayTimes);
    return heldDayTimes;
};
