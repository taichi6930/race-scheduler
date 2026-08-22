import { sql } from 'drizzle-orm';
import {
    blob,
    integer,
    primaryKey,
    sqliteTable,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * packages/db/migrations/*.sql に対応する Drizzle スキーマ定義。
 * @remarks
 * マイグレーションの正は引き続き packages/db/migrations/*.sql（wrangler d1 migrations）。
 * このファイルは型付けのためだけに手書きで追従させる（drizzle-kit は使用しない）。
 * date_time 系カラムは SQLite 上は DATETIME 型だが、実体は JST ISO8601 文字列
 * （toJstISOString で生成）として保存されるため text() で定義する。
 */

/**
 * place の (race_type, date_time, location_code) はビジネス上の一意キーであり、
 * 0001_place.sqlite.sql の idx_place_unique_race_type_date_time_location_code に
 * 対応する。place_id はこの3値から導出される値（composePlaceId）に過ぎないため、
 * upsert の ON CONFLICT はこちらを対象にする（Issue #2505: place_id 側のみを
 * 対象にすると、旧形式の place_id で既存行がある場合にこのUNIQUE制約で
 * 弾かれてしまう）。
 */
export const place = sqliteTable(
    'place',
    {
        placeId: text('place_id').primaryKey(),
        raceType: text('race_type').notNull(),
        dateTime: text('date_time').notNull(),
        locationCode: text('location_code').notNull(),
        isRaceListAvailable: integer('is_race_list_available'),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        uniqueIndex('idx_place_unique_race_type_date_time_location_code').on(
            table.raceType,
            table.dateTime,
            table.locationCode,
        ),
    ],
);

export const placeGrade = sqliteTable('place_grade', {
    placeId: text('place_id').primaryKey(),
    placeGrade: text('place_grade').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const placeHeldDay = sqliteTable('place_held_day', {
    placeId: text('place_id').primaryKey(),
    heldTimes: integer('held_times').notNull(),
    heldDayTimes: integer('held_day_times').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** 開催場マスター情報（DEP-026対応で追加。0002_place_master.sqlite.sql参照）。 */
export const placeMaster = sqliteTable(
    'place_master',
    {
        raceType: text('race_type').notNull(),
        courseCodeType: text('course_code_type').notNull(),
        placeName: text('place_name').notNull(),
        placeCode: text('place_code').notNull(),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        primaryKey({
            columns: [table.raceType, table.courseCodeType, table.placeName],
        }),
    ],
);

export const player = sqliteTable(
    'player',
    {
        raceType: text('race_type').notNull(),
        playerNo: text('player_no').notNull(),
        playerName: text('player_name').notNull(),
        priority: integer('priority').notNull(),
        // 0005_player.sqlite.sql は created_at/updated_at にNOT NULLを付与していない
        // （DEFAULT CURRENT_TIMESTAMPのみ）ため、他テーブルと異なりnotNull()を付けない
        // （schema.test.tsのT3ドリフト検知で発覚。実DBの構造に合わせるのが正）。
        createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [primaryKey({ columns: [table.raceType, table.playerNo] })],
);

/**
 * 競輪固有の選手属性（期別・府県）。race_stage/race_conditionと同じ
 * 「競技によって有無が変わる兄弟テーブル」の流儀（0022_player_keirin.sqlite.sql参照）。
 */
export const playerKeirin = sqliteTable('player_keirin', {
    playerNo: text('player_no').primaryKey(),
    term: integer('term').notNull(),
    branch: text('branch').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * オートレース固有の選手属性（拠点/LG）。player_keirinと同じ「競技によって
 * 有無が変わる兄弟テーブル」の流儀（0031_player_autorace.sqlite.sql参照）。
 * AUTORACEの出走表HTMLには期別に相当する情報が無いため、termに相当する列は持たない。
 */
export const playerAutorace = sqliteTable('player_autorace', {
    playerNo: text('player_no').primaryKey(),
    branch: text('branch').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * ユーザーが登録した注目選手（calendar_flagと同じ位置づけで、
 * player/race_playerとは独立させる。スクレイピング経路からは書き込まない。
 * 0023_player_watch.sqlite.sql / 0043_player_watch_user_scope.sqlite.sql参照）。
 * user単位のデータ（段階2、パスキー認証導入）。
 */
export const playerWatch = sqliteTable(
    'player_watch',
    {
        userId: text('user_id').notNull(),
        raceType: text('race_type').notNull(),
        playerNo: text('player_no').notNull(),
        priority: integer('priority').notNull().default(10),
        label: text('label').notNull().default(''),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        primaryKey({
            columns: [table.userId, table.raceType, table.playerNo],
        }),
    ],
);

/**
 * 選手属性の変更を検知したときだけ追記するログ（追記専用）。
 * 0024_player_history.sqlite.sql参照。
 */
export const playerHistory = sqliteTable('player_history', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    raceType: text('race_type').notNull(),
    playerNo: text('player_no').notNull(),
    attribute: text('attribute').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value').notNull(),
    observedAt: text('observed_at').notNull(),
    source: text('source').notNull().default('oddspark'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const race = sqliteTable('race', {
    raceId: text('race_id').primaryKey(),
    placeId: text('place_id').notNull(),
    raceType: text('race_type').notNull(),
    raceName: text('race_name').notNull().default(''),
    dateTime: text('date_time').notNull(),
    locationCode: text('location_code').notNull(),
    grade: text('grade').notNull().default(''),
    raceNumber: integer('race_number').notNull(),
    // 0034_race_is_confirmed.sqlite.sql参照。既存行は1=確定として後方互換。
    isConfirmed: integer('is_confirmed').notNull().default(1),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const raceStage = sqliteTable('race_stage', {
    raceId: text('race_id').primaryKey(),
    raceStage: text('race_stage').notNull(),
    // 0035_race_stage_is_confirmed.sqlite.sql参照。マスタ（stageByWebSite）未一致の
    // 原文ママ仮登録は0、既存行・確定済みは1（後方互換）。
    isConfirmed: integer('is_confirmed').notNull().default(1),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const raceCondition = sqliteTable('race_condition', {
    raceId: text('race_id').primaryKey(),
    distance: integer('distance').notNull(),
    surfaceType: text('surface_type').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * 出走表のスナップショット（レースに誰が出走したか）。race_player_idは
 * raceId + carNumber(2桁)の合成ID（composeRacePlayerId）。0021_race_player.sqlite.sql参照。
 */
export const racePlayer = sqliteTable('race_player', {
    racePlayerId: text('race_player_id').primaryKey(),
    raceId: text('race_id').notNull(),
    raceType: text('race_type').notNull(),
    carNumber: integer('car_number').notNull(),
    frameNumber: integer('frame_number').notNull(),
    playerNo: text('player_no').notNull(),
    playerName: text('player_name').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const calendarFlag = sqliteTable('calendar_flag', {
    raceId: text('race_id').primaryKey(),
    label: text('label').notNull().default(''),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Web Push 通知の購読（ブラウザ1つ = 1行）。
 * @remarks id は endpoint の SHA-256（安定キー、repository 側で導出）。
 */
export const pushSubscription = sqliteTable('push_subscription', {
    id: text('id').primaryKey(),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    // OBS-024: 送信失敗のたびにインクリメントし、成功でリセットする
    // （恒久的に失敗し続ける購読を検知し無限リトライを止めるため）。
    failureCount: integer('failure_count').notNull().default(0),
    // 購読の所有権を証明するシークレットのSHA-256ハッシュ（push-ownership-design.md §2.1）。
    // シークレット平文は保存しない。既存行への遡及発行が無いためNULL許容
    // （SECPUSH-02、P-1時点では発行のみで検証は未実施）。
    secretHash: text('secret_hash'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Web Push の発火予約（購読 × レース）。本文はクライアントが登録時に確定させる
 * （サーバはお気に入り／重賞ロジックを再実装しない、web-push-design.md §1）。
 * @remarks id は `{subscriptionId}:{raceId}`（冪等 upsert キー）。
 * fireAtMs は UTC epoch millis（JST 壁時計はクライアント側で変換済み）。
 */
export const pushNotificationRequest = sqliteTable(
    'push_notification_request',
    {
        id: text('id').primaryKey(),
        subscriptionId: text('subscription_id').notNull(),
        raceId: text('race_id').notNull(),
        fireAtMs: integer('fire_at_ms').notNull(),
        title: text('title').notNull(),
        body: text('body').notNull(),
        url: text('url'),
        sentAt: text('sent_at'),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
);

/**
 * batch実行（batch-all cron / batch-race・place・calendar手動）の排他制御用ロック
 * （CICD-73/CONC-03）。id=1固定の単一行のみ存在し、workflowInstanceIdがnullの
 * ときだけ空き扱いとする。
 */
export const batchRunLock = sqliteTable('batch_run_lock', {
    id: integer('id').primaryKey(),
    workflowInstanceId: text('workflow_instance_id'),
    startedAt: text('started_at'),
});

/**
 * 機能フラグ（0029_feature_flag.sqlite.sql参照）。
 * 行が存在すればenabled値が最優先。行が無いキーはwrangler.tomlの環境変数
 * （FEATURE_XXX_ENABLED）を既定値として使う（feature-flag-design.md §2）。
 */
export const featureFlag = sqliteTable('feature_flag', {
    flagKey: text('flag_key').primaryKey(),
    enabled: integer('enabled').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * データ品質警告の蓄積ログ（追記専用、0032_data_quality_warning_log.sqlite.sql参照）。
 * source（例: 'place_mapper'）ごとにerrorMonitorCheck.tsが直近ウィンドウで
 * COUNTし、GitHub Issueの作成/追記/Closeに使う。
 */
export const dataQualityWarningLog = sqliteTable('data_quality_warning_log', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    message: text('message').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * レース詳細UIのレイアウト構成（0033_ui_layout.sqlite.sql参照）。
 * 行が存在すればconfigが最優先、無ければコード内既定値にフォールバックする
 * （feature_flagと同じ考え方をJSON構成全体に拡張したもの）。
 */
export const uiLayout = sqliteTable('ui_layout', {
    layoutKey: text('layout_key').primaryKey(),
    config: text('config').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * 更新履歴（What's New画面）用のリリースノート（0038_release_note.sqlite.sql参照）。
 * body には GitHub Release と同じMarkdown本文をそのまま保存し、front側の
 * 既存Markdownパースロジックをそのまま使えるようにする。
 */
/**
 * tag_name は race-schedule / race-scheduler で独立採番されており重複しうる
 * （実例: 両リポジトリとも分割区切りとして v2.0.0 を採番している）ため、
 * 一意性は (tag_name, source_repo) の組で担保する
 * （0038_release_note.sqlite.sql の idx_release_note_tag_source に対応）。
 */
export const releaseNote = sqliteTable(
    'release_note',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        tagName: text('tag_name').notNull(),
        name: text('name'),
        body: text('body'),
        publishedAt: text('published_at'),
        draft: integer('draft').notNull().default(0),
        prerelease: integer('prerelease').notNull().default(0),
        sourceRepo: text('source_repo')
            .notNull()
            .$type<'race-schedule' | 'race-scheduler'>(),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        uniqueIndex('idx_release_note_tag_source').on(
            table.tagName,
            table.sourceRepo,
        ),
    ],
);

/**
 * パスキー(WebAuthn)認証で招待を消費して登録した参加者。
 * 0039_passkey_auth.sqlite.sql参照。
 */
export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    nickname: text('nickname').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * WebAuthnの公開鍵クレデンシャル（1人が複数端末分持てる）。
 * device_label/user_agentは表示専用（認証判定には使わない）。
 * 0039_passkey_auth.sqlite.sql参照。
 */
export const credential = sqliteTable('credential', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
    signCount: integer('sign_count').notNull().default(0),
    aaguid: text('aaguid'),
    userAgent: text('user_agent'),
    deviceLabel: text('device_label').notNull(),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * admin から発行する使い捨ての招待。memoは管理者専用のメモ（本人には非公開）。
 * 0039_passkey_auth.sqlite.sql参照。
 */
export const invite = sqliteTable('invite', {
    token: text('token').primaryKey(),
    memo: text('memo'),
    expiresAt: text('expires_at').notNull(),
    usedByUserId: text('used_by_user_id'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * ログイン後のセッション。APIリクエストのたびにexpiresAtを「今+7日」へ更新する
 * スライディングウィンドウ方式（7日操作が無ければ失効）。
 * 0039_passkey_auth.sqlite.sql参照。
 */
export const session = sqliteTable('session', {
    token: text('token').primaryKey(),
    userId: text('user_id').notNull(),
    credentialId: text('credential_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * WebAuthnのchallenge一時保存（options生成→verifyの2往復をまたぐため）。
 * 消費時（verify成功/失敗いずれも）に削除する使い捨ての値。
 * 0042_webauthn_challenge.sqlite.sql参照。
 */
export const webauthnChallenge = sqliteTable('webauthn_challenge', {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull(),
    purpose: text('purpose').notNull().$type<'register' | 'login'>(),
    inviteToken: text('invite_token'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * 招待コードを持たないユーザーがfrontから直接送る参加リクエスト（承認制）。
 * 承認時にinviteTokenへ発行済みの招待トークンを紐付け、リクエスト側の端末は
 * それを使って既存の招待登録フローを自動で継続する。パスキー自体はこの時点では
 * まだ作られていない。0044_join_request.sqlite.sql参照。
 */
export const joinRequest = sqliteTable('join_request', {
    id: text('id').primaryKey(),
    nickname: text('nickname').notNull(),
    status: text('status')
        .notNull()
        .default('pending')
        .$type<'pending' | 'approved' | 'rejected'>(),
    inviteToken: text('invite_token'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * お気に入りレース（user単位、段階2）。raceへの外部キー制約は付けない
 * （calendar_flagと同じく、参照先レースの削除を気にしない設計）。
 * 0041_favorite.sqlite.sql参照。
 */
export const favorite = sqliteTable(
    'favorite',
    {
        userId: text('user_id').notNull(),
        raceId: text('race_id').notNull(),
        createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [primaryKey({ columns: [table.userId, table.raceId] })],
);
