import React, { useState, useCallback, useEffect } from 'react';
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
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PondSelector } from '../../components/PondSelector';
import { CycleSelector } from '../../components/CycleSelector';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import { useFeedProductsCache } from '../../hooks/useFeedProductsCache';
import { getPendingFeedKgForPond, saveOfflineFeeding } from '../../services/feeding.service';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { Cycle, FeedProduct, Pond } from '../../types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'FeedingForm'>;

/** Common tray amounts, so the operator taps instead of typing in the sun. */
const QUICK_KG = [10, 20, 30, 50];

const formSchema = z.object({
  feedKg: z
    .string()
    .transform((v) => parseFloat((v ?? '').replace(',', '.')))
    .pipe(
      z
        .number({ error: 'Informe uma quantidade maior que zero.' })
        .positive('Informe uma quantidade maior que zero.'),
    ),
  observation: z.string().optional(),
});

/**
 * The schema takes what the input holds (text) and gives back a number, so the
 * form field and the submit handler are typed from opposite ends of it.
 */
type FormInput = z.input<typeof formSchema>;
type FormData = z.output<typeof formSchema>;

export function FeedingFormScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { syncNow } = useSync();
  const { products } = useFeedProductsCache();

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [product, setProduct] = useState<FeedProduct | null>(null);
  const [pendingKg, setPendingKg] = useState(0);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feedKg: '',
      observation: '',
    },
  });

  const feedKgRaw = useWatch({ control, name: 'feedKg' });

  // Default to the only product, which is the usual case on a farm.
  useEffect(() => {
    if (!product && products.length) setProduct(products[0]);
  }, [products, product]);

  // What this phone already recorded for the pond and has not pushed yet.
  useEffect(() => {
    if (!selectedPond) {
      setPendingKg(0);
      return;
    }
    getPendingFeedKgForPond(selectedPond.id)
      .then(setPendingKg)
      .catch(() => setPendingKg(0));
  }, [selectedPond]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!selectedPond) return Alert.alert('Erro', 'Selecione o viveiro.');
      if (!selectedCycle) return Alert.alert('Erro', 'Selecione o ciclo.');
      if (!product) return Alert.alert('Erro', 'Nenhum produto de ração disponível. Sincronize primeiro.');
      if (!user) return Alert.alert('Erro', 'Sessão sem usuário.');

      setSaving(true);
      try {
        await saveOfflineFeeding({
          cycleId: selectedCycle.id,
          pondId: selectedPond.id,
          productId: product.id,
          feedKg: data.feedKg,
          fedAt: new Date().toISOString(),
          responsibleId: user.id,
          responsibleName: user.name,
          observation: data.observation?.trim() || undefined,
        });

        syncNow().catch(() => {});
        Alert.alert('Salvo', `${data.feedKg} kg registrados em ${selectedPond.code}.`, [
          { text: 'Lançar outro', onPress: () => reset({ feedKg: '', observation: '' }) },
          { text: 'Concluir', onPress: () => navigation.goBack() },
        ]);
      } catch (error: any) {
        Alert.alert('Erro', error?.message ?? 'Falha ao salvar o trato.');
      } finally {
        setSaving(false);
      }
    },
    [selectedCycle, selectedPond, product, user, syncNow, navigation, reset],
  );

  const parsedKgPreview = parseFloat((feedKgRaw ?? '').replace(',', '.'));
  const estimatedCost =
    product?.priceKg != null && Number.isFinite(parsedKgPreview) && parsedKgPreview > 0
      ? product.priceKg * parsedKgPreview
      : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Viveiro</Text>
        <PondSelector
          value={selectedPond}
          onChange={(pond) => {
            setSelectedPond(pond);
            setSelectedCycle(null);
          }}
        />

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ciclo</Text>
        <CycleSelector pondId={selectedPond?.id ?? null} value={selectedCycle} onChange={setSelectedCycle} />

        {pendingKg > 0 && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingText}>
              {pendingKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg neste aparelho ainda não sincronizados
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Quantidade</Text>

        <View style={styles.quickRow}>
          {QUICK_KG.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickBtn}
              onPress={() => setValue('feedKg', String(amount), { shouldValidate: true })}
            >
              <Text style={styles.quickText}>{amount} kg</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Controller
          control={control}
          name="feedKg"
          render={({ field }) => (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Ração (kg) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.inputLarge, errors.feedKg && styles.inputError]}
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="0"
                placeholderTextColor="#64748b"
              />
              {errors.feedKg && <Text style={styles.errorText}>{errors.feedKg.message}</Text>}
              {estimatedCost != null && (
                <Text style={styles.hint}>
                  Custo estimado: {estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              )}
            </View>
          )}
        />

        <Text style={styles.sectionTitle}>Produto</Text>
        <View style={styles.productRow}>
          {products.map((item) => {
            const active = product?.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.productChip, active && styles.productChipActive]}
                onPress={() => setProduct(item)}
              >
                <Text style={[styles.productText, active && styles.productTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
          {!products.length && (
            <Text style={styles.hint}>Nenhum produto em cache. Sincronize para carregar.</Text>
          )}
        </View>

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
                placeholder="Ex.: coroa, cocheira, aumento após bandeja"
                placeholderTextColor="#64748b"
              />
            </View>
          )}
        />

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Registrar trato</Text>}
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
  divider: { height: 1, backgroundColor: '#1e293b', marginVertical: 24 },
  inputGroup: { marginBottom: 18 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
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
  inputLarge: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
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
  hint: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  quickBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickText: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  productRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  productChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  productChipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  productText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  productTextActive: { color: '#ffffff' },
  pendingBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  pendingText: { color: '#7dd3fc', fontSize: 13, fontWeight: '600' },
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
