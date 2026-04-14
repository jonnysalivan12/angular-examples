# Standard architektoniczny — odwrócenie zależności przez InjectionToken

> Wersja: 1.0 | Dotyczy: Angular 21  
> Stosuj razem z NGXS Coding Standard i Angular 21 Standard.

---

## 1. Problem

W architekturze warstwowej (Onion Architecture) zależności mogą płynąć tylko do wewnątrz. Warstwa wewnętrzna nie może znać warstwy zewnętrznej.

Problem pojawia się gdy moduł wewnętrzny potrzebuje danych od zewnętrznego:

```typescript
// ❌ ŹLE — moduł wewnętrzny (step2) zna zewnętrzny (wizard)
@Injectable()
export class Step2EffectsService extends NgxsEffectsService {
  private readonly wizardState = inject(WizardStateService); // zależność do góry
}
```

---

## 2. Rozwiązanie — InjectionToken jako kontrakt

Moduł wewnętrzny deklaruje `InjectionToken` opisujący **swoje potrzeby** — nie wie kto i jak je dostarczy. Moduł zewnętrzny dostarcza implementację.

```
Moduł wewnętrzny  ──► InjectionToken (własny — deklaruje potrzeby)
Moduł zewnętrzny  ──► InjectionToken (implementuje — dostarcza dane)
Moduł wewnętrzny  ──► Moduł zewnętrzny (❌ brak zależności)
```

---

## 3. Implementacja

### 3.1 Deklaracja tokena w module wewnętrznym

Token i interfejs żyją w folderze modułu który ich potrzebuje:

```typescript
// feature/tokens/feature-context.token.ts
export interface FeatureContext {
  userId: string;
  settings: UserSettings;
}

export const FEATURE_CONTEXT = new InjectionToken<FeatureContext>('FEATURE_CONTEXT');
```

### 3.2 Użycie tokena w module wewnętrznym

Moduł wewnętrzny wstrzykuje token — nie wie skąd pochodzi implementacja:

```typescript
// feature/feature-effects.service.ts
@Injectable()
export class FeatureEffectsService extends NgxsEffectsService {
  private readonly context = inject(FEATURE_CONTEXT);
  private readonly featureApi = inject(FeatureApiService);
  private readonly store = inject(Store);

  @Effect([Feature.Init.Request])
  protected featureInitEffect(): Observable<unknown> {
    return this.featureApi.getData(this.context.userId).pipe(
      tap(data =>
        this.store.dispatch(new Feature.Init.Success({ data })),
      ),
      catchError(err => {
        this.store.dispatch(new Feature.Init.Failure({ error: err.message }));
        return EMPTY;
      }),
    );
  }
}
```

### 3.3 Implementacja tokena w module zewnętrznym

Moduł zewnętrzny dostarcza implementację tokena przez dedykowany serwis kontekstu. Serwis implementuje interfejs tokena i wstrzykuje to czego potrzebuje z warstwy zewnętrznej:

```typescript
// parent/services/feature-context.service.ts
@Injectable()
export class FeatureContextService implements FeatureContext {
  private readonly parentState = inject(ParentStateService);

  get userId(): string {
    return this.parentState.userId();
  }

  get settings(): UserSettings {
    return this.parentState.settings();
  }
}
```

Serwis rejestrowany jest jako implementacja tokena w `providers` route, komponentu lub providers funkcji:

```typescript
// parent.routes.ts
{
  path: 'feature',
  loadComponent: () =>
    import('./feature/feature.component').then(m => m.FeatureComponent),
  providers: [
    featureStateProviders(),
    {
      provide: FEATURE_CONTEXT,
      useClass: FeatureContextService,
    },
  ],
}
```

---

## 4. Zasady

### Token deklaruje moduł który potrzebuje — nie który dostarcza

```typescript
// ✅ DOBRZE — token w folderze modułu który go używa
feature/
└── tokens/
    └── feature-context.token.ts

// ❌ ŹLE — token w folderze modułu który go dostarcza
parent/
└── tokens/
    └── feature-context.token.ts
```

### Interfejs tokena opisuje potrzeby — nie strukturę dostawcy

```typescript
// ✅ DOBRZE — minimalne potrzeby modułu
export interface FeatureContext {
  userId: string;
  settings: UserSettings;
}

// ❌ ŹLE — przepisanie całego stanu rodzica
export interface FeatureContext {
  parentState: ParentStateModel; // moduł wewnętrzny zna model zewnętrznego
}
```

### Jeden token na moduł lub na logiczną grupę potrzeb

```typescript
// ✅ DOBRZE — jeden spójny kontrakt
export const FEATURE_CONTEXT = new InjectionToken<FeatureContext>('FEATURE_CONTEXT');

// ❌ ŹLE — rozproszone tokeny dla każdej wartości osobno
export const FEATURE_USER_ID = new InjectionToken<string>('FEATURE_USER_ID');
export const FEATURE_SETTINGS = new InjectionToken<UserSettings>('FEATURE_SETTINGS');
export const FEATURE_PERMISSIONS = new InjectionToken<string[]>('FEATURE_PERMISSIONS');
```

---

## 5. Kiedy token, kiedy inne podejście

| Sytuacja | Podejście |
|---|---|
| Dane potrzebne **przez cały cykl życia** modułu | `InjectionToken` |
| Dane potrzebne **jednorazowo przy inicjalizacji** | Payload w akcji `Init.Request` |
| Dane z **globalnego stanu** (token sesji, userId) | Bezpośrednio przez fasadę stanu globalnego |
| **Konfiguracja statyczna** (url, flagi) | `InjectionToken` z `useValue` |

---

## 6. Antywzorce

| Antywzorzec | Właściwe podejście |
|---|---|
| `inject(ParentStateService)` w module wewnętrznym | `inject(FEATURE_CONTEXT)` zadeklarowany w module wewnętrznym |
| Token zadeklarowany w module zewnętrznym | Token deklaruje moduł który **potrzebuje**, nie który dostarcza |
| Interfejs tokena zawiera model warstwy zewnętrznej | Interfejs opisuje tylko potrzeby modułu wewnętrznego |
| Wiele rozproszonych tokenów dla jednego modułu | Jeden spójny interfejs kontekstu |
| `useFactory` z inline logiką | Dedykowany serwis kontekstu z `useClass` — testowalny i czytelny |
| Serwis kontekstu w folderze modułu wewnętrznego | Serwis kontekstu żyje w module zewnętrznym który go dostarcza |
