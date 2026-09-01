import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import type { Farm } from '../types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Gestor',
  FIELD_WORKER: 'Campo',
};

interface FarmSwitcherProps {
  farms: Farm[];
  activeFarm: Farm | null;
  isLoading: boolean;
  isSwitching: boolean;
  onSwitch: (farmId: string) => void;
}

/**
 * Seletor de fazenda no header (item 4 do plano) — mostra o nome da fazenda
 * ativa e o papel efetivo do usuário NELA (RN-03), não o role global.
 * Vira só um rótulo (sem dropdown) quando o usuário tem uma única fazenda.
 */
export function FarmSwitcher({ farms, activeFarm, isLoading, isSwitching, onSwitch }: FarmSwitcherProps) {
  const [open, setOpen] = useState(false);

  if (isLoading || !activeFarm) return null;

  const roleLabel = ROLE_LABELS[activeFarm.role] ?? activeFarm.role;

  if (farms.length <= 1) {
    return (
      <View style={styles.trigger}>
        <View style={styles.labelGroup}>
          <Text style={styles.name} numberOfLines={1}>{activeFarm.farmName}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>
      </View>
    );
  }

  function handleSelect(farmId: string) {
    setOpen(false);
    if (farmId !== activeFarm!.farmId) {
      onSwitch(farmId);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        disabled={isSwitching}
        accessibilityRole="button"
        accessibilityLabel="Trocar de fazenda"
      >
        {isSwitching ? (
          <ActivityIndicator size="small" color="#0ea5e9" />
        ) : (
          <>
            <View style={styles.labelGroup}>
              <Text style={styles.name} numberOfLines={1}>{activeFarm.farmName}</Text>
              <Text style={styles.role}>{roleLabel}</Text>
            </View>
            <Text style={styles.arrow}>▾</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Fazenda</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={farms}
            keyExtractor={(item) => item.farmId}
            renderItem={({ item }) => {
              const isActive = item.farmId === activeFarm.farmId;
              return (
                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item.farmId)}>
                  <View>
                    <Text style={styles.itemName}>{item.farmName}</Text>
                    <Text style={styles.itemRole}>
                      {ROLE_LABELS[item.role] ?? item.role}
                      {item.status === 'INACTIVE' ? ' · inativa' : ''}
                    </Text>
                  </View>
                  {isActive && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  labelGroup: {
    maxWidth: 140,
  },
  name: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  role: {
    color: '#94a3b8',
    fontSize: 11,
  },
  arrow: {
    color: '#94a3b8',
    fontSize: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  itemRole: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  check: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: '700',
  },
});
