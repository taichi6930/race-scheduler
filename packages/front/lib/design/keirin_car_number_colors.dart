import 'package:flutter/material.dart';

/// 競輪の車番（1〜9）ごとの慣例色（JKAの規定に準拠）。
///
/// 出走選手ロスター表示（KPLAYER-07）で、車番を数字だけでなく色でも
/// 判別できるようにするために使う。
///
/// 競馬の「枠番」（複数の馬番が同じ枠を共有する）とは異なり、競輪は
/// 車番そのものに固定の色が割り当てられる（枠番は出走選手の並び順や
/// 隊列の区分であり、色とは無関係。7車立て等、9車に満たないレースでは
/// 複数の車番が同一の枠番を共有しうるため、色を枠番で引くと誤った色に
/// なる。実際に誤って枠番で色を引いていた不具合の修正を含む）。
const Map<int, Color> keirinCarNumberColors = {
  1: Color(0xFFFFFFFF), // 白
  2: Color(0xFF1A1A1A), // 黒
  3: Color(0xFFE53935), // 赤
  4: Color(0xFF1E88E5), // 青
  5: Color(0xFFFDD835), // 黄
  6: Color(0xFF43A047), // 緑
  7: Color(0xFFFB8C00), // 橙
  8: Color(0xFFEC407A), // 桃
  9: Color(0xFF8E24AA), // 紫
};

/// 車番の慣例色に対して、車番の数字ラベルを視認できるコントラスト色を返す。
/// 白・黄のような明るい色は黒文字、それ以外は白文字にする。
const Set<int> _lightCarNumbers = {1, 5};

Color keirinCarNumberLabelColorFor(int carNumber) =>
    _lightCarNumbers.contains(carNumber) ? Colors.black : Colors.white;
