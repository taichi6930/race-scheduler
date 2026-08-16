import 'trip_group_course_entity.dart';

/// 旅程グループマスタ1件分。
///
/// バックエンド（`packages/core/src/domain/master/tripGroupMaster.ts`）の
/// `TripGroupMasterEntry` と対応する。プレーンな不変マスタデータのみを
/// 保持するため freezed 化はしない。
class TripGroupMasterEntry {
  const TripGroupMasterEntry({
    required this.id,
    required this.name,
    required this.courses,
  });

  /// 安定した一意キー（kebab-case、URLパス`/trip-groups/:id`にも使う）。
  final String id;

  /// 画面表示名
  final String name;
  final List<TripGroupCourseEntity> courses;
}

/// 旅程グループ 固定マスタ（v1）
///
/// 個人的な公営競技制覇プロジェクトで「近くの会場をセットで回る」組み合わせを
/// ハードコードしたもの。動的な登録・編集は v2 で別途検討する
/// （`docs/specs/SPEC-TRIP-001.md` §5 参照）。
///
/// もともとは `packages/core/src/domain/master/tripGroupMaster.ts` として
/// api 側に置かれていたが、「旅行のやつ、変な立ち位置だから api にあまり
/// 手を入れたくない」という判断のもと、api の専用エンドポイント
/// （`GET /trip-group`）を廃止しfront側でローカル計算する設計に変更した際、
/// このマスタデータもfrontへ移設した（内容は完全に同一）。
///
/// `courses.length == 1` の場合は単独グループ（候補日検出の対象外）。
/// 「九州遠征」は同時には回らないため kyushu-1/kyushu-2/kyushu-3 の3グループに
/// 分割している。
const List<TripGroupMasterEntry> tripGroupMasterList = [
  TripGroupMasterEntry(
    id: 'kochi',
    name: '高知',
    courses: [
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '高知',
        placeCode: '31',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '高知',
        placeCode: '74',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'kyushu-1',
    name: '九州トリップ1',
    courses: [
      TripGroupCourseEntity(
        raceType: 'autorace',
        raceCourse: '飯塚',
        placeCode: '05',
      ),
      TripGroupCourseEntity(
        raceType: 'jra',
        raceCourse: '小倉',
        placeCode: '10',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '小倉',
        placeCode: '81',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'kyushu-2',
    name: '九州トリップ2',
    courses: [
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '久留米',
        placeCode: '83',
      ),
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '佐賀',
        placeCode: '32',
      ),
      TripGroupCourseEntity(
        raceType: 'autorace',
        raceCourse: '飯塚',
        placeCode: '05',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'kyushu-3',
    name: '九州トリップ3',
    courses: [
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '武雄',
        placeCode: '84',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '佐世保',
        placeCode: '85',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'gifu',
    name: '岐阜（笠松グループ）',
    courses: [
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '大垣',
        placeCode: '44',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '岐阜',
        placeCode: '43',
      ),
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '笠松',
        placeCode: '23',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'aichi',
    name: '愛知（名古屋グループ）',
    courses: [
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '名古屋',
        placeCode: '42',
      ),
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '名古屋',
        placeCode: '24',
      ),
      TripGroupCourseEntity(
        raceType: 'jra',
        raceCourse: '中京',
        placeCode: '07',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'toyohashi-hamamatsu',
    name: '豊橋・浜松',
    courses: [
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '豊橋',
        placeCode: '45',
      ),
      TripGroupCourseEntity(
        raceType: 'autorace',
        raceCourse: '浜松',
        placeCode: '04',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'fukushima',
    name: '福島',
    courses: [
      TripGroupCourseEntity(
        raceType: 'jra',
        raceCourse: '福島',
        placeCode: '03',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: 'いわき平',
        placeCode: '13',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'hakodate-aomori',
    name: '函館・青森',
    courses: [
      TripGroupCourseEntity(
        raceType: 'jra',
        raceCourse: '函館',
        placeCode: '02',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '青森',
        placeCode: '12',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'sonoda',
    name: '園田',
    courses: [
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '園田',
        placeCode: '27',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '岸和田',
        placeCode: '56',
      ),
      TripGroupCourseEntity(
        raceType: 'boatrace',
        raceCourse: '尼崎',
        placeCode: '13',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'kanazawa-toyama',
    name: '金沢・富山',
    courses: [
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '金沢',
        placeCode: '22',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '富山',
        placeCode: '46',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'mizusawa',
    name: '水沢（単独）',
    courses: [
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '水沢',
        placeCode: '11',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'kyoto',
    name: '京都',
    courses: [
      TripGroupCourseEntity(
        raceType: 'jra',
        raceCourse: '京都',
        placeCode: '08',
      ),
      TripGroupCourseEntity(
        raceType: 'keirin',
        raceCourse: '向日町',
        placeCode: '54',
      ),
    ],
  ),
  TripGroupMasterEntry(
    id: 'obihiro',
    name: '帯広（単独、ばんえい）',
    courses: [
      TripGroupCourseEntity(
        raceType: 'nar',
        raceCourse: '帯広ば',
        placeCode: '03',
      ),
    ],
  ),
];
