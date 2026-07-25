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
import { useUsersCache } from '../hooks/useUsersCache';
import type { User } from '../types';

interface ResponsibleSelectorProps {
  value: User | null;
  onChange: (user: User) => void;
  recentIds?: string[];
  placeholder?: string;
}

export function ResponsibleSelector({
  value,
  onChange,
  recentIds = [],
  placeholder = 'Selecionar responsável',
}: ResponsibleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { users } = useUsersCache();

  const sorted = useMemo(() => {
    const recent = users.filter((u) => recentIds.includes(u.id));
    const rest = users.filter((u) => !recentIds.includes(u.id));
    return [...recent, ...rest];
  }, [users, recentIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((u) => u.name.toLowerCase().includes(q));
  }, [sorted, search]);

  const handleSelect = (user: User) => {
    onChange(user);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={value ? styles.triggerTextSelected : styles.triggerTextPlaceholder}>
          {value ? value.name : placeholder}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Responsável</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Buscar por nome..."
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemRole}>{item.role}</Text>
                </View>
                {recentIds.includes(item.id) && (
                  <Text style={styles.recentBadge}>Recente</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Nenhum usuário encontrado</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
  },
  itemRole: {
    color: '#64748b',
    fontSize: 12,
  },
  recentBadge: {
    marginLeft: 'auto',
    color: '#0ea5e9',
    fontSize: 11,
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
