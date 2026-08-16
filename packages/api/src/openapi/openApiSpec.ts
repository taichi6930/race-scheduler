/**
 * `GET /docs`（Scalar UI）・`GET /openapi.json` が返すOpenAPI 3.0仕様。
 *
 * front等から実際に呼び出せる公開エンドポイント（`SERVICE_AUTH_EXEMPT_ROUTES` の
 * `front-public`/`pending-user-auth` 相当）のみを対象にしている。サービス間認証が
 * 必要な内部エンドポイント（`/calendar/flag`・`/internal/batch-lock/*`・
 * `/debug/database` 等）は対象外（front以外の消費者を想定していないため）。
 *
 * `servers` は環境ごとのホスト名を書かず空にしている。Scalarはservers未指定の場合、
 * ドキュメントを開いているページ自身のオリジンをAPIベースURLとして扱うため、
 * test/production いずれの環境にデプロイしても追加設定なしでそのまま動作する。
 *
 * 各エンドポイントの実際の挙動（クエリの効き方・エラー形状等）はcontroller/core
 * スキーマを実地調査した上で記述している。実装が変わった場合はこのファイルも
 * 追従が必要（自動生成ではなく手書きのため、drift防止のレビューを推奨）。
 */

const errorResponseSchema = {
    type: 'object',
    properties: {
        status: { type: 'integer', example: 400 },
        message: { type: 'string', example: '入力値が不正です' },
    },
    required: ['status', 'message'],
};

const upsertFailureSchema = {
    type: 'object',
    properties: {
        db: { type: 'string' },
        id: { type: 'string' },
        reason: { type: 'string' },
    },
    required: ['db', 'id', 'reason'],
};

const upsertResultSchema = {
    type: 'object',
    properties: {
        successCount: { type: 'integer' },
        failureCount: { type: 'integer' },
        failures: {
            type: 'array',
            items: { $ref: '#/components/schemas/UpsertFailure' },
        },
    },
    required: ['successCount', 'failureCount', 'failures'],
};

const raceTypeSchema = {
    type: 'string',
    enum: ['jra', 'nar', 'keirin', 'overseas', 'autorace', 'boatrace'],
};

const announcementSchemaDoc = {
    type: 'object',
    description:
        'Server-Driven UI (SDUI) PoC のバナー表示スキーマ。`schemaVersion` は将来の' +
        'スキーマ拡張時にfrontが解釈可否を判定するために予約されている（現時点ではv1のみ）。',
    properties: {
        schemaVersion: { type: 'integer', enum: [1] },
        enabled: { type: 'boolean' },
        message: { type: 'string', minLength: 1 },
        actionLabel: { type: 'string', minLength: 1 },
        actionUrl: { type: 'string', format: 'uri' },
    },
    required: ['schemaVersion', 'enabled', 'message'],
};

const releaseNoteSchemaDoc = {
    type: 'object',
    description:
        "更新履歴（What's New画面）1件分。GitHub Releases APIと同じフィールド名（snake_case）。" +
        '`body` はMarkdown本文で、front側がカテゴリ見出しをパースして表示する。',
    properties: {
        tag_name: { type: 'string', example: 'v2.0.0' },
        name: { type: 'string', nullable: true },
        body: { type: 'string', nullable: true },
        published_at: { type: 'string', format: 'date-time', nullable: true },
        draft: { type: 'boolean' },
        prerelease: { type: 'boolean' },
    },
    required: [
        'tag_name',
        'name',
        'body',
        'published_at',
        'draft',
        'prerelease',
    ],
};

const raceEntitySchema = {
    type: 'object',
    description:
        '`datetime` はJSTオフセット付きISO文字列（例: "2026-01-01T00:00:00+09:00"）。' +
        '`raceStage`・`conditionData`・`placeHeldDays` は競技種別により有無が変わる。',
    properties: {
        raceId: { type: 'string', example: 'jra202501050101' },
        placeId: { type: 'string', example: 'jra2025010501' },
        raceType: { $ref: '#/components/schemas/RaceType' },
        raceName: { type: 'string' },
        raceNumber: { type: 'integer', minimum: 1, maximum: 12 },
        raceCourse: { type: 'string' },
        locationCode: { type: 'string', example: '05' },
        raceGrade: { type: 'string' },
        raceStage: {
            type: 'string',
            description: 'KEIRIN/AUTORACE/BOATRACEのみ',
            nullable: true,
        },
        conditionData: {
            type: 'object',
            description: 'JRA/NAR/OVERSEASのみ',
            nullable: true,
            properties: {
                surfaceType: { type: 'string' },
                distance: { type: 'integer' },
            },
        },
        placeHeldDays: {
            type: 'object',
            description: '主にJRA。データがあれば付与される',
            nullable: true,
            properties: {
                heldTimes: { type: 'integer' },
                heldDayTimes: { type: 'integer' },
            },
        },
        datetime: { type: 'string', format: 'date-time' },
        isConfirmed: {
            type: 'boolean',
            nullable: true,
            description:
                '開催情報が確定しているか。省略時は確定として扱う。' +
                '公式発表前に運用者が推測で先行登録した未来のレースは false',
        },
    },
    required: [
        'raceId',
        'placeId',
        'raceType',
        'raceName',
        'raceNumber',
        'raceCourse',
        'locationCode',
        'raceGrade',
        'datetime',
    ],
};

const placeEntitySchema = {
    type: 'object',
    properties: {
        placeId: { type: 'string', example: 'jra2025010501' },
        raceType: { $ref: '#/components/schemas/RaceType' },
        raceCourse: { type: 'string' },
        locationCode: { type: 'string', example: '05' },
        placeGrade: {
            type: 'string',
            nullable: true,
            description:
                '機械式競技（KEIRIN/AUTORACE/BOATRACE）またはgradeList指定時のみ自動付与',
        },
        placeHeldDays: {
            type: 'object',
            nullable: true,
            properties: {
                heldTimes: { type: 'integer' },
                heldDayTimes: { type: 'integer' },
            },
        },
        isRaceListAvailable: { type: 'boolean', nullable: true },
        datetime: { type: 'string', format: 'date-time' },
    },
    required: ['placeId', 'raceType', 'raceCourse', 'locationCode', 'datetime'],
};

const playerEntitySchema = {
    type: 'object',
    properties: {
        raceType: { $ref: '#/components/schemas/RaceType' },
        playerNo: { type: 'string' },
        playerName: { type: 'string' },
        priority: { type: 'integer', minimum: 0 },
        term: {
            type: 'integer',
            nullable: true,
            description: 'KEIRINのみ補完',
        },
        branch: {
            type: 'string',
            nullable: true,
            description: 'KEIRIN(府県)またはAUTORACE(拠点/LG)のみ補完',
        },
    },
    required: ['raceType', 'playerNo', 'playerName', 'priority'],
};

const racePlayerEntitySchema = {
    type: 'object',
    properties: {
        carNumber: { type: 'integer', minimum: 1, maximum: 9 },
        frameNumber: { type: 'integer', minimum: 1, maximum: 9 },
        playerNo: { type: 'string' },
        playerName: { type: 'string' },
        term: { type: 'integer', nullable: true },
        branch: { type: 'string', nullable: true },
    },
    required: ['carNumber', 'frameNumber', 'playerNo', 'playerName'],
};

const raceDetailUiSchemaDoc = {
    type: 'object',
    description:
        'Server-Driven UI: レース詳細のセクション型UIスキーマ（race-detail-sdui-design.md）。' +
        '`sections` は `type` で判別する。front は未知の `type` を持つセクションを' +
        'スキップして残りを描画する。`schemaVersion` は将来セクション種別を拡張する際、' +
        'frontの解釈可否を判定するために予約されている（現時点ではv1のみ）。',
    properties: {
        schemaVersion: { type: 'integer', enum: [1] },
        sections: {
            type: 'array',
            items: {
                oneOf: [
                    {
                        type: 'object',
                        description: '発走時刻・会場等のキーバリュー一覧',
                        properties: {
                            type: { type: 'string', enum: ['kv'] },
                            rows: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        label: { type: 'string' },
                                        value: { type: 'string' },
                                    },
                                    required: ['label', 'value'],
                                },
                            },
                        },
                        required: ['type', 'rows'],
                    },
                    {
                        type: 'object',
                        description: '外部リンク（netkeirin・YouTube等）一覧',
                        properties: {
                            type: { type: 'string', enum: ['links'] },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        label: { type: 'string' },
                                        url: { type: 'string', format: 'uri' },
                                    },
                                    required: ['label', 'url'],
                                },
                            },
                        },
                        required: ['type', 'items'],
                    },
                    {
                        type: 'object',
                        description: '出走選手ロスター',
                        properties: {
                            type: { type: 'string', enum: ['players'] },
                            title: { type: 'string' },
                            watchToggle: {
                                type: 'boolean',
                                description: '注目選手トグル（★）を表示するか',
                            },
                            rows: {
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/RacePlayerEntity',
                                },
                            },
                        },
                        required: ['type', 'title', 'watchToggle', 'rows'],
                    },
                ],
            },
        },
    },
    required: ['schemaVersion', 'sections'],
};

const calendarRaceEntitySchema = {
    allOf: [
        { $ref: '#/components/schemas/RaceEntity' },
        {
            type: 'object',
            description:
                '`datetime` はこのエンドポイントのみformatEntitiesを通らないため、' +
                'UTCのISO文字列（例: "2026-01-01T00:00:00.000Z"）になる点に注意。',
            properties: {
                isFlagged: {
                    type: 'boolean',
                    description: 'カレンダー掲載フラグが手動でONにされているか',
                },
                isWatched: {
                    type: 'boolean',
                    description: '注目選手（player_watch）が出走するか',
                },
            },
            required: ['isFlagged', 'isWatched'],
        },
    ],
};

const startDateParam = {
    name: 'startDate',
    in: 'query',
    required: true,
    schema: { type: 'string', format: 'date', example: '2026-01-01' },
    description: '取得開始日（YYYY-MM-DD）',
};

const finishDateParam = {
    name: 'finishDate',
    in: 'query',
    required: true,
    schema: { type: 'string', format: 'date', example: '2026-12-31' },
    description: '取得終了日（YYYY-MM-DD）',
};

const raceTypeListParam = {
    name: 'raceTypeList',
    in: 'query',
    required: true,
    schema: { type: 'string', example: 'jra,keirin' },
    description:
        'レース種別（カンマ区切り、または同名パラメータを複数指定）。' +
        '値は jra/nar/keirin/overseas/autorace/boatrace。',
};

const locationListParam = {
    name: 'locationList',
    in: 'query',
    required: false,
    schema: { type: 'string', example: '01,02' },
    description: '開催場所コードで絞り込み（カンマ区切り、複数指定可）',
};

const gradeListParam = (example: string) => ({
    name: 'gradeList',
    in: 'query',
    required: false,
    schema: { type: 'string', example },
    description: 'グレードで絞り込み（カンマ区切り、複数指定可）',
});

const isDisplayPlaceHeldDaysParam = {
    name: 'isDisplayPlaceHeldDays',
    in: 'query',
    required: false,
    schema: { type: 'boolean' },
    description:
        '開催回数・日数情報を含めるかの指定を受け付けるが、' +
        '現状の実装ではこの値を参照しておらず挙動に影響しない（no-op）。',
};

const raceIdParam = {
    name: 'raceId',
    in: 'query',
    required: true,
    schema: {
        type: 'string',
        pattern: '^(jra|nar|keirin|overseas|autorace|boatrace)\\d{8}[0-9]{4}$',
        example: 'jra202501050101',
    },
    description: 'レースID',
};

const badRequestResponse = {
    description:
        '入力値検証エラー。クエリ系は `{status,message}`（Zod issue由来のメッセージ）、' +
        'ボディ系エンドポイントの多くは固定文言 "リクエストボディが不正です" を返す。',
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
    },
};

const internalErrorResponse = {
    description:
        '予期しないサーバーエラー。詳細はクライアントへ返さずログにのみ記録する（SEC-017）。' +
        '不正なJSONボディ（パース自体の失敗）もここに含まれる（400にはならない）。',
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
    },
};

const tooManyRequestsResponse = {
    description:
        'レート制限超過（GET系は読み取り用、POST/PUT/DELETE系は書き込み用の別上限）。',
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
    },
};

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'race-schedule API',
        version: '1.0.0',
        description:
            '公営競技（競馬・競輪・オートレース・競艇）のレーススケジュールを扱うAPI。' +
            'ここに掲載しているのは front 等から認証なしで呼び出せる公開エンドポイントのみ' +
            '（`/calendar/flag`・`/internal/*`・`/debug/*` 等のサービス間認証必須エンドポイントは対象外）。' +
            'すべての成功レスポンスに加え、429（レート制限）・413（POST/DELETE系、ボディ1MB超過）が' +
            '共通で発生しうる。',
    },
    servers: [],
    tags: [
        { name: 'health', description: 'ヘルスチェック' },
        { name: 'calendar', description: 'カレンダー掲載対象レース一覧' },
        { name: 'place', description: '開催場情報' },
        { name: 'race', description: 'レース情報' },
        { name: 'player', description: '選手/騎手情報' },
        { name: 'push', description: 'Web Push 購読・発火予約' },
        { name: 'release-notes', description: "更新履歴（What's New画面）" },
        {
            name: 'ui',
            description:
                'Server-Driven UI (SDUI) PoC。front再デプロイなしでUI内容を変更できる実験的エンドポイント。',
        },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['health'],
                summary: 'ヘルスチェック',
                description: 'D1への疎通確認（`SELECT 1`）を行う。',
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: {
                                            type: 'string',
                                            example: 'ok',
                                        },
                                        package: {
                                            type: 'string',
                                            example: 'api',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '503': {
                        description: 'D1に疎通できない',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: {
                                            type: 'string',
                                            example: 'ng',
                                        },
                                        package: {
                                            type: 'string',
                                            example: 'api',
                                        },
                                        reason: {
                                            type: 'string',
                                            example: 'D1 unreachable',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/ui/announcement': {
            get: {
                tags: ['ui'],
                summary: '起動時お知らせバナーのUIスキーマ取得（SDUI PoC）',
                description:
                    'front起動時に一度だけ呼ばれ、`enabled: true` の場合にお知らせバナーを表示する。' +
                    '`enabled` の判定軸は環境ごとに異なる。test/development環境では' +
                    '`X-Debug-Mode: true` ヘッダー（frontの設定画面「デバッグモード」トグルに連動）の' +
                    '有無のみで決まる。本番環境ではこのヘッダーは無視され、' +
                    'サーバー側の機能フラグ（`FEATURE_ANNOUNCEMENT_BANNER_ENABLED` 環境変数）のみで' +
                    '決まる（機能ごとに独立したキーのため、他のSDUI機能に影響を与えず本番展開できる）。' +
                    'バナー文言（`message`）はfrontを再デプロイせずAPI側の実装変更のみで更新できる。',
                parameters: [
                    {
                        name: 'X-Debug-Mode',
                        in: 'header',
                        required: false,
                        schema: { type: 'string', enum: ['true'] },
                        description:
                            'test/development環境でのみ参照される。これが `true` の場合のみ' +
                            '`enabled: true` を返す（本番環境では無視される）。',
                    },
                ],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Announcement',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/ui/race-detail': {
            get: {
                tags: ['ui'],
                summary:
                    'レース詳細のセクション型UIスキーマ取得（Server-Driven UI）',
                description:
                    'front のレース詳細画面（レースをタップした際のボトムシート／常駐パネル）が' +
                    '描画するセクション構成を返す。front を再デプロイせずAPI側の実装変更のみで' +
                    '表示内容（フィールドの選択・順序・ラベル）を更新できる。',
                parameters: [raceIdParam],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/RaceDetailUi',
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '404': {
                        description: '指定されたレースが見つからない',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/release-notes': {
            get: {
                tags: ['release-notes'],
                summary: '更新履歴一覧取得',
                description:
                    "front の更新履歴（What's New）画面が表示するリリースノート一覧を、" +
                    '公開日時の新しい順で返す。GitHub Releases APIと同じフィールド名（snake_case）。',
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/ReleaseNote',
                                    },
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/calendar': {
            get: {
                tags: ['calendar'],
                summary: 'カレンダー掲載対象レース一覧',
                description:
                    '掲載フラグON・重賞相当・注目選手出走のいずれかを満たすレースのみを返す。' +
                    '`/place`・`/race` とはクエリ解析の実装が別（`locationList`/`gradeList`/' +
                    '`isDisplayPlaceHeldDays`/`isDisplayPlaceGrade` は受け付けない）。',
                parameters: [
                    startDateParam,
                    finishDateParam,
                    raceTypeListParam,
                ],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        calendars: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/CalendarRaceEntity',
                                            },
                                        },
                                    },
                                    required: ['count', 'calendars'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/place': {
            get: {
                tags: ['place'],
                summary: '開催場一覧取得',
                description:
                    '`isDisplayPlaceHeldDays`・`isDisplayPlaceGrade` は受け付けるが、' +
                    '現状の実装では参照されず挙動に影響しない（no-op）。' +
                    '`placeGrade` は機械式競技またはgradeList指定時のみ自動付与される。',
                parameters: [
                    startDateParam,
                    finishDateParam,
                    raceTypeListParam,
                    locationListParam,
                    gradeListParam('S1,S2'),
                    isDisplayPlaceHeldDaysParam,
                    {
                        name: 'isDisplayPlaceGrade',
                        in: 'query',
                        required: false,
                        schema: { type: 'boolean' },
                        description:
                            '開催場グレードを含めるかの指定を受け付けるが、' +
                            '現状の実装ではこの値を参照しておらず挙動に影響しない（no-op）。',
                    },
                ],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        places: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/PlaceEntity',
                                            },
                                        },
                                    },
                                    required: ['count', 'places'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/race': {
            get: {
                tags: ['race'],
                summary: 'レース一覧取得',
                description:
                    '各レースに `isCalendarSpecified`（グレード・ステージによりカレンダー登録対象か）・`isWatched`（注目選手が出走するか）' +
                    'が付与される。出走選手一覧はここには含まれず `GET /race/players` で別途取得する。',
                parameters: [
                    startDateParam,
                    finishDateParam,
                    raceTypeListParam,
                    locationListParam,
                    gradeListParam('GⅠ,GⅡ'),
                    isDisplayPlaceHeldDaysParam,
                ],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        races: {
                                            type: 'array',
                                            items: {
                                                allOf: [
                                                    {
                                                        $ref: '#/components/schemas/RaceEntity',
                                                    },
                                                    {
                                                        type: 'object',
                                                        properties: {
                                                            isCalendarSpecified:
                                                                {
                                                                    type: 'boolean',
                                                                },
                                                            isWatched: {
                                                                type: 'boolean',
                                                            },
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                    required: ['count', 'races'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/race/calendar-event': {
            get: {
                tags: ['race'],
                summary: '指定レースのカレンダー登録イベントプレビュー取得',
                parameters: [raceIdParam],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        summary: { type: 'string' },
                                        description: { type: 'string' },
                                        location: { type: 'string' },
                                        start: {
                                            type: 'object',
                                            properties: {
                                                dateTime: { type: 'string' },
                                                timeZone: { type: 'string' },
                                            },
                                        },
                                        end: {
                                            type: 'object',
                                            properties: {
                                                dateTime: { type: 'string' },
                                                timeZone: { type: 'string' },
                                            },
                                        },
                                        links: {
                                            type: 'array',
                                            description:
                                                'AUTORACE/BOATRACE/OVERSEASは空配列',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    label: {
                                                        type: 'string',
                                                    },
                                                    url: { type: 'string' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '404': {
                        description: '指定されたレースが見つからない',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/race/players': {
            get: {
                tags: ['race'],
                summary: '指定レースの出走選手一覧取得',
                description:
                    'レース自体の存在確認は行わない。該当データが無ければ空配列を返す（404にはならない）。',
                parameters: [raceIdParam],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        raceId: { type: 'string' },
                                        players: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/RacePlayerEntity',
                                            },
                                        },
                                    },
                                    required: ['raceId', 'players'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/player': {
            get: {
                tags: ['player'],
                summary: '選手/騎手一覧取得',
                description:
                    '`/place`・`/race` と異なり `startDate`/`finishDate`/`locationList`/' +
                    '`gradeList` は存在しない（渡すと400）。',
                parameters: [
                    raceTypeListParam,
                    {
                        name: 'playerName',
                        in: 'query',
                        required: false,
                        schema: { type: 'string', minLength: 1 },
                        description: '選手名の部分一致検索キーワード',
                    },
                ],
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        players: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/PlayerEntity',
                                            },
                                        },
                                    },
                                    required: ['count', 'players'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
            post: {
                tags: ['player'],
                summary: '選手/騎手の登録・更新（Upsert）',
                description:
                    '単一オブジェクトまたは配列のどちらも受け付ける。`term`/`branch` は' +
                    'この経路からは設定できない（常にundefinedのまま）。',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                oneOf: [
                                    {
                                        $ref: '#/components/schemas/PlayerUpsertItem',
                                    },
                                    {
                                        type: 'array',
                                        minItems: 1,
                                        items: {
                                            $ref: '#/components/schemas/PlayerUpsertItem',
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description:
                            '正常（一部失敗しても200。件数はレスポンス参照）',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/UpsertResult',
                                },
                            },
                        },
                    },
                    '400': {
                        description:
                            'ボディ検証エラー。配列要素起因のエラーは `errors: [{index, reason}]` を伴うことがある。',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '413': {
                        description: 'リクエストボディが1MB上限を超過',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/push/subscription': {
            post: {
                tags: ['push'],
                summary: 'Web Push購読の登録',
                description:
                    'ブラウザの `PushSubscription.toJSON()` の形をそのまま受け取る。',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/PushSubscriptionUpsertRequest',
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { id: { type: 'string' } },
                                    required: ['id'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '413': {
                        description: 'リクエストボディが1MB上限を超過',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
            delete: {
                tags: ['push'],
                summary: 'Web Push購読の解除',
                description:
                    '紐づく発火予約（push/request）もあわせて削除される。',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    endpoint: {
                                        type: 'string',
                                        format: 'uri',
                                    },
                                },
                                required: ['endpoint'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            example: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/push/request': {
            post: {
                tags: ['push'],
                summary: 'レース発火予約の登録',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    subscriptionId: {
                                        type: 'string',
                                        minLength: 1,
                                    },
                                    raceId: { type: 'string' },
                                    fireAtMs: {
                                        type: 'integer',
                                        description:
                                            '発火時刻（epoch ms）。上限 4102444800000（2100-01-01T00:00:00Z）',
                                    },
                                    title: {
                                        type: 'string',
                                        minLength: 1,
                                        maxLength: 200,
                                    },
                                    body: {
                                        type: 'string',
                                        minLength: 1,
                                        maxLength: 1000,
                                    },
                                    url: { type: 'string', nullable: true },
                                },
                                required: [
                                    'subscriptionId',
                                    'raceId',
                                    'fireAtMs',
                                    'title',
                                    'body',
                                ],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            example: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '413': {
                        description: 'リクエストボディが1MB上限を超過',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
            delete: {
                tags: ['push'],
                summary: 'レース発火予約の取消',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    subscriptionId: {
                                        type: 'string',
                                        minLength: 1,
                                    },
                                    raceId: { type: 'string' },
                                },
                                required: ['subscriptionId', 'raceId'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: '正常',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            example: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
        '/push/test': {
            post: {
                tags: ['push'],
                summary: '指定した購読へテスト通知を即時送信',
                description:
                    '購読が失効している等の送信失敗はHTTPエラーにせず、200 + `ok:false` で表現する。',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    subscriptionId: {
                                        type: 'string',
                                        minLength: 1,
                                    },
                                },
                                required: ['subscriptionId'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: '送信結果（送信自体の成否はokで判定）',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok: { type: 'boolean' },
                                        message: {
                                            type: 'string',
                                            nullable: true,
                                        },
                                    },
                                    required: ['ok'],
                                },
                            },
                        },
                    },
                    '400': badRequestResponse,
                    '429': tooManyRequestsResponse,
                    '500': internalErrorResponse,
                },
            },
        },
    },
    components: {
        schemas: {
            ErrorResponse: errorResponseSchema,
            Announcement: announcementSchemaDoc,
            ReleaseNote: releaseNoteSchemaDoc,
            RaceDetailUi: raceDetailUiSchemaDoc,
            UpsertFailure: upsertFailureSchema,
            UpsertResult: upsertResultSchema,
            RaceType: raceTypeSchema,
            RaceEntity: raceEntitySchema,
            PlaceEntity: placeEntitySchema,
            PlayerEntity: playerEntitySchema,
            RacePlayerEntity: racePlayerEntitySchema,
            CalendarRaceEntity: calendarRaceEntitySchema,
            PlayerUpsertItem: {
                type: 'object',
                description:
                    'GETのレスポンス（camelCase）とは異なり、入力はsnake_case。' +
                    '`term`/`branch` はこの経路では設定不可。',
                properties: {
                    race_type: { type: 'string', minLength: 1 },
                    player_no: {
                        oneOf: [{ type: 'string' }, { type: 'number' }],
                    },
                    player_name: { type: 'string', minLength: 1 },
                    priority: { type: 'integer' },
                },
                required: ['race_type', 'player_no', 'player_name', 'priority'],
            },
            PushSubscriptionUpsertRequest: {
                type: 'object',
                properties: {
                    endpoint: { type: 'string', format: 'uri' },
                    keys: {
                        type: 'object',
                        properties: {
                            p256dh: { type: 'string', minLength: 1 },
                            auth: { type: 'string', minLength: 1 },
                        },
                        required: ['p256dh', 'auth'],
                    },
                },
                required: ['endpoint', 'keys'],
            },
        },
    },
};
