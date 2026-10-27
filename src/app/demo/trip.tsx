import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/solar/app-button';
import { AppCard } from '@/components/solar/app-card';
import { CurrencyAmount } from '@/components/solar/currency-amount';
import { DemoNotice, DemoTag } from '@/components/solar/demo-notice';
import { ParticipantAvatar } from '@/components/solar/participant-avatar';
import { PhotoPlaceholder } from '@/components/solar/photo-placeholder';
import { ProgressBar } from '@/components/solar/progress-bar';
import { SectionHeader } from '@/components/solar/section-header';
import { SegmentedControl } from '@/components/solar/segmented-control';
import { SolarScreen } from '@/components/solar/solar-screen';
import { SolarText } from '@/components/solar/solar-text';
import { TextField } from '@/components/solar/text-field';
import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';
import {
  DemoExpenses,
  DemoParticipants,
  DemoTrip,
  DemoTripDays,
  StopKindIcons,
  formatDay,
  type Participant,
  type Role,
  type TripDay,
} from '@/data/demo/georgia-trip';
import { formatMoney, newId } from '@/utils/money';

const TABS = ['Маршрут', 'Карта', 'Участники', 'Расходы', 'Документы'] as const;
type Tab = (typeof TABS)[number];

const RoleLabels: Record<Role, string> = { organizer: 'Организатор', member: 'Участник' };

export default function TripScreen() {
  const [tab, setTab] = useState<Tab>('Маршрут');
  const [participants, setParticipants] = useState<Participant[]>(DemoParticipants);
  const [days, setDays] = useState<TripDay[]>(DemoTripDays);
  const [inviteOpen, setInviteOpen] = useState(false);

  const addStop = (date: string) =>
    setDays((cur) =>
      cur.map((d) =>
        d.date === date
          ? {
              ...d,
              stops: [
                ...d.stops,
                { id: newId('stop'), time: '—', title: 'Новое место', kind: 'sight', duration: 'время уточнить' },
              ],
            }
          : d,
      ),
    );

  const openInvite = () => {
    setInviteOpen(true);
    setTab('Участники');
  };

  return (
    <SolarScreen>
      <AppCard padded={false}>
        <PhotoPlaceholder emoji={DemoTrip.flag} height={170} />
        <View style={styles.heroBody}>
          <SolarText variant="title" numberOfLines={2}>
            {DemoTrip.title}
          </SolarText>
          <SolarText secondary>
            {DemoTrip.flag} {DemoTrip.countryName} · {formatDay(DemoTrip.startDate)} — {formatDay(DemoTrip.endDate)} 2027
          </SolarText>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <SolarText variant="caption" secondary>
                Общий бюджет
              </SolarText>
              <View style={styles.inline}>
                <CurrencyAmount amount={DemoTrip.budgetRub} currency="RUB" />
                <DemoTag />
              </View>
            </View>
            <View style={styles.stat}>
              <SolarText variant="caption" secondary>
                Участники · {participants.length}
              </SolarText>
              <AvatarStack participants={participants} />
            </View>
          </View>

          <AppButton title="Пригласить участника" onPress={openInvite} />
        </View>
      </AppCard>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBleed}
        contentContainerStyle={styles.tabs}>
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(t)}
              style={[styles.tab, active && styles.tabActive]}>
              <SolarText variant={active ? 'captionStrong' : 'caption'}>{t}</SolarText>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'Маршрут' && <RouteTab days={days} onAddStop={addStop} />}
      {tab === 'Карта' && <MapTab days={days} />}
      {tab === 'Участники' && (
        <ParticipantsTab
          participants={participants}
          inviteOpen={inviteOpen}
          onToggleInvite={setInviteOpen}
          onAdd={(p) => {
            setParticipants((cur) => [...cur, p]);
            setInviteOpen(false);
          }}
        />
      )}
      {tab === 'Расходы' && <ExpensesTab />}
      {tab === 'Документы' && <DocumentsTab />}
    </SolarScreen>
  );
}

function AvatarStack({ participants }: { participants: Participant[] }) {
  const shown = participants.slice(0, 4);
  const rest = participants.length - shown.length;
  return (
    <View style={styles.avatarStack}>
      {shown.map((p, i) => (
        <View key={p.id} style={i > 0 && styles.overlap}>
          <ParticipantAvatar name={p.name} index={i} size={34} outlined />
        </View>
      ))}
      {rest > 0 && (
        <SolarText variant="captionStrong" style={styles.more}>
          +{rest}
        </SolarText>
      )}
    </View>
  );
}

function RouteTab({ days, onAddStop }: { days: TripDay[]; onAddStop: (date: string) => void }) {
  return (
    <View style={styles.tabContent}>
      {days.map((day, i) => (
        <AppCard key={day.date}>
          <SectionHeader
            title={`День ${i + 1}`}
            subtitle={formatDay(day.date, true)}
            actionLabel="+ Место"
            onAction={() => onAddStop(day.date)}
          />
          {day.stops.length === 0 ? (
            <SolarText variant="caption" secondary>
              Пока нет мест — добавьте первое
            </SolarText>
          ) : (
            day.stops.map((stop) => (
              <View key={stop.id} style={styles.stop}>
                <SolarText variant="captionStrong" style={styles.stopTime}>
                  {stop.time}
                </SolarText>
                <View style={styles.stopIcon}>
                  <Text style={styles.stopEmoji}>{StopKindIcons[stop.kind]}</Text>
                </View>
                <View style={styles.stopText}>
                  <SolarText variant="bodyStrong" numberOfLines={2}>
                    {stop.title}
                  </SolarText>
                  <SolarText variant="caption" secondary>
                    {stop.duration}
                    {stop.note ? ` · ${stop.note}` : ''}
                  </SolarText>
                </View>
              </View>
            ))
          )}
        </AppCard>
      ))}
      <AppButton
        title="+ Добавить место"
        variant="secondary"
        onPress={() => onAddStop(days[0].date)}
      />
    </View>
  );
}

function MapTab({ days }: { days: TripDay[] }) {
  const stops = days.reduce((n, d) => n + d.stops.length, 0);
  return (
    <View style={styles.tabContent}>
      <AppCard tone="sky" style={styles.placeholder}>
        <Text style={styles.placeholderEmoji}>🗺️</Text>
        <SolarText variant="bodyStrong">Карта маршрута</SolarText>
        <SolarText variant="caption" secondary style={styles.center}>
          Здесь будут {stops} точек маршрута на офлайн-карте. Появится на следующем этапе.
        </SolarText>
      </AppCard>
    </View>
  );
}

function ParticipantsTab({
  participants,
  inviteOpen,
  onToggleInvite,
  onAdd,
}: {
  participants: Participant[];
  inviteOpen: boolean;
  onToggleInvite: (open: boolean) => void;
  onAdd: (p: Participant) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');
  const organizers = participants.filter((p) => p.role === 'organizer').length;

  return (
    <View style={styles.tabContent}>
      <SectionHeader
        title="Компания"
        subtitle={`${participants.length} чел.: организаторов ${organizers}, участников ${participants.length - organizers}`}
        actionLabel={inviteOpen ? undefined : '+ Добавить'}
        onAction={() => onToggleInvite(true)}
      />

      {inviteOpen && (
        <AppCard tone="sky">
          <SolarText variant="bodyStrong">Новый участник</SolarText>
          <TextField value={name} onChangeText={setName} placeholder="Имя" autoFocus />
          <SegmentedControl
            options={[
              { value: 'member', label: RoleLabels.member },
              { value: 'organizer', label: RoleLabels.organizer },
            ]}
            value={role}
            onChange={setRole}
          />
          <SolarText variant="caption" secondary>
            Прототип: участник добавится только на этом экране, приглашение не отправляется.
          </SolarText>
          <View style={styles.inline}>
            <AppButton title="Отмена" variant="ghost" compact style={styles.flex} onPress={() => onToggleInvite(false)} />
            <AppButton
              title="Добавить"
              compact
              style={styles.flex}
              disabled={!name.trim()}
              onPress={() => {
                onAdd({ id: newId('p'), name: name.trim(), role });
                setName('');
                setRole('member');
              }}
            />
          </View>
        </AppCard>
      )}

      <AppCard>
        {participants.map((p, i) => (
          <View key={p.id} style={[styles.person, i > 0 && styles.divider]}>
            <ParticipantAvatar name={p.name} index={i} />
            <View style={styles.flex}>
              <SolarText variant="bodyStrong" numberOfLines={1}>
                {p.name}
                {p.isMe ? ' (вы)' : ''}
              </SolarText>
            </View>
            <View style={[styles.rolePill, p.role === 'organizer' ? styles.roleOrganizer : styles.roleMember]}>
              <SolarText variant="captionStrong">{RoleLabels[p.role]}</SolarText>
            </View>
          </View>
        ))}
      </AppCard>
    </View>
  );
}

function ExpensesTab() {
  const totalGel = DemoExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRub = DemoExpenses.reduce((s, e) => s + e.amount * e.rateRub, 0);
  return (
    <View style={styles.tabContent}>
      <AppCard tone="navy">
        <SolarText variant="caption" color={Solar.sky}>
          Потрачено · демо
        </SolarText>
        <CurrencyAmount
          amount={totalGel}
          currency="GEL"
          converted={{ amount: totalRub, currency: 'RUB' }}
          size="large"
          color={Solar.white}
        />
        <ProgressBar value={totalRub / DemoTrip.budgetRub} trackColor="rgba(216, 238, 244, 0.25)" />
        <SolarText variant="caption" color={Solar.sky}>
          из бюджета {formatMoney(DemoTrip.budgetRub, 'RUB')}
        </SolarText>
      </AppCard>
      <AppButton title="Открыть расходы" onPress={() => router.push('/demo/expenses')} />
    </View>
  );
}

const documents = [
  { icon: '🛂', title: 'Загранпаспорта', status: '3 из 3 добавлены' },
  { icon: '🛡️', title: 'Страховки', status: '1 из 3 добавлена' },
  { icon: '✈️', title: 'Билеты', status: 'Не добавлены' },
  { icon: '🏨', title: 'Брони жилья', status: '1 бронь' },
];

function DocumentsTab() {
  return (
    <View style={styles.tabContent}>
      <DemoNotice text="Загрузка и хранение документов появятся позже. Статусы ниже — пример." />
      <AppCard>
        {documents.map((d, i) => (
          <View key={d.title} style={[styles.person, i > 0 && styles.divider]}>
            <View style={styles.stopIcon}>
              <Text style={styles.stopEmoji}>{d.icon}</Text>
            </View>
            <View style={styles.flex}>
              <SolarText variant="bodyStrong">{d.title}</SolarText>
              <SolarText variant="caption" secondary>
                {d.status}
              </SolarText>
            </View>
            <SolarText variant="heading" color={Solar.navySecondary}>
              ›
            </SolarText>
          </View>
        ))}
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.s,
  },
  heroBody: {
    padding: SolarSpace.m,
    gap: SolarSpace.s,
  },
  stats: {
    flexDirection: 'row',
    gap: SolarSpace.s,
    marginVertical: SolarSpace.s,
  },
  stat: {
    flex: 1,
    backgroundColor: Solar.ice,
    borderRadius: SolarRadius.button,
    padding: SolarSpace.m - 4,
    gap: SolarSpace.xs,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlap: {
    marginLeft: -10,
  },
  more: {
    marginLeft: SolarSpace.xs,
  },
  tabsBleed: {
    marginHorizontal: -SolarSpace.m,
  },
  tabs: {
    gap: SolarSpace.s,
    paddingHorizontal: SolarSpace.m,
  },
  tab: {
    minHeight: SolarSize.touch,
    paddingHorizontal: SolarSpace.m,
    borderRadius: SolarRadius.pill,
    justifyContent: 'center',
    backgroundColor: Solar.white,
  },
  tabActive: {
    backgroundColor: Solar.orange,
  },
  tabContent: {
    gap: SolarSpace.m,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.s + 2,
    backgroundColor: Solar.ice,
    borderRadius: SolarRadius.button,
    padding: SolarSpace.s + 2,
  },
  stopTime: {
    width: 42,
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Solar.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopEmoji: {
    fontSize: 18,
  },
  stopText: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: SolarSpace.xl,
  },
  placeholderEmoji: {
    fontSize: 44,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.m - 4,
    paddingVertical: SolarSpace.s,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: Solar.navyLine,
  },
  rolePill: {
    borderRadius: SolarRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleOrganizer: {
    backgroundColor: Solar.orange,
  },
  roleMember: {
    backgroundColor: Solar.sky,
  },
});
