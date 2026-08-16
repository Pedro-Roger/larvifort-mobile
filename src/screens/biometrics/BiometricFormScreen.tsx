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
import { isMeasuredAtTooFarInFuture, saveOfflineBiometric } from '../../services/biometric.service';
import { isBercarioPondType, resolveAverageWeightGInput } from '../../utils/plPerGram';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { Pond, Cycle, User } from '../../types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'BiometricForm'>;

const REQUIRED_MSG = 'Informe nº de amostras e peso médio.';

const formSchema = z.object({
  sampleCount: z
    .string()
    .min(1, REQUIRED_MSG)
    .transform((v) => Number(v)),
  averageWeightG: z
    .string()
    .min(1, REQUIRED_MSG)
    .transform((v) => Number(v.replace(',', '.'))),
  survivalRatePct: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v.replace(',', '.')) : undefined)),
});

/**
 * The schema takes what the inputs hold (text) and gives back numbers, so the
 * form fields and the submit handler are typed from opposite ends of it.
 */
type FormInput = z.input<typeof formSchema>;
type FormData = z.output<typeof formSchema>;

export function BiometricFormScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { syncNow } = useSync();

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  /** RF-10/RN-10: bercario cycles read the weight field as PL/g; engorda/reprodutor keep grams. */
  const isBercario = isBercarioPondType(selectedPond?.type);
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
      sampleCount: '',
      averageWeightG: '',
      survivalRatePct: '',
    },
  });

  const doSave = useCallback(
    async (data: FormData, resp: { id: string; name: string }, measuredAt: Date) => {
      setSaving(true);
      try {
        await saveOfflineBiometric({
          cycleId: selectedCycle!.id,
          measuredAt: measuredAt.toISOString(),
          sampleCount: data.sampleCount,
          // RF-10/RF-11: for a bercario cycle this field was read as PL/g —
          // converts to avg_weight_g (RN-09) before it reaches the offline DTO.
          averageWeightG: resolveAverageWeightGInput(data.averageWeightG, selectedPond?.type),
          survivalRatePct: data.survivalRatePct,
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
    },
    [selectedCycle, selectedPond, syncNow, navigation],
  );

  const onSubmit = useCallback(
    (data: FormData) => {
      if (!selectedCycle) {
        Alert.alert('Erro', 'Selecione um ciclo.');
        return;
      }
      const resp = selectedUser ?? (user ? { id: user.id, name: user.name } : null);
      if (!resp) {
        Alert.alert('Erro', 'Selecione o responsável.');
        return;
      }

      const measuredAt = new Date();
      if (isMeasuredAtTooFarInFuture(measuredAt)) {
        Alert.alert('Data futura', 'A data/hora está mais de 5 min no futuro. Confirmar mesmo assim?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => doSave(data, resp, measuredAt) },
        ]);
        return;
      }
      doSave(data, resp, measuredAt);
    },
    [selectedCycle, selectedUser, user, doSave],
  );

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

        <Controller
          control={control}
          name="sampleCount"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nº de amostras <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.sampleCount && styles.inputError]}
                keyboardType="numeric"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="30"
                placeholderTextColor="#64748b"
              />
              {errors.sampleCount && <Text style={styles.errorText}>{errors.sampleCount.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="averageWeightG"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {isBercario ? 'PL/grama' : 'Peso médio (g)'} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.averageWeightG && styles.inputError]}
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                placeholder={isBercario ? 'Pós-larvas por grama' : '5.50'}
                placeholderTextColor="#64748b"
              />
              {errors.averageWeightG && (
                <Text style={styles.errorText}>{errors.averageWeightG.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="survivalRatePct"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sobrevivência (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="85"
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
