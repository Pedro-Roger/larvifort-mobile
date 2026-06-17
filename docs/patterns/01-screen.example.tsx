/**
 * PATTERN: Screen Component — Aquafort Mobile
 *
 * Localização: src/screens/<feature>/<FeatureName>Screen.tsx
 *
 * RESPONSABILIDADE: Apenas renderização e navegação.
 *   - Chama hooks para dados e mutações
 *   - Não tem lógica de negócio
 *   - Não acessa API, SQLite ou SecureStore diretamente
 *   - Usa componentes de UI da pasta src/components/
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWaterQuality, useCreateReading } from '../../hooks/useWaterQuality';
import { usePonds } from '../../hooks/usePonds';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { O2Semaphore } from '../../components/ui/O2Semaphore';
import { OfflineBanner } from '../../components/layout/OfflineBanner';
import { ReadingCard } from '../../components/ui/ReadingCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import type { WaterQualityReading } from '../../types/api.types';

// ─────────────────────────────────────────────────────────────────────────────
// TELA DE LISTAGEM — WaterQualityListScreen
// ─────────────────────────────────────────────────────────────────────────────

export function WaterQualityListScreen() {
  const navigation = useNavigation();
  const isOnline = useNetworkStatus();
  const [selectedPondId, setSelectedPondId] = useState<string | null>(null);

  const { data: ponds } = usePonds();
  const {
    readings,
    o2Status,
    isLoading,
    refetch,
  } = useWaterQuality(selectedPondId);

  const navigateToCreate = useCallback(() => {
    navigation.navigate('CreateReading', { pondId: selectedPondId });
  }, [navigation, selectedPondId]);

  const renderReading = useCallback(
    ({ item }: { item: WaterQualityReading }) => (
      <ReadingCard reading={item} />
    ),
    [],
  );

  return (
    <ScreenContainer>
      {/* Banner aparece só quando offline */}
      {!isOnline && <OfflineBanner />}

      {/* Semáforo O₂ — estado atual do viveiro via WebSocket */}
      {selectedPondId && (
        <O2Semaphore status={o2Status} pondName={ponds?.find(p => p.id === selectedPondId)?.name} />
      )}

      {/* Lista de leituras recentes */}
      <FlatList
        data={readings}
        keyExtractor={(item) => item.id}
        renderItem={renderReading}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={styles.list}
      />

      {/* FAB — Adicionar leitura */}
      <TouchableOpacity style={styles.fab} onPress={navigateToCreate}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

// Componente auxiliar — estado vazio
function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Nenhuma leitura registrada</Text>
      <Text style={styles.emptySubtext}>Toque no + para registrar a primeira leitura</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TELA DE CRIAÇÃO — CreateReadingScreen
// Demonstra: formulário offline-first com react-hook-form + zod
// ─────────────────────────────────────────────────────────────────────────────

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema de validação — valores válidos para leituras de viveiro de camarão
const readingSchema = z.object({
  pondId: z.string().uuid('Selecione um viveiro'),
  oxygenMgL: z
    .number({ invalid_type_error: 'Digite um valor numérico' })
    .min(0)
    .max(20)
    .optional(),
  ph: z.number().min(0).max(14).optional(),
  temperatureC: z.number().min(15).max(40).optional(),
  measuredAt: z.date(),
});

type ReadingFormData = z.infer<typeof readingSchema>;

interface CreateReadingScreenProps {
  route: { params?: { pondId?: string } };
}

export function CreateReadingScreen({ route }: CreateReadingScreenProps) {
  const navigation = useNavigation();
  const isOnline = useNetworkStatus();
  const { mutate: createReading, isPending } = useCreateReading();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReadingFormData>({
    resolver: zodResolver(readingSchema),
    defaultValues: {
      pondId: route.params?.pondId ?? '',
      measuredAt: new Date(),
    },
  });

  const onSubmit = useCallback(
    (data: ReadingFormData) => {
      createReading(data, {
        onSuccess: () => {
          if (!isOnline) {
            Alert.alert(
              'Salvo localmente',
              'A leitura será sincronizada quando houver internet.',
            );
          }
          navigation.goBack();
        },
        onError: (error) => {
          Alert.alert('Erro', 'Não foi possível salvar a leitura. Tente novamente.');
        },
      });
    },
    [createReading, isOnline, navigation],
  );

  return (
    <ScreenContainer scrollable>
      {!isOnline && <OfflineBanner message="Funcionando offline — dados serão sincronizados depois" />}

      {/* O₂ mg/L */}
      <Controller
        control={control}
        name="oxygenMgL"
        render={({ field }) => (
          <LabeledInput
            label="Oxigênio (mg/L)"
            keyboardType="decimal-pad"
            value={field.value?.toString() ?? ''}
            onChangeText={(text) => field.onChange(parseFloat(text) || undefined)}
            error={errors.oxygenMgL?.message}
            placeholder="ex: 5.2"
          />
        )}
      />

      {/* pH */}
      <Controller
        control={control}
        name="ph"
        render={({ field }) => (
          <LabeledInput
            label="pH"
            keyboardType="decimal-pad"
            value={field.value?.toString() ?? ''}
            onChangeText={(text) => field.onChange(parseFloat(text) || undefined)}
            error={errors.ph?.message}
            placeholder="ex: 7.8"
          />
        )}
      />

      {/* Temperatura */}
      <Controller
        control={control}
        name="temperatureC"
        render={({ field }) => (
          <LabeledInput
            label="Temperatura (°C)"
            keyboardType="decimal-pad"
            value={field.value?.toString() ?? ''}
            onChangeText={(text) => field.onChange(parseFloat(text) || undefined)}
            error={errors.temperatureC?.message}
            placeholder="ex: 28.5"
          />
        )}
      />

      {/* Botão de salvar */}
      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isPending}
      >
        <Text style={styles.buttonText}>
          {isPending ? 'Salvando...' : isOnline ? 'Salvar' : 'Salvar Offline'}
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE AUXILIAR — Input com label e erro
// Ficaria em src/components/ui/Input.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { TextInput, TextInputProps } from 'react-native';

interface LabeledInputProps extends TextInputProps {
  label: string;
  error?: string;
}

function LabeledInput({ label, error, ...props }: LabeledInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80, // espaço para o FAB
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#CC0000',
  },
  errorText: {
    fontSize: 12,
    color: '#CC0000',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#99BBDD',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
