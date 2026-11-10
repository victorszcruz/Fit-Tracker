import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Database,
  RefreshCw,
} from 'lucide-react-native';

import { Typography } from '@/components/ui/Typography';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/i18n/translations';
import { syncEngine, type SyncState } from '@/sync/sync.service';
import { colors, radii, spacing } from '@/theme/tokens';

export interface StatusSyncCardProps {
  isPt?: boolean;
}

type SyncVisualMode =
  'local_only' | 'offline' | 'syncing' | 'error' | 'pending' | 'synced';

export function StatusSyncCard({ isPt: propIsPt }: StatusSyncCardProps) {
  const { t: contextT, isPt: contextIsPt } = useLanguage();
  const isPt = propIsPt ?? contextIsPt;
  const t =
    propIsPt !== undefined
      ? isPt
        ? translations.pt
        : translations.en
      : contextT;

  const [syncState, setSyncState] = useState<SyncState>(() =>
    syncEngine.getState(),
  );

  // Rhythmic pulse for the status dot
  const [pulseAnim] = useState(() => new Animated.Value(0.4));
  // Spin animation for the refresh icon
  const [spinAnim] = useState(() => new Animated.Value(0));

  // Subscribe to real-time sync engine events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // Continuous pulse loop
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Spin loop when actively syncing
  useEffect(() => {
    if (syncState.isSyncing) {
      const spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.start();
      return () => {
        spinLoop.stop();
        spinAnim.setValue(0);
      };
    } else {
      spinAnim.setValue(0);
    }
  }, [syncState.isSyncing, spinAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Determine current visual mode
  const mode: SyncVisualMode = useMemo(() => {
    if (!syncState.isEnabled) return 'local_only';
    if (!syncState.isOnline) return 'offline';
    if (syncState.isSyncing) return 'syncing';
    if (
      syncState.conflicts > 0 ||
      syncState.pending > 0 ||
      !syncState.lastResult
    )
      return 'pending';
    if (!syncState.lastResult.ok) return 'error';
    return 'synced';
  }, [syncState]);

  // Visual tokens according to active status
  const visualConfig = useMemo(() => {
    switch (mode) {
      case 'syncing':
        return {
          accentColor: colors.secondary, // cyan
          badgeBg: 'rgba(76, 215, 246, 0.12)',
          badgeBorder: 'rgba(76, 215, 246, 0.28)',
          badgeText: t.settings.syncStatusSyncing,
          description: t.settings.syncDescSyncing,
          Icon: RefreshCw,
        };
      case 'pending':
        return {
          accentColor: colors.outline,
          badgeBg: colors.surfaceHigh,
          badgeBorder: colors.strokeCrisp,
          badgeText: isPt ? 'Pendente' : 'Pending',
          description: isPt
            ? `${syncState.pending} alterações locais; ${syncState.conflicts} conflitos. Salvo no aparelho não significa copiado para a nuvem.`
            : `${syncState.pending} local changes; ${syncState.conflicts} conflicts. Saved locally does not mean copied to the cloud.`,
          Icon: Database,
        };
      case 'offline':
        return {
          accentColor: '#f59e0b', // amber
          badgeBg: 'rgba(245, 158, 11, 0.12)',
          badgeBorder: 'rgba(245, 158, 11, 0.28)',
          badgeText: t.settings.syncStatusOffline,
          description: t.settings.syncDescOffline,
          Icon: CloudOff,
        };
      case 'local_only':
        return {
          accentColor: colors.outline, // slate neutral
          badgeBg: 'rgba(134, 148, 138, 0.12)',
          badgeBorder: 'rgba(134, 148, 138, 0.25)',
          badgeText: t.settings.syncStatusLocalOnly,
          description: t.settings.syncDescLocalOnly,
          Icon: Database,
        };
      case 'error':
        return {
          accentColor: colors.error, // soft red
          badgeBg: 'rgba(255, 180, 171, 0.12)',
          badgeBorder: 'rgba(255, 180, 171, 0.28)',
          badgeText: t.settings.syncStatusError,
          description:
            syncState.lastResult?.error === 'offline'
              ? t.settings.syncDescOffline
              : t.settings.syncDescError,
          Icon: AlertCircle,
        };
      case 'synced':
      default:
        return {
          accentColor: colors.primary, // emerald
          badgeBg: 'rgba(78, 222, 163, 0.12)',
          badgeBorder: 'rgba(78, 222, 163, 0.28)',
          badgeText: t.settings.syncStatusSynced,
          description: t.settings.syncDescSynced,
          Icon: CheckCircle2,
        };
    }
  }, [
    mode,
    t,
    syncState.lastResult,
    syncState.pending,
    syncState.conflicts,
    isPt,
  ]);

  // Formatted last sync time string
  const formattedLastSync = useMemo(() => {
    const isoString = syncState.lastResult?.ok
      ? syncState.lastResult.finishedAt
      : null;
    if (!isoString) return t.settings.syncNever;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return t.settings.syncNever;

      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      if (isToday) {
        return timeStr;
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month} ${timeStr}`;
    } catch {
      return t.settings.syncNever;
    }
  }, [syncState.lastResult, t]);

  const handleManualSync = () => {
    if (!syncState.isEnabled || syncState.isSyncing || !syncState.isOnline)
      return;
    void syncEngine.syncNow();
  };

  const canTriggerSync =
    syncState.isEnabled && syncState.isOnline && !syncState.isSyncing;

  const StatusIcon = visualConfig.Icon;

  return (
    <View style={styles.cardContainer}>
      {/* Linha Superior: Cabeçalho com Ícone e Badge de Status */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: visualConfig.badgeBg,
                borderColor: visualConfig.badgeBorder,
              },
            ]}
          >
            <StatusIcon size={16} color={visualConfig.accentColor} />
          </View>
          <Typography
            variant="labelSm"
            color={colors.onSurface}
            style={styles.title}
          >
            {t.settings.syncStatusTitle}
          </Typography>
        </View>

        {/* Badge do Status Dinâmico com Ponto Pulsante */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: visualConfig.badgeBg,
              borderColor: visualConfig.badgeBorder,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: visualConfig.accentColor,
                opacity: pulseAnim,
              },
            ]}
          />
          <Typography
            variant="unitCaption"
            style={[
              styles.statusBadgeText,
              { color: visualConfig.accentColor },
            ]}
          >
            {visualConfig.badgeText}
          </Typography>
        </View>
      </View>

      {/* Descrição contextual explicativa */}
      <Typography
        variant="labelSm"
        color={colors.onSurfaceVariant}
        style={styles.description}
      >
        {visualConfig.description}
      </Typography>

      {/* Linha Inferior: Telemetria de Última Sincronização e Ação Manual */}
      <View style={styles.footerRow}>
        <Typography
          variant="unitCaption"
          color={colors.outline}
          style={styles.timestampText}
        >
          {t.settings.syncLastSynced(formattedLastSync)}
        </Typography>

        {syncState.isEnabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.settings.syncTapToSync}
            disabled={!canTriggerSync}
            onPress={handleManualSync}
            style={({ pressed }) => [
              styles.syncButton,
              pressed && canTriggerSync && styles.syncButtonPressed,
              !canTriggerSync && styles.syncButtonDisabled,
            ]}
          >
            <Animated.View
              style={
                syncState.isSyncing
                  ? { transform: [{ rotate: spinInterpolation }] }
                  : undefined
              }
            >
              <RefreshCw
                size={13}
                color={canTriggerSync ? colors.primary : colors.outlineVariant}
              />
            </Animated.View>
            <Typography
              variant="unitCaption"
              color={canTriggerSync ? colors.primary : colors.outlineVariant}
              style={styles.syncButtonText}
            >
              {syncState.isSyncing
                ? t.settings.syncStatusSyncing
                : t.settings.syncTapToSync}
            </Typography>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.strokeCrisp,
    gap: spacing.sm + 2,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexBasis: '100%',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontWeight: '700',
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    maxWidth: '100%',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    flexShrink: 1,
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  description: {
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.strokeSubtle,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timestampText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(78, 222, 163, 0.08)',
  },
  syncButtonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(78, 222, 163, 0.16)',
  },
  syncButtonDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
