import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// widgetbook は本番ビルドに含まれないカタログ専用の別entry point（main.dartから
// 到達不可）のため dev_dependencies に配置している（PERF-153）。lib/ 配下からの
// dev_dependencies 参照はDartの既定lintが警告するため、この既知の意図的な配置を明示する。
// ignore: depend_on_referenced_packages
import 'package:widgetbook/widgetbook.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/di/shared_preferences_provider.dart';
import 'core/jst_time.dart';
import 'design/atoms/color_dot.dart';
import 'design/atoms/discipline_icon.dart';
import 'design/atoms/discipline_toggle_chip.dart';
import 'design/atoms/grade_badge.dart';
import 'design/atoms/gradient_card.dart';
import 'design/atoms/now_divider.dart';
import 'design/atoms/pill.dart';
import 'design/atoms/refresh_icon_button.dart';
import 'design/atoms/sub_filter_chip.dart';
import 'design/atoms/surface_card.dart';
import 'design/atoms/tappable_card.dart';
import 'design/atoms/unconfirmed_badge.dart';
import 'design/google_calendar_colors.dart';
import 'design/molecules/empty_state.dart';
import 'design/molecules/error_retry_card.dart';
import 'design/molecules/filter_chips_bar.dart';
import 'design/molecules/grade_color_legend.dart';
import 'design/molecules/grade_tier_chips_bar.dart';
import 'design/molecules/keiba_type_chips_bar.dart';
import 'design/molecules/loading_skeleton_list.dart';
import 'design/molecules/scrollable_chip_row.dart';
import 'design/molecules/venue_chips_bar.dart';
import 'design/organisms/month_calendar_grid.dart';
import 'design/organisms/next_race_card.dart';
import 'design/organisms/race_row.dart';
import 'design/organisms/settings_rows.dart';
import 'design/theme.dart';
import 'design/tokens.dart';
import 'design/typography.dart';
import 'domain/entities/race_entity.dart';
import 'domain/entities/grade_tier.dart';
import 'domain/entities/race_type.dart';
import 'domain/entities/release_note_category.dart';
import 'domain/entities/release_note_entity.dart';
import 'domain/entities/trip_group_course_entity.dart';
import 'domain/entities/trip_group_entity.dart';
import 'features/favorites/application/favorite_races_provider.dart';
import 'features/favorites/presentation/favorites_screen.dart';
import 'features/settings/presentation/settings_screen.dart';
import 'features/timeline/application/all_timeline_provider.dart';
import 'features/timeline/application/now_provider.dart';
import 'features/timeline/application/timeline_filter_provider.dart';
import 'features/timeline/application/timeline_provider.dart';
import 'features/timeline/presentation/timeline_screen.dart';
import 'features/trip_groups/application/trip_groups_provider.dart';
import 'features/trip_groups/presentation/trip_group_detail_screen.dart';
import 'features/trip_groups/presentation/trip_groups_screen.dart';
import 'features/whats_new/application/release_notes_provider.dart';
import 'features/whats_new/presentation/whats_new_screen.dart';
import 'notifications/application/notification_scheduler_provider.dart';
import 'notifications/i_notification_scheduler.dart';

// ---------------------------------------------------------------------------
// サンプルデータ
// ---------------------------------------------------------------------------

final _sampleRace = RaceEntity(
  raceId: 'race-001',
  raceName: '東京優駿（日本ダービー）',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '東京',
  datetime: DateTime.now().add(const Duration(minutes: 5)).toIso8601String(),
  raceGrade: 'GⅠ',
  raceNumber: 11,
  surfaceType: '芝',
  distance: 2400,
);

final _plainRace = RaceEntity(
  raceId: 'race-002',
  raceName: '春の府中特別',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '東京',
  datetime: DateTime.now().add(const Duration(minutes: 30)).toIso8601String(),
  raceNumber: 1,
  surfaceType: '芝',
  distance: 1800,
);

const _tripCourse = TripGroupCourseEntity(
  raceType: 'nar',
  raceCourse: '高知',
  placeCode: '31',
);

const _tripCourse2 = TripGroupCourseEntity(
  raceType: 'keirin',
  raceCourse: '高知',
  placeCode: '74',
);

final _tripGroups = [
  TripGroupEntity(
    id: 'kochi',
    name: '高知',
    courses: const [_tripCourse, _tripCourse2],
    heldDates: [
      DateTime.now()
          .add(const Duration(days: 1))
          .toIso8601String()
          .split('T')[0],
      DateTime.now()
          .add(const Duration(days: 2))
          .toIso8601String()
          .split('T')[0],
    ],
  ),
];

final _releaseNotes = [
  ReleaseNoteEntity(
    tagName: 'v1.32.0',
    publishedAt: DateTime.now().subtract(const Duration(days: 1)),
    categories: const [
      ReleaseNoteCategoryEntryEntity(
        category: ReleaseNoteCategory.improvement,
        items: ['通知の重複を解消しました'],
      ),
      ReleaseNoteCategoryEntryEntity(
        category: ReleaseNoteCategory.newInfo,
        items: ['出走選手のロスターを表示できるようになりました'],
      ),
    ],
  ),
];

/// テストで使う `_FakeNotificationScheduler`（timeline_screen_test.dart）と
/// 同様、実プラットフォームチャンネルを持たないWebカタログ上ではスケジューラを
/// 常にフェイクへ差し替える。
class _FakeNotificationScheduler implements INotificationScheduler {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {}

  @override
  Future<void> cancelRaceNotification(String raceId) async {}

  @override
  Future<void> cancelAll() async {}
}

// ---------------------------------------------------------------------------
// エントリポイント
// 起動: flutter run -t lib/widgetbook.dart -d chrome --web-port 8081
// ---------------------------------------------------------------------------

/// Templates（画面）カテゴリはRiverpod providerに依存するため、起動時に一度だけ
/// 用意した空のSharedPreferencesをsharedPreferencesProviderへ差し込む
/// （各screen_test.dartの`_buildApp`と同じ方式）。
late final SharedPreferences _prefs;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // widgetbookは本番ビルドに含まれないカタログ専用entry point（PERF-153、本ファイル
  // 冒頭の注記と同様）のため、テスト外からのvisibleForTesting APIの利用を許容する。
  // ignore: invalid_use_of_visible_for_testing_member
  SharedPreferences.setMockInitialValues({});
  _prefs = await SharedPreferences.getInstance();
  runApp(const WidgetbookApp());
}

class WidgetbookApp extends StatelessWidget {
  const WidgetbookApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Widgetbook.material(
      addons: [
        MaterialThemeAddon(
          themes: [
            WidgetbookTheme(name: 'ライト', data: AppTheme.light()),
            WidgetbookTheme(name: 'ダーク', data: AppTheme.dark()),
          ],
        ),
        AlignmentAddon(),
        ZoomAddon(),
      ],
      directories: [
        // ----------------------------------------------------------------
        // Design（design-system.md のトークン見本）
        // ----------------------------------------------------------------
        WidgetbookCategory(
          name: 'Design',
          children: [
            WidgetbookComponent(
              name: 'Tokens',
              useCases: [
                WidgetbookUseCase(
                  name: 'カラー・タイポグラフィ',
                  builder: (context) => const _DesignTokensShowcase(),
                ),
              ],
            ),
          ],
        ),

        // ----------------------------------------------------------------
        // Atoms（design/atoms、これ以上分解できない最小単位）
        // ----------------------------------------------------------------
        WidgetbookCategory(
          name: 'Atoms',
          children: [
            WidgetbookComponent(
              name: 'GradeBadge',
              useCases: [
                WidgetbookUseCase(
                  name: 'GⅠ (top)',
                  builder: (context) =>
                      const GradeBadge(raceType: RaceType.jra, grade: 'GⅠ'),
                ),
                WidgetbookUseCase(
                  name: 'GⅡ (high)',
                  builder: (context) =>
                      const GradeBadge(raceType: RaceType.jra, grade: 'GⅡ'),
                ),
                WidgetbookUseCase(
                  name: 'GⅢ (mid)',
                  builder: (context) =>
                      const GradeBadge(raceType: RaceType.jra, grade: 'GⅢ'),
                ),
                WidgetbookUseCase(
                  name: 'オープン (low)',
                  builder: (context) =>
                      const GradeBadge(raceType: RaceType.jra, grade: 'オープン'),
                ),
                WidgetbookUseCase(
                  name: '未勝利 (none・非表示)',
                  builder: (context) =>
                      const GradeBadge(raceType: RaceType.jra, grade: '未勝利'),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'DisciplineIcon',
              useCases: [
                for (final type in RaceType.all)
                  WidgetbookUseCase(
                    name: DisciplineIcon.labelFor(type),
                    builder: (context) => DisciplineIcon(raceType: type),
                  ),
              ],
            ),
            WidgetbookComponent(
              name: 'NowDivider',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => NowDivider(now: jstNow()),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'Pill',
              useCases: [
                WidgetbookUseCase(
                  name: 'レース番号（surface2・角丸5）',
                  builder: (context) => Pill(
                    backgroundColor: context.colors.surface2,
                    borderRadius: 5,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    child: Text(
                      '11R',
                      style: AppTypography.caption.copyWith(
                        color: context.colors.ink3,
                      ),
                    ),
                  ),
                ),
                WidgetbookUseCase(
                  name: '正方形アイコンバッジ（30×30・角丸8）',
                  builder: (context) => Pill(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    backgroundColor: context.colors.surface2,
                    borderRadius: 8,
                    padding: EdgeInsets.zero,
                    child: const Text('🔔', style: TextStyle(fontSize: 15)),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'TappableCard',
              useCases: [
                WidgetbookUseCase(
                  name: '塗り+枠線（角丸14・レース行のカード相当）',
                  builder: (context) => TappableCard(
                    borderRadius: 14,
                    color: context.colors.surface,
                    border: Border.all(color: context.colors.line),
                    padding: const EdgeInsets.all(16),
                    onTap: () {},
                    child: Text(
                      'タップできる面',
                      style: AppTypography.bodySmall.copyWith(
                        color: context.colors.ink,
                      ),
                    ),
                  ),
                ),
                WidgetbookUseCase(
                  name: 'ピル形（角丸999・サブタブ相当）',
                  builder: (context) => TappableCard(
                    borderRadius: 999,
                    color: context.colors.brand,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    onTap: () {},
                    child: Text(
                      'レース',
                      style: AppTypography.bodySmall.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'ColorDot',
              useCases: [
                WidgetbookUseCase(
                  name: '凡例用（10px）',
                  builder: (context) => ColorDot(
                    color: GoogleCalendarPalette
                        .background[GoogleCalendarColorKey.blueberry]!,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'カレンダーの開催マーカー（5px）',
                  builder: (context) => ColorDot(
                    size: 5,
                    color: GoogleCalendarPalette
                        .background[GoogleCalendarColorKey.tomato]!,
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'SurfaceCard',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => SurfaceCard(
                    child: Text(
                      'surface + 角丸14 + 枠線の標準カード',
                      style: AppTypography.bodySmall.copyWith(
                        color: context.colors.ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'GradientCard',
              useCases: [
                WidgetbookUseCase(
                  name: 'GⅠ配色を基準色にしたヒーローカード',
                  builder: (context) => GradientCard(
                    baseColor: GoogleCalendarPalette
                        .background[GoogleCalendarColorKey.blueberry]!,
                    child: const Text(
                      '基準色からグラデーションと影を作る',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'SubFilterChip',
              useCases: [
                WidgetbookUseCase(
                  name: '選択中',
                  builder: (context) => SubFilterChip(
                    label: '重賞のみ',
                    selected: true,
                    onTap: () {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '非選択',
                  builder: (context) => SubFilterChip(
                    label: '重賞のみ',
                    selected: false,
                    onTap: () {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'RefreshIconButton',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => RefreshIconButton(onPressed: () {}),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'DisciplineToggleChip',
              useCases: [
                WidgetbookUseCase(
                  name: '選択中',
                  builder: (context) => DisciplineToggleChip(
                    discipline: Discipline.keiba,
                    selected: true,
                    onTap: () {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '非選択（薄く表示）',
                  builder: (context) => DisciplineToggleChip(
                    discipline: Discipline.keiba,
                    selected: false,
                    onTap: () {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'UnconfirmedBadge',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => const UnconfirmedBadge(),
                ),
              ],
            ),
          ],
        ),

        // ----------------------------------------------------------------
        // Molecules（design/molecules、atomsを組み合わせた最小の機能単位）
        // ----------------------------------------------------------------
        WidgetbookCategory(
          name: 'Molecules',
          children: [
            WidgetbookComponent(
              name: 'FilterChipsBar',
              useCases: [
                WidgetbookUseCase(
                  name: '重賞のみ・全競技ON',
                  builder: (context) => FilterChipsBar(
                    state: const TimelineFilterState(gradeOnly: true),
                    enabledDisciplines: Discipline.all.toSet(),
                    onToggleMode: (_) {},
                    onToggleDiscipline: (_) {},
                  ),
                ),
                WidgetbookUseCase(
                  name: 'お気に入り・一部競技OFF',
                  builder: (context) => FilterChipsBar(
                    state: const TimelineFilterState(
                      gradeOnly: false,
                      favoriteOnly: true,
                    ),
                    enabledDisciplines: const {
                      Discipline.keiba,
                      Discipline.keirin,
                    },
                    onToggleMode: (_) {},
                    onToggleDiscipline: (_) {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'GradeTierChipsBar',
              useCases: [
                WidgetbookUseCase(
                  name: '未選択・競馬+競輪ON',
                  builder: (context) => GradeTierChipsBar(
                    selectedTiers: const {},
                    enabledDisciplines: const {
                      Discipline.keiba,
                      Discipline.keirin,
                    },
                    onToggleTier: (_) {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '最高峰を選択中',
                  builder: (context) => GradeTierChipsBar(
                    selectedTiers: const {GradeTier.top},
                    enabledDisciplines: Discipline.all.toSet(),
                    onToggleTier: (_) {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'KeibaTypeChipsBar',
              useCases: [
                WidgetbookUseCase(
                  name: '未選択',
                  builder: (context) => KeibaTypeChipsBar(
                    selectedTypes: const {},
                    onToggleType: (_) {},
                  ),
                ),
                WidgetbookUseCase(
                  name: 'JRA選択中',
                  builder: (context) => KeibaTypeChipsBar(
                    selectedTypes: const {RaceType.jra},
                    onToggleType: (_) {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'VenueChipsBar',
              useCases: [
                WidgetbookUseCase(
                  name: '会場1件',
                  builder: (context) => VenueChipsBar(
                    venues: const ['東京'],
                    selectedVenues: const {},
                    onToggleVenue: (_) {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '会場多数（横スクロール確認用）',
                  builder: (context) => VenueChipsBar(
                    venues: const [
                      '東京',
                      '中山',
                      '京都',
                      '阪神',
                      '中京',
                      '小倉',
                      '新潟',
                      '福島',
                      '札幌',
                      '函館',
                    ],
                    selectedVenues: const {'京都'},
                    onToggleVenue: (_) {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'ScrollableChipRow',
              useCases: [
                WidgetbookUseCase(
                  name: '選択中チップを先頭へスクロール（PR #2452の回帰確認用）',
                  builder: (context) => ScrollableChipRow<String>(
                    items: const ['A', 'B', 'C', 'D', 'E'],
                    isSelected: (item) => item == 'C',
                    itemBuilder: (context, item) => SubFilterChip(
                      label: item,
                      selected: item == 'C',
                      onTap: () {},
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'GradeColorLegend',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => const GradeColorLegend(),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'EmptyState',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) =>
                      const EmptyState(icon: '🔍', message: '条件に合うレースがありません'),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'ErrorRetryCard',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => ErrorRetryCard(onRetry: () {}),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'LoadingSkeletonList',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => const LoadingSkeletonList(),
                ),
              ],
            ),
          ],
        ),

        // ----------------------------------------------------------------
        // Organisms（design/organisms、moleculesを組み合わせた複合セクション）
        // ----------------------------------------------------------------
        WidgetbookCategory(
          name: 'Organisms',
          children: [
            WidgetbookComponent(
              name: 'RaceRow',
              useCases: [
                WidgetbookUseCase(
                  name: '未発走・重賞・お気に入り・カウントダウン',
                  builder: (context) => RaceRow(
                    race: _sampleRace,
                    isPast: false,
                    isFavorite: true,
                    countdownMinutes: 5,
                    onTap: () {},
                    onToggleFavorite: () {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '未発走・一般（グレードなし）',
                  builder: (context) => RaceRow(
                    race: _plainRace,
                    isPast: false,
                    isFavorite: false,
                    onTap: () {},
                    onToggleFavorite: () {},
                  ),
                ),
                WidgetbookUseCase(
                  name: '発走済み',
                  builder: (context) => RaceRow(
                    race: _sampleRace,
                    isPast: true,
                    isFavorite: false,
                    onTap: () {},
                    onToggleFavorite: () {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'NextRaceCard',
              useCases: [
                WidgetbookUseCase(
                  name: '未発走レース',
                  builder: (context) => NextRaceCard(
                    race: _sampleRace,
                    isFavorite: false,
                    onTap: () {},
                    onToggleFavorite: () {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'MonthCalendarGrid',
              useCases: [
                WidgetbookUseCase(
                  name: '複数tierマーカー・選択日あり',
                  builder: (context) => MonthCalendarGrid(
                    month: DateTime(2026, 4),
                    markers: const {
                      5: GoogleCalendarColorKey.blueberry,
                      12: GoogleCalendarColorKey.tomato,
                      19: GoogleCalendarColorKey.basil,
                      26: GoogleCalendarColorKey.banana,
                    },
                    selectedDay: 19,
                    onSelectDay: (_) {},
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'SettingsRows',
              useCases: [
                WidgetbookUseCase(
                  name: 'グループ（トグル・ステッパー・セグメント・値表示）',
                  builder: (context) => SettingsGroup(
                    title: '通知',
                    children: [
                      SettingsToggleRow(
                        icon: '🔔',
                        title: '通知を受け取る',
                        value: true,
                        onChanged: (_) {},
                      ),
                      SettingsStepperRow(
                        icon: '⏱',
                        title: '通知タイミング',
                        valueLabel: '5分前',
                        onDecrement: () {},
                        onIncrement: () {},
                      ),
                      SettingsSegmentRow(
                        icon: '🎨',
                        title: 'テーマ',
                        options: const ['自動', '明', '暗'],
                        selectedIndex: 0,
                        onSelect: (_) {},
                      ),
                      const SettingsValueRow(
                        icon: '⭐',
                        title: '既定フィルタ',
                        value: '重賞のみ',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),

        // ----------------------------------------------------------------
        // Templates（画面。features/*/presentation の各Screenを
        // ProviderScope overrideでモックし、Atoms〜Organismsが実際の画面上で
        // どう組み合わさるかを確認できるようにする）
        // ----------------------------------------------------------------
        WidgetbookCategory(
          name: 'Templates',
          children: [
            WidgetbookComponent(
              name: 'TimelineScreen',
              useCases: [
                WidgetbookUseCase(
                  name: '未発走・過去のレースが混在',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      nowProvider.overrideWith(
                        (ref) => Stream.value(DateTime.now()),
                      ),
                      timelineProvider.overrideWith(
                        (ref, date) async => [_sampleRace, _plainRace],
                      ),
                      monthRaceChunkProvider.overrideWith(
                        (ref, monthKey) async => [_sampleRace, _plainRace],
                      ),
                      notificationSchedulerProvider.overrideWithValue(
                        _FakeNotificationScheduler(),
                      ),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const TimelineScreen(),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'SettingsScreen',
              useCases: [
                WidgetbookUseCase(
                  name: 'デフォルト',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const SettingsScreen(),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'FavoritesScreen',
              useCases: [
                WidgetbookUseCase(
                  name: 'お気に入りレースあり',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      nowProvider.overrideWith(
                        (ref) => Stream.value(DateTime.now()),
                      ),
                      favoriteRacesProvider.overrideWith(
                        (ref) => AsyncValue.data([_sampleRace, _plainRace]),
                      ),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const FavoritesScreen(),
                    ),
                  ),
                ),
                WidgetbookUseCase(
                  name: '0件（空状態）',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      nowProvider.overrideWith(
                        (ref) => Stream.value(DateTime.now()),
                      ),
                      favoriteRacesProvider.overrideWith(
                        (ref) => const AsyncValue.data([]),
                      ),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const FavoritesScreen(),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'TripGroupsScreen',
              useCases: [
                WidgetbookUseCase(
                  name: '複数会場グループ',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      tripGroupsProvider.overrideWith((ref) => _tripGroups),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const TripGroupsScreen(),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'TripGroupDetailScreen',
              useCases: [
                WidgetbookUseCase(
                  name: '複数会場グループ（開催日一覧）',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      tripGroupsProvider.overrideWith((ref) => _tripGroups),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const TripGroupDetailScreen(groupId: 'kochi'),
                    ),
                  ),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'WhatsNewScreen',
              useCases: [
                WidgetbookUseCase(
                  name: '更新履歴あり',
                  builder: (context) => ProviderScope(
                    overrides: [
                      sharedPreferencesProvider.overrideWithValue(_prefs),
                      releaseNotesProvider.overrideWith(
                        (ref) async => _releaseNotes,
                      ),
                    ],
                    child: MaterialApp(
                      theme: AppTheme.light(),
                      home: const WhatsNewScreen(),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

/// design-system.md のカラートークン・タイポグラフィ・グレード階層を
/// 目視確認するためのショーケース（Design / Tokens）。
class _DesignTokensShowcase extends StatelessWidget {
  const _DesignTokensShowcase();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'ニュートラル',
              style: AppTypography.sectionLabel.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _Swatch('bg', colors.bg, colors.ink),
                _Swatch('surface', colors.surface, colors.ink),
                _Swatch('surface2', colors.surface2, colors.ink),
                _Swatch('surface3', colors.surface3, colors.ink),
                _Swatch('ink', colors.ink, colors.surface),
                _Swatch('ink2', colors.ink2, colors.surface),
                _Swatch('ink3', colors.ink3, colors.surface),
                _Swatch('line', colors.line, colors.ink),
                _Swatch('brand', colors.brand, Colors.white),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'グレード別カラー（Google Calendar 配色をそのまま踏襲）',
              style: AppTypography.sectionLabel.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _TierSwatch('GⅠ', GoogleCalendarColorKey.blueberry),
                _TierSwatch('JpnⅠ', GoogleCalendarColorKey.lavender),
                _TierSwatch('GⅡ', GoogleCalendarColorKey.tomato),
                _TierSwatch('JpnⅡ', GoogleCalendarColorKey.flamingo),
                _TierSwatch('GⅢ', GoogleCalendarColorKey.basil),
                _TierSwatch('JpnⅢ', GoogleCalendarColorKey.sage),
                _TierSwatch('重賞/Listed', GoogleCalendarColorKey.banana),
                _TierSwatch('オープン', GoogleCalendarColorKey.tangerine),
                _TierSwatch('地方重賞', GoogleCalendarColorKey.grape),
                _TierSwatch('無印', GoogleCalendarColorKey.graphite),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'タイポグラフィ',
              style: AppTypography.sectionLabel.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: 8),
            Text(
              '皐月賞・番組表',
              style: AppTypography.nextRaceName.copyWith(color: colors.ink),
            ),
            Text(
              '4月19日(日)',
              style: AppTypography.appBarDate.copyWith(color: colors.ink),
            ),
            Text(
              '発走時刻順に、競技をまたいで一本化。',
              style: AppTypography.body.copyWith(color: colors.ink),
            ),
            Text(
              '15:40 ・ 11R ・ 芝2,000m ・ GⅠ',
              style: AppTypography.tabular(
                AppTypography.body,
              ).copyWith(color: colors.ink2),
            ),
            Text(
              'あと5分',
              style: AppTypography.countdownSmall.copyWith(
                color: colors.brandInk,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.label, this.bg, this.fg);

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.colors.line2),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(color: fg),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _TierSwatch extends StatelessWidget {
  const _TierSwatch(this.label, this.colorKey);

  final String label;
  final GoogleCalendarColorKey colorKey;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: GoogleCalendarPalette.background[colorKey],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: GoogleCalendarPalette.foreground[colorKey],
        ),
      ),
    );
  }
}
