import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { usePondsCache } from '../hooks/usePondsCache';
import type { Pond } from '../types';

interface PondSelectorProps {
  value: Pond | null;
  onChange: (pond: Pond) => void;
  placeholder?: string;
}

export function PondSelector({ value, onChange, placeholder = 'Selecionar viveiro' }: PondSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { ponds } = usePondsCache();

  const filtered = useMemo(() => {
    if (!search.trim()) return ponds;
    const q = search.toLowerCase();
    return ponds.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [ponds, search]);

  const handleSelect = (pond: Pond) => {
    onChange(pond);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={value ? styles.triggerTextSelected : styles.triggerTextPlaceholder}>
          {value ? `${value.code} — ${value.name}` : placeholder}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Viveiro</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Buscar por código ou nome..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                <Text style={styles.itemCode}>{item.code}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.areaHa && (
                  <Text style={styles.itemDetail}>{item.areaHa} ha</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Nenhum viveiro encontrado</Text>
            }
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
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
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
  search: {
    backgroundColor: '#1e293b',
    margin: 16,
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  itemCode: {
    color: '#0ea5e9',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
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
