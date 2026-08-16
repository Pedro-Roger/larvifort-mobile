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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PondSelector } from '../../components/PondSelector';
import { CycleSelector } from '../../components/CycleSelector';
import { ResponsibleSelector } from '../../components/ResponsibleSelector';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import { isRecordedAtTooFarInFuture, saveOfflineMortality } from '../../services/mortality.service';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { Pond, Cycle, User } from '../../types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'MortalityForm'>;

const QUANTITY_REQUIRED_MSG = 'Informe a quantidade de camarões mortos (número inteiro maior que zero).';

const formSchema = z.object({
  quantity: z
    .string()
    .transform((v) => Number((v ?? '').trim()))
    .pipe(
      z
        .number({ error: QUANTITY_REQUIRED_MSG })
        .int(QUANTITY_REQUIRED_MSG)
        .positive(QUANTITY_REQUIRED_MSG),
    ),
  observation: z.string().optional(),
});

/**
 * The schema takes what the inputs hold (text) and gives back numbers, so the
 * form fields and the submit handler are typed from opposite ends of it.
 */
type FormInput = z.input<typeof formSchema>;
type FormData = z.output<typeof formSchema>;

export function MortalityFormScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { syncNow } = useSync();

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    user ? { id: user.id, name: user.name, role: user.role, active: true, updatedAt: '' } : null,
  );
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: '',
      observation: '',
    },
  });

  const doSave = useCallback(
    async (data: FormData, resp: { id: string; name: string }, recordedAt: Date) => {
      setSaving(true);
      try {
        await saveOfflineMortality({
          cycleId: selectedCycle!.id,
          pondId: selectedPond!.id,
          quantity: data.quantity,
          recordedAt: recordedAt.toISOString(),
          observation: data.observation?.trim() || undefined,
          responsibleId: resp.id,
          responsibleName: resp.name,
        });
        syncNow().catch(() => {});
        Alert.alert('Salvo', 'Mortalidade registrada.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (error: any) {
        Alert.alert('Erro', error?.message ?? 'Falha ao salvar mortalidade offline.');
      } finally {
        setSaving(false);
      }
    },
    [selectedCycle, selectedPond, syncNow, navigation],
  );

  const onSubmit = useCallback(
    (data: FormData) => {
      if (!selectedPond) {
        Alert.alert('Erro', 'Selecione um viveiro.');
        return;
      }
      if (!selectedCycle) {
        Alert.alert('Erro', 'Selecione um ciclo.');
        return;
      }
      const resp = selectedUser ?? (user ? { id: user.id, name: user.name } : null);
      if (!resp) {
        Alert.alert('Erro', 'Selecione o responsável.');
        return;
      }

      const recordedAt = new Date();
      if (isRecordedAtTooFarInFuture(recordedAt)) {
        Alert.alert('Data futura', 'A data/hora está mais de 5 min no futuro. Confirmar mesmo assim?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => doSave(data, resp, recordedAt) },
        ]);
        return;
      }
      doSave(data, resp, recordedAt);
    },
    [selectedPond, selectedCycle, selectedUser, user, doSave],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Viveiro</Text>
        <PondSelector
          value={selectedPond}
          onChange={(p) => {
            setSelectedPond(p);
            setSelectedCycle(null);
          }}
        />

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ciclo</Text>
        <CycleSelector pondId={selectedPond?.id ?? null} value={selectedCycle} onChange={setSelectedCycle} />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Mortalidade</Text>

        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Camarões mortos <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.quantity && styles.inputError]}
                keyboardType="numeric"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="ex: 15"
                placeholderTextColor="#64748b"
              />
              {errors.quantity && <Text style={styles.errorText}>{errors.quantity.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="observation"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Observação</Text>
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Ex.: encontrados na borda do viveiro"
                placeholderTextColor="#64748b"
              />
            </View>
          )}
        />

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Responsável <Text style={styles.required}>*</Text>
          </Text>
          <ResponsibleSelector value={selectedUser} onChange={setSelectedUser} />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Salvar mortalidade</Text>
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
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
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
