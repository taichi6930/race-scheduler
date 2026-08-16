/**
 * リンクタグを作成する
 * @param text - リンクのテキスト
 * @param url - リンク先のURL
 * @returns HTMLのアンカータグ文字列
 */

export const createAnchorTag = (text: string, url: string): string =>
    `<a href="${url}">${text}</a>`;
