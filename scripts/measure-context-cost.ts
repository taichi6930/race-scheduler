#!/usr/bin/env bun
/**
 * measure-context-cost.ts
 *
 * 毎セッション必ずロードされる静的コンテキスト（CLAUDE.md 本体 + `@import` 先 +
 * skills/agents の description）のバイト数・概算トークン数を計測する
 * （docs/tasks/token-efficiency-tasks.md TOK-001）。
 *
 * 正確なトークン数は Anthropic のトークナイザに依存しネットワーク呼び出しが要るため、
 * ここでは文字数からの概算（1 トークン ≈ 4 文字、日本語混在を考慮し 3 文字/トークンで
 * 上限側も併記）に留める。厳密な値が必要な場合は Anthropic API の count_tokens を使う。
 *
 * 使い方:
 *   bun scripts/measure-context-cost.ts             # 人間向けサマリを表示
 *   bun scripts/measure-context-cost.ts --json       # 機械可読 JSON を stdout に出力
 *   bun scripts/measure-context-cost.ts --save       # aidlc-docs/token-baseline.json に保存（TOK-002）
 */

import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();

interface FileCost {
    path: string;
    bytes: number;
}

interface CategoryCost {
    category: string;
    files: FileCost[];
    totalBytes: number;
}

function approxTokens(bytes: number): { low: number; high: number } {
    // 4 文字/トークン（英語寄り）〜 3 文字/トークン（日本語混在寄り）の概算レンジ。
    return { low: Math.round(bytes / 4), high: Math.round(bytes / 3) };
}

function readClaudeMdImports(claudeMdPath: string): string[] {
    const content = readFileSync(claudeMdPath, 'utf-8');
    const importPaths: string[] = [];
    for (const line of content.split('\n')) {
        const match = /^- @(.+)$/.exec(line.trim());
        if (match) {
            importPaths.push(match[1]);
        }
    }
    return importPaths;
}

function extractFrontmatterDescription(content: string): string {
    const match = /^---\n([\s\S]*?)\n---/.exec(content);
    if (!match) return '';
    const frontmatter = match[1];
    const descMatch = /description:\s*([\s\S]*?)(?=\n\w+:|\n---|$)/.exec(
        frontmatter,
    );
    if (!descMatch) return '';
    return descMatch[1].trim();
}

function measureClaudeMd(): CategoryCost {
    const claudeMdPath = join(REPO_ROOT, 'CLAUDE.md');
    const files: FileCost[] = [];

    const claudeMdBytes = statSync(claudeMdPath).size;
    files.push({ path: 'CLAUDE.md', bytes: claudeMdBytes });

    for (const importPath of readClaudeMdImports(claudeMdPath)) {
        const fullPath = join(REPO_ROOT, importPath);
        if (existsSync(fullPath)) {
            files.push({ path: importPath, bytes: statSync(fullPath).size });
        }
    }

    const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
    return { category: 'claude-md-and-imports', files, totalBytes };
}

function measureSkillDescriptions(): CategoryCost {
    const skillsDir = join(REPO_ROOT, '.claude/skills');
    const files: FileCost[] = [];

    if (existsSync(skillsDir)) {
        for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
            if (!existsSync(skillMdPath)) continue;
            const content = readFileSync(skillMdPath, 'utf-8');
            const description = extractFrontmatterDescription(content);
            files.push({
                path: `.claude/skills/${entry.name}/SKILL.md (description)`,
                bytes: Buffer.byteLength(description, 'utf-8'),
            });
        }
    }

    const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
    return { category: 'skill-descriptions', files, totalBytes };
}

function measureAgentDescriptions(): CategoryCost {
    const agentsDir = join(REPO_ROOT, '.claude/agents');
    const files: FileCost[] = [];

    if (existsSync(agentsDir)) {
        for (const entry of readdirSync(agentsDir)) {
            if (!entry.endsWith('.md')) continue;
            const agentPath = join(agentsDir, entry);
            const content = readFileSync(agentPath, 'utf-8');
            const description = extractFrontmatterDescription(content);
            files.push({
                path: `.claude/agents/${entry} (description)`,
                bytes: Buffer.byteLength(description, 'utf-8'),
            });
        }
    }

    const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
    return { category: 'agent-descriptions', files, totalBytes };
}

function main(): void {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const save = args.includes('--save');

    const categories = [
        measureClaudeMd(),
        measureSkillDescriptions(),
        measureAgentDescriptions(),
    ];
    const grandTotalBytes = categories.reduce(
        (sum, c) => sum + c.totalBytes,
        0,
    );
    const tokens = approxTokens(grandTotalBytes);

    const result = {
        measuredAt:
            'see git commit timestamp (Date.now() not used for reproducibility)',
        categories,
        grandTotalBytes,
        approxTokens: tokens,
    };

    if (save) {
        const outPath = join(REPO_ROOT, 'aidlc-docs/token-baseline.json');
        writeFileSync(outPath, `${JSON.stringify(result, null, 4)}\n`);
        console.log(`✅ Saved baseline to ${outPath}`);
        return;
    }

    if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log('📊 常時ロードコンテキストの実測（TOK-001）');
    for (const category of categories) {
        console.log(
            `\n  ${category.category}: ${category.totalBytes.toLocaleString()} B`,
        );
        for (const file of category.files) {
            console.log(`    - ${file.path}: ${file.bytes.toLocaleString()} B`);
        }
    }
    console.log(
        `\n合計: ${grandTotalBytes.toLocaleString()} B（概算 ${tokens.low.toLocaleString()}〜${tokens.high.toLocaleString()} トークン）`,
    );
}

main();
