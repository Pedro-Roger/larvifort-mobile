# Estrutura de Pastas — aquafort-mobile

## Árvore Completa

```
aquafort-mobile/
│
├── app/                         ← Expo Router (se usar file-based routing)
│   └── _layout.tsx              ← ou usar src/navigation/ com React Navigation
│
├── src/
│   │
│   ├── navigation/              ← toda a configuração de navegação aqui
│   │   ├── RootNavigator.tsx    ← decide Auth vs App
│   │   ├── AuthStack.tsx
│   │   ├── AppNavigator.tsx     ← tabs + drawer
│   │   └── types.ts             ← tipos de params de cada rota
│   │
│   ├── screens/                 ← uma pasta por feature
│   │   ├── water-quality/
│   │   │   ├── WaterQualityListScreen.tsx
│   │   │   └── CreateReadingScreen.tsx
│   │   ├── feeding/
│   │   │   ├── FeedingListScreen.tsx
│   │   │   └── CreateFeedingScreen.tsx
│   │   ├── biometrics/
│   │   │   ├── BiometricListScreen.tsx
│   │   │   └── CreateBiometricScreen.tsx
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx
│   │   └── sync/
│   │       └── SyncStatusScreen.tsx
│   │
│   ├── components/              ← componentes reutilizáveis
│   │   ├── ui/                  ← componentes visuais puros (sem lógica)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── O2Semaphore.tsx  ← semáforo Verde/Amarelo/Vermelho
│   │   ├── forms/               ← formulários compostos
│   │   │   ├── ReadingForm.tsx
│   │   │   └── FeedingForm.tsx
│   │   └── layout/
│   │       ├── ScreenContainer.tsx
│   │       └── OfflineBanner.tsx
│   │
│   ├── hooks/                   ← React Query hooks (um por feature)
│   │   ├── useWaterQuality.ts   ← leitura + criação + cache offline
│   │   ├── useFeedings.ts
│   │   ├── useBiometrics.ts
│   │   ├── usePonds.ts
│   │   ├── useSync.ts           ← controle da fila de sync
│   │   └── useAuth.ts
│   │
│   ├── services/
│   │   ├── api.ts               ← Axios instance + auth interceptor
│   │   ├── sync.ts              ← OutboxService + SyncMonitor
│   │   └── socket.ts            ← Socket.IO singleton
│   │
│   ├── database/                ← SQLite local
│   │   ├── db.ts                ← abre a conexão SQLite
│   │   ├── migrations.ts        ← cria tabelas na primeira abertura
│   │   └── repositories/
│   │       ├── outbox.repository.ts     ← lê/escreve na outbox_queue
│   │       └── readings.repository.ts  ← cache local de leituras
│   │
│   ├── store/                   ← estado global mínimo (Zustand)
│   │   ├── auth.store.ts        ← user logado, token
│   │   └── ui.store.ts          ← selectedPondId, theme
│   │
│   ├── types/                   ← TypeScript types compartilhados
│   │   ├── api.types.ts         ← tipos espelhados da API (response DTOs)
│   │   ├── navigation.types.ts  ← params de navegação
│   │   └── sync.types.ts        ← OutboxItem, SyncStatus
│   │
│   └── utils/
│       ├── date.ts              ← formatação de datas (date-fns)
│       ├── number.ts            ← formatação de decimais (R$, kg)
│       └── validation.ts        ← schemas Zod compartilhados
│
├── assets/                      ← imagens, ícones, fonts
│   ├── images/
│   └── fonts/
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── patterns/
│
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

## Regras de Organização

### 1. Screens são "burras"

Screen components não têm lógica — apenas chamam hooks e renderizam.

```typescript
// ✅ Screen correta
export function WaterQualityListScreen() {
  const { readings, isLoading } = useWaterQuality();
  const isOnline = useNetworkStatus();

  if (isLoading) return <LoadingView />;
  return <ReadingsList data={readings} showOfflineBanner={!isOnline} />;
}

// ❌ Screen errada — lógica de negócio aqui
export function WaterQualityListScreen() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/readings').then(r => r.json()).then(setData); // ERRADO
  }, []);
}
```

### 2. Hooks fazem tudo (React Query)

Cada feature tem um hook que encapsula:
- Busca na API (useQuery)
- Mutação + cache invalidation (useMutation)
- Fallback offline para SQLite local

```
hooks/useWaterQuality.ts
  ├── useReadingsByPond(pondId)   ← lista leituras
  ├── useCreateReading()          ← cria (online ou salva offline)
  └── useO2Status(pondId)         ← semáforo (WebSocket)
```

### 3. Services são sem estado

`api.ts`, `sync.ts` e `socket.ts` são instâncias singleton puras.
Não têm `useState` — são chamados pelos hooks.

### 4. Tipos são espelhados da API

`src/types/api.types.ts` replica os response DTOs da API:

```typescript
// Espelha CycleResponseDto da API
export interface Cycle {
  id: string;
  pondId: string;
  pondName: string;
  status: 'PLANEJADO' | 'ATIVO' | 'COLHIDO' | 'CANCELADO';
  startDate: string; // ISO string no mobile (Date no backend)
  larvaeCount: number;
  fca?: number;
  daysInCycle?: number;
}
```

### 5. Database é isolado em `src/database/`

SQLite só é acessado pelos repositórios em `src/database/repositories/`.
Hooks chamam repositórios, não o SQLite diretamente.

```typescript
// ✅ Hook usa repositório
const readings = await outboxRepository.findAllPending();

// ❌ Hook não acessa SQLite diretamente
const result = await db.execAsync('SELECT * FROM outbox_queue WHERE status = "pending"');
```
