// tripGroupMasterList のデシジョンテーブル
//
// | ID   | 検証内容                                              | 期待結果          |
// | ---- | -------------------------------------------------------- | -------------------- |
// | T-01 | 全グループの id が一意である                          | 重複なし           |
// | T-02 | 単独グループ（mizusawa/obihiro）が courses.length == 1 | true               |
// | T-03 | 複数会場グループ（courses.length >= 2）が1件以上存在する | true             |
// | T-04 | 全 course の placeCode が2桁の数字（LocationCode形式）である | true         |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/trip_group_master.dart';

void main() {
  group('tripGroupMasterList', () {
    test('[T-01] 全グループのidが一意である', () {
      final ids = tripGroupMasterList.map((e) => e.id).toList();

      final uniqueIds = ids.toSet();

      expect(uniqueIds.length, ids.length);
    });

    test('[T-02] 単独グループ(mizusawa/obihiro)はcoursesが1件である', () {
      final mizusawa = tripGroupMasterList.firstWhere(
        (e) => e.id == 'mizusawa',
      );
      final obihiro = tripGroupMasterList.firstWhere((e) => e.id == 'obihiro');

      expect(mizusawa.courses, hasLength(1));
      expect(obihiro.courses, hasLength(1));
    });

    test('[T-03] 複数会場グループが1件以上存在する', () {
      final multiCourseGroups = tripGroupMasterList
          .where((e) => e.courses.length >= 2)
          .toList();

      expect(multiCourseGroups, isNotEmpty);
    });

    test('[T-04] 全courseのplaceCodeが2桁の数字である', () {
      final allCourses = tripGroupMasterList.expand((e) => e.courses);

      for (final course in allCourses) {
        expect(RegExp(r'^\d{2}$').hasMatch(course.placeCode), isTrue);
      }
    });
  });
}
