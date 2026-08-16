/**
 * BOATRACE の heading2_title クラス名からレースグレードを判定する。
 * @param headingClass - heading2_title 要素の class 属性値
 * @returns 判定されたグレード（'SG' | 'PGⅠ'）、判定できない場合は undefined
 */
export const extractBoatraceHeadingGrade = (
    headingClass: string,
): string | undefined => {
    if (headingClass.includes('is-SGa')) {
        return 'SG';
    }
    if (headingClass.includes('is-PGa')) {
        return 'PGⅠ';
    }
    return;
};
