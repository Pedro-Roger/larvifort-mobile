# Aquafort Mobile — Arquitetura Completa

## 1. Visão Geral

O app mobile é usado pelos **técnicos nos viveiros** — ambientes sem Wi-Fi confiável.
A estratégia central é **offline-first**: todas as ações funcionam sem conexão e
sincronizam automaticamente quando a internet volta.

```
┌─────────────────────────────────────────────────────────────────────┐
│                   TELA (React Native + Expo)                        │
│                                                                     │
│   Screen Component                                                  │
│       │                                                             │
│       ├── useWaterQuality() ← React Query (cache local)             │
│       ├── useOfflineSync()  ← monitora conectividade                │
│       └── useFormSubmit()   ← salva local se offline                │
│                │                                                    │
│   ┌────────────▼────────────┐                                       │
│   │  SQLite (expo-sqlite)   │  ← dados offline permanentes          │
│   │  AsyncStorage (MMKV)    │  ← preferências, tokens               │
│   │  outbox_queue table     │  ← ações pendentes de sync            │
│   └────────────┬────────────┘                                       │
└────────────────┼────────────────────────────────────────────────────┘
                 │ quando online (NetInfo)
                 ▼
        aquafort-api REST + WebSocket
```

## 2. Stack Técnica

| Camada | Tecnologia | Papel |
|--------|-----------|-------|
| Framework | Expo 53 + React Native | UI nativa |
| Linguagem | TypeScript | tipagem end-to-end |
| Navegação | React Navigation 7 | Stack + Tab + Drawer |
| HTTP | Axios | chamadas à API |
| Cache/Estado | @tanstack/react-query | cache, revalidação, loading states |
| Armazenamento local | expo-sqlite | dados offline (readings, feedings) |
| Fila de sync | outbox_queue (SQLite) | ações pendentes quando offline |
| Token seguro | expo-secure-store | JWT armazenado de forma segura |
| Conectividade | @react-native-community/netinfo | detectar online/offline |
| Formulários | react-hook-form + zod | validação tipada |
| WebSocket | socket.io-client | semáforo O₂ em tempo real |

## 3. Princípio Offline-First

### Fluxo: Registrar leitura de O₂

```
Técnico digita O₂ = 4.2 mg/L
        │
        ▼
useWaterQualityForm.submit()
        │
        ├── [online]  → POST /v1/water-quality/readings → OK
        │                       ↓
        │               Salva no SQLite local (cache)
        │
        └── [offline] → Salva no SQLite (outbox_queue)
                                ↓
                        Retorna "salvo localmente" ao usuário
                                ↓
                        (quando internet volta)
                        SyncMonitor detecta conexão
                                ↓
                        syncBatch() → POST /v1/water-quality/batch
```

### Idempotência com client_uuid

Cada item da outbox tem um `client_uuid` (UUID gerado no device).
A API usa `client_uuid` como chave de idempotência:
se a request chega duas vezes (retry), apenas uma persiste.

```typescript
// Sempre gere o UUID no device antes de qualquer chamada
const clientUuid = Crypto.randomUUID();  // expo-crypto
```

## 4. Navegação

```
RootNavigator
├── AuthStack (não autenticado)
│   └── LoginScreen
│
└── AppNavigator (autenticado)
    ├── BottomTabNavigator
    │   ├── WaterQualityTab
    │   │   └── WaterQualityListScreen
    │   │       └── CreateReadingScreen (modal)
    │   ├── FeedingTab
    │   │   └── FeedingListScreen
    │   │       └── CreateFeedingScreen (modal)
    │   ├── BiometricsTab
    │   │   └── BiometricListScreen
    │   │       └── CreateBiometricScreen (modal)
    │   └── SyncTab
    │       └── SyncStatusScreen
    │
    └── DrawerNavigator (acessível pelo hambúrguer)
        ├── PondsScreen (mapa dos viveiros)
        └── SettingsScreen
```

## 5. Estrutura de Telas por Feature

### WaterQuality (mais crítica — semáforo O₂)

```
WaterQualityListScreen
  ├── Header: Semáforo O₂ (Verde/Amarelo/Vermelho) via WebSocket
  ├── Lista: últimas 20 leituras do viveiro selecionado
  └── FAB: "Nova Leitura" → CreateReadingScreen (bottomSheet modal)

CreateReadingScreen
  ├── Picker: Selecionar viveiro
  ├── Inputs: O₂, pH, Temperatura, Salinidade, Transparência
  ├── DateTimePicker: Horário da leitura
  └── Botão "Salvar" (funciona offline)
```

### Feeding (arraçoamento)

```
FeedingListScreen
  ├── Totalizador: kg hoje / kg no lote
  └── Lista por viveiro/lote

CreateFeedingScreen
  ├── Picker: Viveiro → Lote ativo
  ├── Picker: Produto (da lista de ração)
  ├── Input: Quantidade (kg)
  └── Botão "Salvar"
```

## 6. Estrutura do SQLite Local

```sql
-- Tabela de fila de sincronização (outbox pattern)
CREATE TABLE outbox_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid TEXT    NOT NULL UNIQUE,
  entity      TEXT    NOT NULL,  -- 'water_quality_reading' | 'feeding' | 'biometric'
  endpoint    TEXT    NOT NULL,  -- '/v1/water-quality/readings'
  payload     TEXT    NOT NULL,  -- JSON
  status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | synced | error
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Cache local de leituras já sincronizadas
CREATE TABLE water_quality_readings_cache (
  id          TEXT PRIMARY KEY,  -- UUID do servidor
  client_uuid TEXT,
  pond_id     TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  oxygen_mg_l REAL,
  ph          REAL,
  synced      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);
```

## 7. Resultado Esperado — App Funcionando

### Cenário 1: Técnico com internet
1. Abre app → lista de viveiros carrega (React Query cache)
2. Seleciona Viveiro 201 → semáforo verde aparece via WebSocket
3. Registra O₂ = 3.1 mg/L → POST para API → semáforo fica **vermelho**
4. Gestor no web vê o alerta em tempo real

### Cenário 2: Técnico sem internet (campo)
1. Abre app → lista carrega do SQLite local (último cache)
2. Registra 5 leituras de O₂ → salvas no SQLite (status: pending)
3. Badge no SyncTab mostra "5 pendentes"
4. Volta ao escritório → Wi-Fi conecta → SyncMonitor dispara
5. syncBatch() envia as 5 leituras → badge some

### Cenário 3: App fechado, internet volta
- SyncMonitor usa `AppState` para disparar sync quando app volta ao foreground
- Garante que mesmo ações antigas (de ontem) sejam enviadas

## 8. Como Rodar Localmente

```bash
cd aquafort-mobile

# iOS (Mac com Xcode)
npm run ios

# Android
npm run android

# Expo Go (qualquer dispositivo na mesma rede)
npm run start
```

**Apontar para a API local:**
```env
# .env.local
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000   # IP local da máquina de dev
```

> Use o IP da máquina (não localhost) — o device/emulador não resolve `localhost` do host.
