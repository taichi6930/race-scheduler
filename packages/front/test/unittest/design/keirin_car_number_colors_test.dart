// keirinCarNumberColors / keirinCarNumberLabelColorFor のデシジョンテーブル
//
// | ID   | 対象                          | 期待                                  |
// | ---- | ------------------------------ | -------------------------------------- |
// | T-01 | keirinCarNumberColors[1]      | 白 (0xFFFFFFFF)                        |
// | T-02 | keirinCarNumberColors[2]      | 黒 (0xFF1A1A1A)                        |
// | T-03 | keirinCarNumberColors[3]      | 赤 (0xFFE53935)                        |
// | T-04 | keirinCarNumberColors[4]      | 青 (0xFF1E88E5)                        |
// | T-05 | keirinCarNumberColors[5]      | 黄 (0xFFFDD835)                        |
// | T-06 | keirinCarNumberColors[6]      | 緑 (0xFF43A047)                        |
// | T-07 | keirinCarNumberColors[7]      | 橙 (0xFFFB8C00)                        |
// | T-08 | keirinCarNumberColors[8]      | 桃 (0xFFEC407A)                        |
// | T-09 | keirinCarNumberColors[9]      | 紫 (0xFF8E24AA)                        |
// | T-10 | keirinCarNumberLabelColorFor(1) | 黒文字（明るい色）                  |
// | T-11 | keirinCarNumberLabelColorFor(9) | 白文字（紫は暗色）                  |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/keirin_car_number_colors.dart';

void main() {
  group('keirinCarNumberColors', () {
    test('[T-01] 1番_白を返す', () {
      expect(keirinCarNumberColors[1], const Color(0xFFFFFFFF));
    });

    test('[T-02] 2番_黒を返す', () {
      expect(keirinCarNumberColors[2], const Color(0xFF1A1A1A));
    });

    test('[T-03] 3番_赤を返す', () {
      expect(keirinCarNumberColors[3], const Color(0xFFE53935));
    });

    test('[T-04] 4番_青を返す', () {
      expect(keirinCarNumberColors[4], const Color(0xFF1E88E5));
    });

    test('[T-05] 5番_黄を返す', () {
      expect(keirinCarNumberColors[5], const Color(0xFFFDD835));
    });

    test('[T-06] 6番_緑を返す', () {
      expect(keirinCarNumberColors[6], const Color(0xFF43A047));
    });

    test('[T-07] 7番_橙を返す', () {
      expect(keirinCarNumberColors[7], const Color(0xFFFB8C00));
    });

    test('[T-08] 8番_桃を返す', () {
      expect(keirinCarNumberColors[8], const Color(0xFFEC407A));
    });

    test('[T-09] 9番_紫を返す', () {
      expect(keirinCarNumberColors[9], const Color(0xFF8E24AA));
    });
  });

  group('keirinCarNumberLabelColorFor', () {
    test('[T-10] 1番_明るい色のため黒文字を返す', () {
      expect(keirinCarNumberLabelColorFor(1), Colors.black);
    });

    test('[T-11] 9番_紫は暗色のため白文字を返す', () {
      expect(keirinCarNumberLabelColorFor(9), Colors.white);
    });
  });
}
