import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useCyclesCache } from '../hooks/useCyclesCache';
import type { Cycle } from '../types';

interface CycleSelectorProps {
  pondId: string | null;
  value: Cycle | null;
  onChange: (cycle: Cycle) => void;
  placeholder?: string;
}

const PHASE_LABELS: Record<string, string> = {
  PRE_BERCARIO: 'Pré-berçário',
  BERCARIO: 'Berçário',
  ENGORDA: 'Engorda',
};

export function CycleSelector({ pondId, value, onChange, placeholder = 'Selecionar ciclo' }: CycleSelectorProps) {
  const [open, setOpen] = useState(false);
  const { cycles, isLoading } = useCyclesCache(pondId);

  const handleSelect = (cycle: Cycle) => {
    onChange(cycle);
    setOpen(false);
  };

  const label = value
    ? `${PHASE_LABELS[value.phase] ?? value.phase}${value.daysOfCulture != null ? ` — Dia ${value.daysOfCulture}` : ''}`
    : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, !pondId && styles.triggerDisabled]}
        onPress={() => pondId && setOpen(true)}
        disabled={!pondId}
      >
        <Text style={value ? styles.triggerTextSelected : styles.triggerTextPlaceholder}>
          {!pondId ? 'Selecione um viveiro primeiro' : label}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Ciclo</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#0ea5e9" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={cycles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                  <Text style={styles.itemPhase}>{PHASE_LABELS[item.phase] ?? item.phase}</Text>
                  {item.daysOfCulture != null && (
                    <Text style={styles.itemDays}>Dia {item.daysOfCulture} de cultura</Text>
                  )}
                  {item.supplier && (
                    <Text style={styles.itemDetail}>Fornecedor: {item.supplier}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>Nenhum ciclo ativo para este viveiro</Text>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerTextSelected: {
    color: '#ffffff',
    fontSize: 15,
    flex: 1,
  },
  triggerTextPlaceholder: {
    color: '#64748b',
    fontSize: 15,
    flex: 1,
  },
  arrow: {
    color: '#64748b',
    fontSize: 16,
  },
  modal: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    color: '#94a3b8',
    fontSize: 20,
    padding: 4,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  itemPhase: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDays: {
    color: '#0ea5e9',
    fontSize: 13,
  },
  itemDetail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
