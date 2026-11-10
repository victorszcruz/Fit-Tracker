import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DonutChartCard } from '@/components/dashboard/DonutChartCard';
import { CaloriesProgressCard } from '@/components/dashboard/CaloriesProgressCard';
import { RoutineReviewCard } from '@/components/dashboard/RoutineReviewCard';
import { StatusSyncCard } from '@/components/settings/StatusSyncCard';
import {
  Action,
  Note,
  Panel,
  Screen,
  formStyles,
  useNumberFormat,
} from '@/components/ui/Form';
import { useLanguage } from '@/context/LanguageContext';
import { useLocalData, useTodayKey } from '@/hooks/useLocalData';
import { v2Translations } from '@/i18n/translations';
import { goalsRepository } from '@/repositories/goals.repository';
import { logsRepository } from '@/repositories/logs.repository';
import { routineRepository } from '@/repositories/routine.repository';
import { colors } from '@/theme/tokens';
export default function HomeScreen() {
  const { isPt, language } = useLanguage(),
    t = v2Translations[language],
    f = useNumberFormat(),
    day = useTodayKey();
  const [details, setDetails] = useState(false),
    [error, setError] = useState('');
  const {
    data,
    loading,
    refresh,
    error: loadError,
  } = useLocalData(async () => {
    const [summary, goals, weekly, review, logs, templates, plans] =
      await Promise.all([
        logsRepository.getDailySummary(day),
        goalsRepository.get(),
        logsRepository.getWeeklyConsistency(day),
        routineRepository.overview(day),
        logsRepository.getLogsHistory({ dateKey: day }),
        routineRepository.templates(),
        goalsRepository.plans(),
      ]);
    return { summary, goals, weekly, review, logs, templates, plans };
  });
  useEffect(() => {
    void refresh();
  }, [day, refresh]);
  const s = data?.summary,
    g = data?.goals;
  const coverage = (key: keyof typeof t.nutrients) => {
    const c = s?.nutrients[key];
    if (!c) return '';
    return `${t.nutrients[key]}: ${f(c.total)} · ${c.known}/${c.entries} ${isPt ? 'registros conhecidos' : 'known entries'}${c.complete ? '' : ' · ' + t.partial}`;
  };
  return (
    <Screen title={`${isPt ? 'Hoje' : 'Today'} · ${day}`}>
      <Action
        label={isPt ? 'Configurações e metas' : 'Settings and targets'}
        secondary
        onPress={() => router.push('/(tabs)/settings')}
      />
      <StatusSyncCard />
      {loading && !data && <Note>{isPt ? 'Carregando…' : 'Loading…'}</Note>}
      {(error || loadError) && <Note error>{error || loadError}</Note>}
      {s && g && (
        <>
          <Note>
            {s.foodEntries + s.waterEntries === 0
              ? t.noLogs
              : s.confirmed
                ? t.confirmed
                : t.open}
          </Note>
          <View style={formStyles.row}>
            <DonutChartCard
              label={isPt ? 'Proteína registrada' : 'Logged protein'}
              current={s.protein.consumed}
              goal={g.proteinGoal}
              unit="g"
              formatValue={f}
            />
            <DonutChartCard
              label={t.liquids}
              current={s.water.consumed}
              goal={g.waterGoal}
              unit="mL"
              color={colors.secondary}
              glow="secondary"
              formatValue={f}
            />
          </View>
          <CaloriesProgressCard
            consumed={s.calories.consumed}
            goal={g.caloriesGoal}
          />
          <Note>{coverage('proteinG')}</Note>
          <Note>{coverage('caloriesKcal')}</Note>
          {data!.plans.some(
            (p) => !p.isSynced && p.effectiveFrom <= day && p.ownerId,
          ) && (
            <Note>
              {isPt
                ? 'Plano local pendente de confirmação remota quando a sincronização estiver habilitada.'
                : 'Local plan awaiting remote confirmation when sync is enabled.'}
            </Note>
          )}
          <Panel title={isPt ? 'Macros e fibras' : 'Macros and fiber'}>
            {(['carbG', 'fatG', 'fiberG'] as const).map((k) => (
              <Note
                key={k}
              >{`${coverage(k)} · ${isPt ? 'referência' : 'reference'} ${f(k === 'carbG' ? g.carbGoal : k === 'fatG' ? g.fatGoal : g.fiberGoal)} g`}</Note>
            ))}
            <Action
              label={t.details}
              secondary
              onPress={() => setDetails((v) => !v)}
            />
            {details && (
              <>
                {g.sodiumLimit !== null && (
                  <Note>{`${coverage('sodiumMg')} · ${isPt ? 'limite' : 'limit'} ${f(g.sodiumLimit)} mg`}</Note>
                )}
                {g.saturatedFatLimit !== null && (
                  <Note>{`${coverage('saturatedFatG')} · ${isPt ? 'limite' : 'limit'} ${f(g.saturatedFatLimit)} g`}</Note>
                )}
                <Note>
                  {isPt
                    ? 'Limites são tetos, não quantidades que faltam consumir. Dados parciais não comprovam estar dentro do limite.'
                    : 'Limits are ceilings, not amounts left to consume. Partial data does not establish being within a limit.'}
                </Note>
              </>
            )}
          </Panel>
          <Action
            label={
              isPt
                ? 'Registrar refeição, líquido ou rotina'
                : 'Log food, fluid or routine'
            }
            onPress={() => router.push('/add-log-modal')}
          />
          <Panel title={isPt ? 'Favoritos' : 'Favorites'}>
            {data!.templates.slice(0, 4).map((template) => (
              <Action
                key={template.id}
                label={template.name}
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/add-food',
                    params: { favoriteId: template.id },
                  })
                }
              />
            ))}
            <Action
              label={
                isPt
                  ? 'Abrir favoritos e recentes'
                  : 'Open favorites and recent meals'
              }
              secondary
              onPress={() => router.push('/add-food')}
            />
          </Panel>
          <Panel title={isPt ? 'Registros de hoje' : 'Today’s logs'}>
            {data!.logs.map((l) => (
              <Action
                key={l.id}
                secondary
                label={
                  l.type === 'food'
                    ? `${l.name} · ${f(l.caloriesKcal)} kcal`
                    : `${t.liquids}: ${f(l.amountMl)} mL`
                }
                onPress={() =>
                  router.push({
                    pathname: l.type === 'food' ? '/add-food' : '/add-water',
                    params: { id: l.id },
                  })
                }
              />
            ))}
            {s.foodEntries === 0 && <Note>{t.noLogs}</Note>}
            <Action
              label={
                s.confirmed
                  ? isPt
                    ? 'Reabrir dia'
                    : 'Reopen day'
                  : isPt
                    ? 'Confirmar registro alimentar do dia'
                    : 'Confirm daily food log'
              }
              secondary
              onPress={() => {
                void routineRepository
                  .checkin(day, !s.confirmed)
                  .catch((e) => setError(e.message));
              }}
            />
            <Action
              label={isPt ? 'Ver histórico completo' : 'Open full history'}
              secondary
              onPress={() => router.push('/(tabs)/history')}
            />
          </Panel>
          {g.creatineGoal !== null && (
            <Panel title={isPt ? 'Creatina opcional' : 'Optional creatine'}>
              <Note>{`${f(data!.review.creatine.filter((c) => c.dateKey === day).reduce((n, c) => n + c.doseG, 0))} g ${isPt ? 'registrados · referência' : 'logged · reference'} ${f(g.creatineGoal)} g`}</Note>
              <Action
                label={isPt ? 'Registrar dose' : 'Log dose'}
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/add-routine',
                    params: { kind: 'creatine' },
                  })
                }
              />
            </Panel>
          )}
          <Panel
            title={
              isPt
                ? 'Regularidade de registro · 7 dias'
                : 'Logging regularity · 7 days'
            }
          >
            {data!.weekly.days.map((d) => (
              <Note
                key={d.dateKey}
              >{`${d.dateKey} · ${d.confirmed ? t.confirmed : d.hasLogs ? t.open : t.noLogs}`}</Note>
            ))}
          </Panel>
          <RoutineReviewCard data={data!.review} />
        </>
      )}
    </Screen>
  );
}
