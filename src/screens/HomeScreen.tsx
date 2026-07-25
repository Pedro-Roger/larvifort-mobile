import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { useCyclesCache } from '../hooks/useCyclesCache';
import { useSync } from '../hooks/useSync';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { Cycle } from '../types';

type HomeNav = NativeStackNavigationProp<AppStackParamList, 'Home'>;

const PHASE_LABELS: Record<string, string> = {
  PRE_BERCARIO: 'Pré-berçário',
  BERCARIO: 'Berçário',
  ENGORDA: 'Engorda',
};

function groupByPond(cycles: Cycle[]) {
  const map = new Map<string, { title: string; pondCode: string; data: Cycle[] }>();

  for (const c of cycles) {
    const key = c.pondId;
    if (!map.has(key)) {
      map.set(key, {
        title: c.pondName ?? c.pondId,
        pondCode: c.pondCode ?? '',
        data: [],
      });
    }
    map.get(key)!.data.push(c);
  }

  return Array.from(map.values());
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { cycles, isLoading, reload } = useCyclesCache();
  const { syncNow, isSyncing } = useSync();

  const handleRefresh = useCallback(async () => {
    await syncNow();
    await reload();
  }, [syncNow, reload]);

  const sections = groupByPond(cycles);

  const navigateToForm = useCallback(() => {
    navigation.navigate('WaterQualityForm', undefined);
  }, [navigation]);

  const navigateToBiometricForm = useCallback(() => {
    navigation.navigate('BiometricForm', undefined);
  }, [navigation]);

  const navigateToFeedingForm = useCallback(() => {
    navigation.navigate('FeedingForm', undefined);
  }, [navigation]);

  const navigateToOutbox = useCallback(() => {
    navigation.navigate('Outbox');
  }, [navigation]);

  const renderCycleItem = useCallback(({ item }: { item: Cycle }) => (
    <View style={styles.cycleItem}>
      <View style={styles.cycleLeft}>
        <Text style={styles.cyclePhase}>{PHASE_LABELS[item.phase] ?? item.phase}</Text>
        {item.supplier && (
          <Text style={styles.cycleSupplier}>{item.supplier}</Text>
        )}
      </View>
      {item.daysOfCulture != null && (
        <View style={styles.daysBadge}>
          <Text style={styles.daysNumber}>{item.daysOfCulture}</Text>
          <Text style={styles.daysLabel}>dias</Text>
        </View>
      )}
    </View>
  ), []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; pondCode: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.pondCode}>{section.pondCode}</Text>
        <Text style={styles.pondName}>{section.title}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <SyncStatusBar />

      {/* Header actions */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Ciclos Ativos</Text>
        <TouchableOpacity onPress={navigateToOutbox} style={styles.outboxBtn}>
          <Text style={styles.outboxBtnText}>Fila ›</Text>
        </TouchableOpacity>
      </View>

      {sections.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🌊</Text>
          <Text style={styles.emptyTitle}>Nenhum ciclo ativo</Text>
          <Text style={styles.emptySubtitle}>Sincronize para carregar os dados</Text>
          <TouchableOpacity style={styles.syncBtnLarge} onPress={handleRefresh}>
            <Text style={styles.syncBtnText}>Sincronizar agora</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderCycleItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading || isSyncing}
              onRefresh={handleRefresh}
              tintColor="#0ea5e9"
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Feeding sits closest to the thumb: it is what the field records most. */}
      <TouchableOpacity style={[styles.fab, styles.fabWater]} onPress={navigateToForm}>
        <Text style={styles.fabIcon}>💧</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fab, styles.fabBiometric]} onPress={navigateToBiometricForm}>
        <Text style={styles.fabIcon}>⚖</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fab, styles.fabFeeding]} onPress={navigateToFeedingForm}>
        <Text style={styles.fabLabel}>Trato</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  heading: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  outboxBtn: {
    padding: 4,
  },
  outboxBtnText: {
    color: '#0ea5e9',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  pondCode: {
    color: '#0ea5e9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pondName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cycleItem: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cycleLeft: {
    flex: 1,
  },
  cyclePhase: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  cycleSupplier: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  daysBadge: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  daysNumber: {
    color: '#0ea5e9',
    fontSize: 20,
    fontWeight: '700',
  },
  daysLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  syncBtnLarge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  syncBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabBiometric: {
    bottom: 104,
    backgroundColor: '#0f766e',
    shadowColor: '#0f766e',
  },
  fabWater: {
    bottom: 176,
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
  },
  /** Primary action: wider, so the label fits and the thumb finds it first. */
  fabFeeding: {
    bottom: 28,
    width: 96,
    borderRadius: 30,
    backgroundColor: '#0ea5e9',
    shadowColor: '#0ea5e9',
  },
  fabLabel: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  fabIcon: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
});
