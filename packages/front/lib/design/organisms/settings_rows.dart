import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import '../atoms/pill.dart';
import '../atoms/surface_card.dart';
import '../atoms/tappable_card.dart';

/// 設定画面のグループ（カード＋見出し、screens.md §5）。
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({required this.title, required this.children, super.key});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: title,
      child: SurfaceCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 11, 14, 3),
              child: Text(
                title,
                style: AppTypography.sectionLabel.copyWith(color: colors.ink3),
              ),
            ),
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0)
                Divider(
                  height: 1,
                  color: colors.line,
                  indent: 14,
                  endIndent: 14,
                ),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}

/// トグル1行（例: 通知を受け取る、対象の公営競技）。
class SettingsToggleRow extends StatelessWidget {
  const SettingsToggleRow({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
    super.key,
  });

  final String icon;
  final String title;
  final String? subtitle;
  final bool value;
  // QCOPY-02: null を渡すと行全体を操作不能（トグル無効・タップ無反応）にする。
  // 「準備中」等、値の永続化・反映先が無い機能をUI上だけ先出しする場合に使う。
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onChanged != null;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: InkWell(
        onTap: enabled ? () => onChanged!(!value) : null,
        child: MergeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Row(
              children: [
                _IconBadge(icon: icon),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.ink,
                        ),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Text(
                            subtitle!,
                            style: AppTypography.caption.copyWith(
                              color: colors.ink3,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Switch(value: value, onChanged: onChanged),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 数値ステッパー1行（例: 通知タイミング）。
class SettingsStepperRow extends StatelessWidget {
  const SettingsStepperRow({
    required this.icon,
    required this.title,
    required this.valueLabel,
    required this.onDecrement,
    required this.onIncrement,
    this.subtitle,
    super.key,
  });

  final String icon;
  final String title;
  final String? subtitle;
  final String valueLabel;
  // QSET-01: 上下限に達した側は null を渡す。`setXxx`側は`clamp()`で
  // 黙って丸めるだけのため、そのままでは上限で「＋」を押しても値が変わらず
  // 故障のように見え、無駄な永続化書き込みも発生していた。
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        children: [
          _IconBadge(icon: icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.bodySmall.copyWith(color: colors.ink),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: AppTypography.caption.copyWith(color: colors.ink3),
                  ),
              ],
            ),
          ),
          _StepperButton(icon: Icons.remove, label: '減らす', onTap: onDecrement),
          SizedBox(
            width: 60,
            child: Text(
              valueLabel,
              textAlign: TextAlign.center,
              style: AppTypography.tabular(
                AppTypography.bodySmall,
              ).copyWith(color: colors.ink, fontWeight: FontWeight.w700),
            ),
          ),
          _StepperButton(icon: Icons.add, label: '増やす', onTap: onIncrement),
        ],
      ),
    );
  }
}

/// セグメント選択1行（例: テーマ 自動／明／暗）。
class SettingsSegmentRow extends StatelessWidget {
  const SettingsSegmentRow({
    required this.icon,
    required this.title,
    required this.options,
    required this.selectedIndex,
    required this.onSelect,
    super.key,
  });

  final String icon;
  final String title;
  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        children: [
          _IconBadge(icon: icon),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: AppTypography.bodySmall.copyWith(color: colors.ink),
            ),
          ),
          Pill(
            backgroundColor: colors.surface2,
            borderRadius: 9,
            padding: const EdgeInsets.all(2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < options.length; i++)
                  Semantics(
                    button: true,
                    selected: i == selectedIndex,
                    label: options[i],
                    child: TappableCard(
                      borderRadius: 7,
                      color: i == selectedIndex ? colors.surface : null,
                      onTap: () => onSelect(i),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      child: Text(
                        options[i],
                        style: AppTypography.caption.copyWith(
                          color: i == selectedIndex ? colors.ink : colors.ink2,
                          fontWeight: i == selectedIndex
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// タップで実行するアクション1行（例: テスト通知を送信）。
class SettingsActionRow extends StatelessWidget {
  const SettingsActionRow({
    required this.icon,
    required this.title,
    required this.actionLabel,
    required this.onTap,
    this.subtitle,
    this.enabled = true,
    super.key,
  });

  final String icon;
  final String title;
  final String? subtitle;
  final String actionLabel;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final semanticLabel = [
      title,
      if (subtitle != null && subtitle!.isNotEmpty) subtitle!,
      actionLabel,
    ].join('、');

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel,
      excludeSemantics: true,
      onTap: enabled ? onTap : null,
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Row(
            children: [
              _IconBadge(icon: icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.ink,
                      ),
                    ),
                    if (subtitle != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          subtitle!,
                          style: AppTypography.caption.copyWith(
                            color: colors.ink3,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                actionLabel,
                style: AppTypography.caption.copyWith(
                  color: enabled ? colors.ink2 : colors.ink3,
                  fontWeight: FontWeight.w700,
                ),
              ),
              // QSET-08: SettingsValueRow（読み取り専用）と視覚的に似ており
              // 押せるかどうか分かりにくかったため、タップ可能であることを示す
              // シェブロンを付与する。
              const SizedBox(width: 2),
              ExcludeSemantics(
                child: Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: enabled ? colors.ink3 : colors.line2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 読み取り専用の値表示1行（例: 既定フィルタの説明）。
///
/// [onTap] を渡すとタップ可能になり、値の隣にコピーアイコンを表示する
/// （QSUP-04: バージョン文字列のタップコピー用。値そのものをどうするかは
/// 呼び出し側に委ねる、汎用のタップ領域として提供する）。
class SettingsValueRow extends StatelessWidget {
  const SettingsValueRow({
    required this.icon,
    required this.title,
    required this.value,
    this.subtitle,
    this.onTap,
    super.key,
  });

  final String icon;
  final String title;
  final String? subtitle;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        children: [
          _IconBadge(icon: icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.bodySmall.copyWith(color: colors.ink),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: AppTypography.caption.copyWith(color: colors.ink3),
                  ),
              ],
            ),
          ),
          Text(
            value,
            style: AppTypography.caption.copyWith(color: colors.ink2),
          ),
          if (onTap != null) ...[
            const SizedBox(width: 6),
            ExcludeSemantics(
              child: Icon(Icons.copy, size: 14, color: colors.ink3),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return content;
    return InkWell(onTap: onTap, child: content);
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon});

  final String icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pill(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      backgroundColor: colors.surface2,
      borderRadius: 8,
      padding: EdgeInsets.zero,
      child: ExcludeSemantics(
        child: Text(icon, style: const TextStyle(fontSize: 15)),
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onTap != null;
    return Semantics(
      button: true,
      label: label,
      enabled: enabled,
      child: TappableCard(
        borderRadius: 8,
        border: Border.all(color: enabled ? colors.line2 : colors.line),
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(
            icon,
            size: 14,
            color: enabled ? colors.ink : colors.ink3,
          ),
        ),
      ),
    );
  }
}
