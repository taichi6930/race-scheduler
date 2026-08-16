-- ui_layout テーブル: Server-Driven UIのレイアウト構成（フィールド参照JSON）を保存する
-- （aidlc-docs/inception/application-design/race-detail-sdui-design.md 参照）
--
-- feature_flag と同じ「行が存在すればその値が最優先、無ければコード内既定値に
-- フォールバック」という考え方を、boolean 1個ではなくJSON構成全体に拡張したもの。
-- layout_key はアプリケーションコード側で定義する識別子（例:
-- 'race_detail.keirin'）で、外部キー的な参照先は持たない。
--
-- config は RaceDetailUiConfig（core側スキーマ）のJSON文字列。値そのものではなく
-- フィールド参照（core/fieldCatalog.tsのキー）のみを持つため、このテーブルに
-- 保存された内容だけでは表示ロジック自体を書き換えることはできない。
CREATE TABLE IF NOT EXISTS ui_layout (
    layout_key TEXT PRIMARY KEY,
    config TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_ui_layout_updated_at
AFTER UPDATE ON ui_layout
FOR EACH ROW
BEGIN
    UPDATE ui_layout SET updated_at = CURRENT_TIMESTAMP
    WHERE layout_key = NEW.layout_key;
END;
