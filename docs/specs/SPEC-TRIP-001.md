---
id: SPEC-TRIP-001
title: 固定の旅程グループ内で複数会場が同日/連日開催になる候補日を検出して画面表示する
status: active
raceType: all
requires:
targets:
    - packages/front/lib/domain/entities/trip_group_master.dart
    - packages/front/lib/domain/entities/trip_match_finder.dart
    - packages/front/lib/data/repositories/trip_group_repository_impl.dart
    - packages/front/lib/features/trip_groups/
owner: front
related:
    - aidlc-docs/inception/application-design/trip-group-candidate-design.md
    - packages/front/lib/features/favorites/
---

## 仕様

個人的な公営競技（競馬・競輪・オートレース・競艇）制覇プロジェクトのうち、
「近くの会場をセットで回る」組み合わせ（旅程グループ）を 14 件、固定マスタ
（`tripGroupMaster.ts`）としてハードコードする（v1 スコープ。動的な登録・編集 UI は
v2 で別途検討し本仕様の対象外）。

1. 14 件の旅程グループを `tripGroupMaster.ts` に `{ id, name, courses: { raceType,
   raceCourse, placeCode }[] }` の形で定義する。`placeCode` は既存の
   `courseOfficialMaster`（`packages/core/src/domain/master/courseOfficialMaster/`）に
   実在する値であること。
2. `courses` が 1 件のみのグループ（水沢・帯広ば）は候補日検出ロジックを適用せず、
   単にその会場の開催日一覧を返す。
3. `courses` が 2 件以上のグループについて、含まれる会場のうち **2 つ以上が異なる会場**
   の開催日が「同日」または「指定日数以内（デフォルト 2 日、設定で変更可）」に収まる
   期間（候補期間）を検出する。判定は JST の暦日ベースで行い、時刻は問わない。
4. 検出は「検索対象期間（デフォルト: 今日から 180 日先まで、設定で変更可）」内の
   開催データに対して行う。
5. 候補期間が 1 つも見つからないグループは「候補なし」として明示する。
6. 検出結果は画面（旅程グループ一覧・詳細）に一覧表示する。表示項目: 開始日〜終了日、
   該当する会場（raceType / raceCourse）と開催日。

### 設計時の補正（元ドラフトからの変更点）

- 元ドラフトの受け入れ基準・仕様には「開催種別（本場/ナイター等、既存の raceStage
  概念を流用）」という表示項目があったが、調査の結果 `raceStage`
  （`packages/core/src/domain/model/valueObject/raceStage.ts`）は「予選/準決勝/決勝」等の
  **勝ち上がり区分**であり、本場/ナイターのような**開催時間帯の区分ではない**ことが判明した。
  ドメインには開催時間帯を表す概念が現状存在しないため、v1 では日中/ナイターの区別は行わず、
  開催日（と、詳細画面遷移後に既存のレース詳細から見える発走時刻）のみを表示する。

## 受け入れ基準

- 14 件すべてが `tripGroupMaster.ts` に定義されている（すべての `placeCode` が
  対応する `raceType` の `courseOfficialMaster` に実在する）。
- 3 会場グループ（例: 九州トリップ2 = 久留米/佐賀/飯塚）で、2 会場が同日開催・
  1 会場が翌日開催の場合、「2 日間の候補」として検出される。
- 単独グループ（水沢・帯広ば）は候補日検出をスキップし、開催日一覧のみ返す。
- グループ内で開催が 1 つも重ならない（またはトレランス日数内に収まらない）期間は
  「候補なし」として返る。
- 「同日」判定は日付（JST）ベースで行う（時刻は問わない）。
- 「連日」の許容日数（デフォルト 2 日）と検索対象期間（デフォルト 180 日）は
  リクエストパラメータ・フロント設定画面から変更できる。

## 適合状況（Conformance）

- **実装完了（2026-07-26）**: `tripGroupMaster.ts`（14グループ固定マスタ、`validateLocationCode`で
  検証済み）・`tripMatchFinder.ts`（`findTripCandidates`、JST暦日クラスタリング）・
  `TripGroupUsecase`（raceTypeごとにfetchを分けクロスマッチを回避）・`TripGroupController`
  （`GET /trip-group`）・front `features/trip_groups/`（一覧・詳細画面、設定画面からの導線）を
  実装。`bun run spec:coverage` で `SPEC-TRIP-001` の `requires`（UT, Component）が
  `covered` になっていることを確認済み。
- 受け入れ基準の各項目を実コード・テストで確認: 14件すべての`placeCode`が対応する
  `courseOfficialMaster`に実在すること（UT）、3会場グループで2会場同日・1会場翌日が
  「2日間の候補」として検出されること（UT）、単独グループは候補日検出をスキップし
  開催日一覧のみ返すこと（UT・Component）、候補が1つも無いグループは「候補なし」として
  返ること（UT）、「連日」許容日数・検索対象期間がリクエストパラメータ・フロント設定画面
  から変更できること（UT・front UT）をそれぞれ確認済み。
- **アーキテクチャ変更（2026-07-26・追記）**: 「旅行のやつ、変な立ち位置だから api にあまり
  手を入れたくない」という判断のもと、この機能専用の api エンドポイント（`GET /trip-group`、
  `TripGroupController`/`TripGroupUsecase`）と、core 側の実装（`tripGroupMaster.ts`/
  `tripMatchFinder.ts`）を廃止し、front（Flutter）側でローカル計算する設計に変更した。
  api は既存の汎用エンドポイントのみを呼ぶ（新規エンドポイント・新規repository/gatewayの追加なし）。
  マッチングアルゴリズムと固定マスタは `packages/front/lib/domain/entities/
  trip_match_finder.dart`・`trip_group_master.dart` へ同一ロジックのままポートし、
  `TripGroupRepositoryImpl`（`data/repositories/trip_group_repository_impl.dart`）が
  取得した開催場一覧からローカルで候補期間を計算する
  （旧 `ITripGroupRemoteDataSource`/`TripGroupModel` は削除）。`ITripGroupRepository` の
  インターフェースおよび `trip_groups_provider.dart`/画面層は変更していない。
- **データ取得元の変更（2026-07-27・追記）**: `TripGroupRepositoryImpl` は当初
  `IRaceRepository`（`GET /race`、レース単位のフルデータ）経由で開催日を取得していたが、
  候補日検出には開催日・会場・raceTypeのみで足りるため、より軽量な `IPlaceRepository`
  （`GET /place`、開催場×開催日単位のデータ）へ切り替えた（データ転送量の削減が目的）。
  合わせて、実装済みのまま参照されておらず api の現行 `GET /place` レスポンス形状とも
  乖離していた `PlaceEntity`/`PlaceModel`/`PlaceRemoteDataSource`
  （`domain/entities/place_entity.dart`・`data/models/place_model.dart`・
  `data/datasources/place_remote_data_source.dart`）を実際のレスポンス形状
  （`placeId`/`raceType`/`raceCourse`/`locationCode`/`datetime`/`placeGrade?`/
  `isRaceListAvailable?`、トップレベルは `{count, places}`）に合わせて刷新した。
  検索対象期間の上限（`kTripLookaheadDaysMax = 365`、設定画面で変更可能）は元々
  1年以内に制限済みだったため変更していない。画面表示（`trip_groups_screen.dart`
  以下）は変更していない。
- **`requires: []` にした理由**: `bun run spec:coverage` は TypeScript の `*.test.ts` の
  みを走査するツールであり、Flutter（`_test.dart`）を検出できない。本仕様の実体が
  front（Flutter）へ完全移設されたため、`requires` を空にして「gap」誤検知を避けている。
  実際の検証は以下の Flutter テストで行っている（全件 green、`flutter analyze` 0 issues）:
  `test/unittest/domain/entities/trip_group_master_test.dart`（14件のid一意性・単独/複数会場
  構成の検証）、`test/unittest/domain/entities/trip_match_finder_test.dart`（`findTripCandidates`
  のクラスタリング・トレランス境界値、`toJstDateKey`）、`test/unittest/data/repositories/
  trip_group_repository_impl_test.dart`（raceTypeごとの呼び分け・単独/複数会場グループの
  組み立て・検索期間の反映）。
