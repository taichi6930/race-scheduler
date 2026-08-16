import 'package:flutter/material.dart';

/// Google Calendar のイベント色キー。
///
/// `packages/core/src/domain/policy/calendarEventContent.ts` の
/// `GoogleCalendarColor` を単一の正典とし、front(Dart) 用に手動で同期した値。
/// バックエンドが変更された場合はこちらも追従させること。
enum GoogleCalendarColorKey {
  lavender,
  sage,
  grape,
  flamingo,
  banana,
  tangerine,
  peacock,
  graphite,
  blueberry,
  basil,
  tomato,
}

/// [GoogleCalendarColorKey] ごとの背景色・前景色（バッジ文字色）。
///
/// 背景色は `calendarEventContent.ts` の `GoogleCalendarColor.backgroundColor`
/// と同一の HEX 値。前景色は各背景色に対する WCAG 相対輝度を計算し、白文字と
/// ダークink文字のうちコントラスト比が高い方を選んでいる（Google Calendar
/// 自体に前景色の定義は無いため、front独自に決定）。
class GoogleCalendarPalette {
  const GoogleCalendarPalette._();

  static const Color _ink = Color(0xFF171B18);

  static const Map<GoogleCalendarColorKey, Color> background = {
    GoogleCalendarColorKey.lavender: Color(0xFF7986CB),
    GoogleCalendarColorKey.sage: Color(0xFF33B679),
    GoogleCalendarColorKey.grape: Color(0xFF8E24AA),
    GoogleCalendarColorKey.flamingo: Color(0xFFE67C73),
    GoogleCalendarColorKey.banana: Color(0xFFF6BF26),
    GoogleCalendarColorKey.tangerine: Color(0xFFF4511E),
    GoogleCalendarColorKey.peacock: Color(0xFF039BE5),
    GoogleCalendarColorKey.graphite: Color(0xFF616161),
    GoogleCalendarColorKey.blueberry: Color(0xFF3F51B5),
    GoogleCalendarColorKey.basil: Color(0xFF0B8043),
    GoogleCalendarColorKey.tomato: Color(0xFFD50000),
  };

  static const Map<GoogleCalendarColorKey, Color> foreground = {
    GoogleCalendarColorKey.lavender: _ink,
    GoogleCalendarColorKey.sage: _ink,
    GoogleCalendarColorKey.grape: Colors.white,
    GoogleCalendarColorKey.flamingo: _ink,
    GoogleCalendarColorKey.banana: _ink,
    GoogleCalendarColorKey.tangerine: _ink,
    // white(3.08:1)はWCAG AA(4.5:1)未達。ink(5.66:1)の方が高コントラストなため
    // 修正（A11Y-010、自動コントラスト検証で発覚した唯一の選定ミス）。
    GoogleCalendarColorKey.peacock: _ink,
    GoogleCalendarColorKey.graphite: Colors.white,
    GoogleCalendarColorKey.blueberry: Colors.white,
    GoogleCalendarColorKey.basil: Colors.white,
    GoogleCalendarColorKey.tomato: Colors.white,
  };
}
