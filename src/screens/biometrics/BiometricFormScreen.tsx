import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PondSelector } from '../../components/PondSelector';
import { CycleSelector } from '../../components/CycleSelector';
import { ResponsibleSelector } from '../../components/ResponsibleSelector';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import { saveOfflineBiometric } from '../../services/biometric.service';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { Pond, Cycle, User } from '../../types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'BiometricForm'>;

export function BiometricFormScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { syncNow } = useSync();

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    user ? { id: user.id, name: user.name, role: user.role, active: true, updatedAt: '' } : null,
  );
  const [sampleCount, setSampleCount] = useState('');
  const [averageWeightG, setAverageWeightG] = useState('');
  const [survivalRatePct, setSurvivalRatePct] = useState('');
  const [saving, setSaving] = useState(false);

  const doSave = useCallback(async () => {
    if (!selectedCycle) return;
    const measuredAt = new Date().toISOString();
    const resp = selectedUser ?? (user ? { id: user.id, name: user.name } : null);
    if (!resp) return;

    setSaving(true);
    try {
      await saveOfflineBiometric({
        cycleId: selectedCycle.id,
        measuredAt,
        sampleCount: Number(sampleCount),
        averageWeightG: Number(averageWeightG.replace(',', '.')),
        survivalRatePct: survivalRatePct ? Number(survivalRatePct.replace(',', '.')) : undefined,
        responsibleId: resp.id,
        responsibleName: resp.name,
      });
      syncNow().catch(() => {});
      Alert.alert('Salvo', 'Biometria registrada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Erro', 'Falha ao salvar biometria offline.');
    } finally {
      setSaving(false);
    }
  }, [selectedCycle, selectedUser, user, sampleCount, averageWeightG, survivalRatePct, syncNow, navigation]);

  const handleSubmit = useCallback(() => {
    if (!selectedCycle) {
      Alert.alert('Erro', 'Selecione um ciclo.');
      return;
    }
    if (!selectedUser && !user) {
      Alert.alert('Erro', 'Selecione o responsável.');
      return;
    }
    if (!sampleCount.trim() || !averageWeightG.trim()) {
      Alert.alert('Erro', 'Informe nº de amostras e peso médio.');
      return;
    }

    const measuredAt = new Date();
    const fiveMinFuture = new Date(Date.now() + 5 * 60 * 1000);
    if (measuredAt > fiveMinFuture) {
      Alert.alert('Data futura', 'A data/hora está mais de 5 min no futuro. Confirmar mesmo assim?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => doSave() },
      ]);
      return;
    }
    doSave();
  }, [selectedCycle, selectedUser, user, sampleCount, averageWeightG, doSave]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Viveiro</Text>
        <PondSelector
          value={selectedPond}
          onChange={(p) => {
            setSelectedPond(p);
            setSelectedCycle(null);
          }}
        />

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ciclo</Text>
        <CycleSelector
          pondId={selectedPond?.id ?? null}
          value={selectedCycle}
          onChange={setSelectedCycle}
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Medições</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Nº de amostras <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={sampleCount}
            onChangeText={setSampleCount}
            placeholder="30"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Peso médio (g) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={averageWeightG}
            onChangeText={setAverageWeightG}
            placeholder="5.50"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sobrevivência (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={survivalRatePct}
            onChangeText={setSurvivalRatePct}
            placeholder="85"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Responsável <Text style={styles.required}>*</Text>
          </Text>
          <ResponsibleSelector value={selectedUser} onChange={setSelectedUser} />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Salvar biometria</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 24,
  },
  inputGroup: { marginBottom: 18 },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: { color: '#ef4444' },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#0369a1' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
