// VenueChipsBar のデシジョンテーブル
//
// | ID   | 条件                                | 期待                                 |
// | ---- | ------------------------------------ | --------------------------------------- |
// | T-01 | venues=[中山, 東京]から東京をタップ  | onToggleVenueが'東京'で呼ばれる       |
// | T-02 | selectedVenues={中山}を指定          | 中山が選択状態で表示される           |
// | T-03 | 通常描画（A11Y-013）                 | チップのタップ領域の高さが44以上     |
// | T-04 | selectedVenues={京都}を指定（末尾の要素） | 京都が中山より先頭側に表示される（並び替え） |
// | T-05 | 京都をタップして選択後、再タップして解除   | 解除後も京都の表示位置が変わらない（変な挙動の回帰防止） |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/venue_chips_bar.dart';

void main() {
  Widget buildBar({
    required List<String> venues,
    required Set<String> selectedVenues,
    required ValueChanged<String> onToggleVenue,
  }) {
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: VenueChipsBar(
          venues: venues,
          selectedVenues: selectedVenues,
          onToggleVenue: onToggleVenue,
        ),
      ),
    );
  }

  // 実アプリのRiverpod状態と同じく、選択集合を新しいSetへ置き換えて
  // トグルするステートフルなラッパー（T-05用）。selectedVenuesはbuilder外の
  // スコープに置き、StatefulBuilderの再構築をまたいで状態を保持する。
  Widget buildStatefulBar({required List<String> venues}) {
    var selectedVenues = const <String>{};
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) {
            return VenueChipsBar(
              venues: venues,
              selectedVenues: selectedVenues,
              onToggleVenue: (venue) => setState(() {
                selectedVenues = selectedVenues.contains(venue)
                    ? ({...selectedVenues}..remove(venue))
                    : {...selectedVenues, venue};
              }),
            );
          },
        ),
      ),
    );
  }

  testWidgets('[T-01] 東京をタップ_onToggleVenueが東京で呼ばれる', (tester) async {
    String? tapped;
    await tester.pumpWidget(
      buildBar(
        venues: const ['中山', '東京'],
        selectedVenues: const {},
        onToggleVenue: (venue) => tapped = venue,
      ),
    );

    await tester.tap(find.text('東京'));
    await tester.pump();

    expect(tapped, '東京');
  });

  testWidgets('[T-02] selectedVenues=中山指定_中山が選択状態で表示される', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(
        venues: const ['中山'],
        selectedVenues: const {'中山'},
        onToggleVenue: (_) {},
      ),
    );

    expect(
      tester.getSemantics(find.text('中山')),
      matchesSemantics(
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
        label: '中山',
      ),
    );
    handle.dispose();
  });

  testWidgets('[T-03] 通常描画_チップのタップ領域の高さが44以上', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      buildBar(
        venues: const ['中山'],
        selectedVenues: const {},
        onToggleVenue: (_) {},
      ),
    );

    final size = tester.getSize(find.bySemanticsLabel('中山'));

    expect(size.height, greaterThanOrEqualTo(44));
    handle.dispose();
  });

  testWidgets('[T-04] selectedVenues=京都指定_中山より先頭側に表示される', (tester) async {
    await tester.pumpWidget(
      buildBar(
        venues: const ['中山', '東京', '京都'],
        selectedVenues: const {'京都'},
        onToggleVenue: (_) {},
      ),
    );

    final kyotoX = tester.getTopLeft(find.text('京都')).dx;
    final nakayamaX = tester.getTopLeft(find.text('中山')).dx;

    expect(kyotoX, lessThan(nakayamaX));
  });

  testWidgets('[T-05] 京都を選択後に解除_表示位置が変わらない', (tester) async {
    await tester.pumpWidget(buildStatefulBar(venues: const ['中山', '東京', '京都']));

    await tester.tap(find.text('京都'));
    await tester.pumpAndSettle();
    final selectedX = tester.getTopLeft(find.text('京都')).dx;

    await tester.tap(find.text('京都'));
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.text('京都')).dx, selectedX);
  });
}
