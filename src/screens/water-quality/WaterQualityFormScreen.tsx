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
import { buildWaterQualityApiPayload, saveOffline } from '../../services/water-quality.service';
import { generateUUID } from '../../utils/uuid';
import { api } from '../../services/api';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { Pond, Cycle, User } from '../../types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'WaterQualityForm'>;

const formSchema = z.object({
  oxygenMgL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseFloat(v.replace(',', '.')) : undefined))
    .pipe(z.number().min(0).max(20).optional()),
  ph: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseFloat(v.replace(',', '.')) : undefined))
    .pipe(z.number().min(0).max(14).optional()),
  salinityPpt: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseFloat(v.replace(',', '.')) : undefined))
    .pipe(z.number().min(0).max(60).optional()),
  temperatureC: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseFloat(v.replace(',', '.')) : undefined))
    .pipe(z.number().min(0).max(45).optional()),
  ammoniaMgL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseFloat(v.replace(',', '.')) : undefined))
    .pipe(z.number().min(0).max(10).optional()),
  measuredAt: z.string().min(1, 'Informe a data/hora'),
  origin: z.enum(['MANUAL', 'VOZ']),
});

/**
 * The schema takes what the inputs hold (text) and gives back numbers, so the
 * form fields and the submit handler are typed from opposite ends of it.
 */
type FormInput = z.input<typeof formSchema>;
type FormData = z.output<typeof formSchema>;

function nowIso(): string {
  const d = new Date();
  // Format to local datetime string: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface NumericFieldProps {
  label: string;
  unit: string;
  name: keyof FormData;
  control: any;
  error?: string;
  placeholder?: string;
}

function NumericField({ label, unit, name, control, error, placeholder }: NumericFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {label} <Text style={styles.unit}>({unit})</Text>
          </Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={field.value?.toString() ?? ''}
            onChangeText={field.onChange}
            keyboardType="decimal-pad"
            placeholderTextColor="#64748b"
            placeholder={placeholder ?? '—'}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      )}
    />
  );
}

export function WaterQualityFormScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { isOnline, syncNow } = useSync();

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    user ? { id: user.id, name: user.name, role: user.role, active: true, updatedAt: '' } : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      measuredAt: nowIso(),
      origin: 'MANUAL',
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!selectedPond) {
        Alert.alert('Atenção', 'Selecione um viveiro');
        return;
      }
      if (!selectedCycle) {
        Alert.alert('Atenção', 'Selecione um ciclo');
        return;
      }
      if (!selectedUser) {
        Alert.alert('Atenção', 'Selecione o responsável');
        return;
      }

      setSubmitting(true);

      const payload = {
        pondId: selectedPond.id,
        cycleId: selectedCycle.id,
        responsibleId: selectedUser.id,
        responsibleName: selectedUser.name,
        oxygenMgL: data.oxygenMgL,
        ph: data.ph,
        salinityPpt: data.salinityPpt,
        temperatureC: data.temperatureC,
        ammoniaMgL: data.ammoniaMgL,
        measuredAt: new Date(data.measuredAt).toISOString(),
        origin: data.origin,
      };

      try {
        if (isOnline) {
          try {
            // CreateWaterQualityDto lives at POST /v1/water-quality — no
            // /readings suffix, and it expects doMgL/salinity/source, not
            // the local form's field names.
            const apiPayload = buildWaterQualityApiPayload(payload, generateUUID());
            await api.post('/v1/water-quality', apiPayload);
            Alert.alert('Sucesso', 'Coleta registrada e sincronizada!', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            return;
          } catch {
            // Fall through to offline save
          }
        }

        await saveOffline(payload);
        if (isOnline) {
          syncNow();
        }

        Alert.alert(
          'Registrado offline',
          'A coleta foi salva localmente e será sincronizada quando houver conexão.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } catch (err: any) {
        Alert.alert('Erro', err?.message ?? 'Não foi possível salvar a coleta');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedPond, selectedCycle, selectedUser, isOnline, navigation, syncNow],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Pond */}
        <Text style={styles.stepLabel}>Viveiro</Text>
        <PondSelector
          value={selectedPond}
          onChange={(pond) => {
            setSelectedPond(pond);
            setSelectedCycle(null);
          }}
        />

        {/* Step 2: Cycle */}
        <Text style={[styles.stepLabel, { marginTop: 16 }]}>Ciclo</Text>
        <CycleSelector
          pondId={selectedPond?.id ?? null}
          value={selectedCycle}
          onChange={setSelectedCycle}
        />

        {/* Step 3: Form */}
        <View style={styles.divider} />

        {/* Responsible */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Responsável <Text style={styles.required}>*</Text>
          </Text>
          <ResponsibleSelector value={selectedUser} onChange={setSelectedUser} />
        </View>

        {/* Numeric fields */}
        <NumericField
          label="O₂"
          unit="mg/L"
          name="oxygenMgL"
          control={control}
          error={errors.oxygenMgL?.message}
          placeholder="ex: 5.2"
        />
        <NumericField
          label="pH"
          unit=""
          name="ph"
          control={control}
          error={errors.ph?.message}
          placeholder="ex: 7.8"
        />
        <NumericField
          label="Salinidade"
          unit="ppt"
          name="salinityPpt"
          control={control}
          error={errors.salinityPpt?.message}
          placeholder="ex: 25"
        />
        <NumericField
          label="Temperatura"
          unit="°C"
          name="temperatureC"
          control={control}
          error={errors.temperatureC?.message}
          placeholder="ex: 28.5"
        />
        <NumericField
          label="Amônia"
          unit="mg/L"
          name="ammoniaMgL"
          control={control}
          error={errors.ammoniaMgL?.message}
          placeholder="ex: 0.1"
        />

        {/* Date/time */}
        <Controller
          control={control}
          name="measuredAt"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data/Hora da Coleta</Text>
              <TextInput
                style={[styles.input, errors.measuredAt && styles.inputError]}
                value={field.value}
                onChangeText={field.onChange}
                placeholderTextColor="#64748b"
                placeholder="YYYY-MM-DDTHH:MM"
              />
              {errors.measuredAt && (
                <Text style={styles.errorText}>{errors.measuredAt.message}</Text>
              )}
            </View>
          )}
        />

        {/* Origin toggle */}
        <Controller
          control={control}
          name="origin"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Origem</Text>
              <View style={styles.toggle}>
                <TouchableOpacity
                  style={[styles.toggleBtn, field.value === 'MANUAL' && styles.toggleBtnActive]}
                  onPress={() => field.onChange('MANUAL')}
                >
                  <Text style={[styles.toggleText, field.value === 'MANUAL' && styles.toggleTextActive]}>
                    Manual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, field.value === 'VOZ' && styles.toggleBtnActive]}
                  onPress={() => field.onChange('VOZ')}
                >
                  <Text style={[styles.toggleText, field.value === 'VOZ' && styles.toggleTextActive]}>
                    Voz
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* Offline notice */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📡 Modo offline — dados serão sincronizados quando houver conexão
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>
              {isOnline ? 'Registrar Coleta' : 'Salvar Offline'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  stepLabel: {
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
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  unit: {
    color: '#64748b',
    fontWeight: '400',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#0ea5e9',
  },
  toggleText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  offlineBanner: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  offlineText: {
    color: '#f59e0b',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#0369a1',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
