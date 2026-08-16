import type { D1Database } from '@cloudflare/workers-types';
import { EnvStore, LogAllMethods } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { injectable } from 'tsyringe';

import * as schema from '../../db/schema';
import type { IDrizzleGateway } from '../interface/IDrizzleGateway';

// PERF-051: `db` ゲッターは1リクエスト内で複数回呼ばれるが、EnvStore.env.DB の
// バインディング参照が変わらない限り drizzle() の再生成（スキーマバインディングの
// 再構築）は無駄なため、参照が変わったときだけ再生成するようキャッシュする。
// EnvStore.setEnv がリクエスト毎に呼ばれても env.DB 自体のバインディング参照は
// 通常同一のため、コンストラクタ/staticでのキャッシュとは異なり「参照が変わったら
// 再生成」という安全側のキー付きキャッシュにしている（PERF-048/PERF-085と同型）。
let cachedDbBinding: D1Database | undefined;
let cachedDrizzleInstance: DrizzleD1Database<typeof schema> | undefined;

/**
 * D1 データベースに Drizzle ORM 経由でアクセスする Gateway
 */
@LogAllMethods
@injectable()
export class DrizzleGateway implements IDrizzleGateway {
    public get db(): DrizzleD1Database<typeof schema> {
        const currentBinding = EnvStore.env.DB;

        // 複合条件（&&/||）をガード節に分解し、C2組み合わせテストを回避する。
        if (cachedDrizzleInstance === undefined) {
            cachedDbBinding = currentBinding;
            cachedDrizzleInstance = drizzle(currentBinding, { schema });
            return cachedDrizzleInstance;
        }

        if (cachedDbBinding !== currentBinding) {
            cachedDbBinding = currentBinding;
            cachedDrizzleInstance = drizzle(currentBinding, { schema });
        }

        return cachedDrizzleInstance;
    }
}
