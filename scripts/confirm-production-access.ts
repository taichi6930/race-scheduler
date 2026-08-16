#!/usr/bin/env bun
/**
 * confirm-production-access.ts
 *
 * SEC-057対応: 本番リソースへ直接アクセスするコマンド（例: `db:shell:production`の
 * `wrangler d1 execute --env production`）は、これまで確認なしに任意SQLを実行できた。
 * package.json の scripts から `&&` で連結し、コマンド実行の直前に確認ゲートとして挟む。
 * 標準入力から対象名と完全一致する文字列の入力を要求し、一致しなければ非ゼロ終了で
 * コマンドチェーンを止める。
 *
 * 使い方:
 *   "db:shell:production": "bun ../../scripts/confirm-production-access.ts race_schedule_db_prod && wrangler d1 execute ..."
 */

import { createInterface } from 'node:readline/promises';

/**
 * 確認プロンプトの文言を組み立てる
 * @param targetName - 確認対象のリソース名（入力と完全一致させる文字列）
 * @returns プロンプト文言
 */
export function buildConfirmationPrompt(targetName: string): string {
    return `⚠️  本番リソース「${targetName}」へ直接アクセスしようとしています。続行するには「${targetName}」と入力してください: `;
}

/**
 * 入力が確認対象名と完全一致するか判定する
 * @param targetName - 確認対象のリソース名
 * @param answer - 標準入力から得た応答
 * @returns 完全一致すれば true
 */
export function isConfirmed(targetName: string, answer: string): boolean {
    return answer.trim() === targetName;
}

if (import.meta.main) {
    const targetName = process.argv[2];
    if (!targetName) {
        // eslint-disable-next-line no-console
        console.error('使い方: bun confirm-production-access.ts <確認対象名>');
        process.exit(1);
    }

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer = await rl.question(buildConfirmationPrompt(targetName));
    rl.close();

    if (!isConfirmed(targetName, answer)) {
        // eslint-disable-next-line no-console
        console.error('❌ 確認文字列が一致しないため中止しました。');
        process.exit(1);
    }
}
