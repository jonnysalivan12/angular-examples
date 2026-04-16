# NGXS Coding Standard
> Standard zarządzania stanem z NGXS dla generowania kodu przez AI.  
> Wersja: 1.1 | Źródła: ngxs.io Style Guide, ngxs.io docs, community best practices 2025.  
> Stosuj razem z TypeScript Standard i Angular 21 Standard.

---

## 1. Cztery koncepty NGXS

NGXS opiera się na czterech pojęciach, które muszą być ściśle rozdzielone:

- **Store** — globalny kontener stanu; jedyne miejsce do `dispatch` akcji i `select` danych
- **State** — klasa definiująca fragment stanu i obsługująca akcje (`@Action`)
- **Action** — klasa opisująca co ma się wydarzyć; niesie dane potrzebne do zmiany stanu
- **Selector** — czysta funkcja wyciągająca i transformująca fragment stanu; memoizowana automatycznie

---

## 2. Actions — akcje

### 2.1 ActionBuilder — klasa pomocnicza

Wszystkie akcje tworzone są przez `ActionBuilder.define()`. Eliminuje to boilerplate konstruktorów i wymusza spójny kształt akcji w całej aplikacji.

```typescript
// action-builder.ts
export namespace ActionBuilder {
  export class BaseAction<T = void> {
    constructor(public payload?: T) {}
  }

  export function define<T = void>(type: string) {
    return class extends BaseAction<T> {
      static readonly type = type;
    };
  }
}
```

### 2.2 Grupowanie akcji w namespace

Akcje grupujemy w zagnieżdżone namespace'y:
- poziom 1 — kontekst / strona / moduł (np. `Dashboard`)
- poziom 2 — encja domenowa (np. `Users`)
- poziom 3 — operacja (np. `Load`)
- stałe `Request`, `Success`, `Failure` — zawsze wewnątrz namespace operacji

Format `type`: `'[Context/Entity] operation verb'` — camelCase, małe litery po nawiasie.

```typescript
// dashboard-users.actions.ts
export namespace Dashboard {
  export namespace Users {

    export namespace Load {
      export const Request = ActionBuilder.define<LoadUsersPayload>(
        '[Dashboard/Users] load request',
      );
      export const Success = ActionBuilder.define<LoadUsersSuccessPayload>(
        '[Dashboard/Users] load success',
      );
      export const Failure = ActionBuilder.define<LoadUsersFailurePayload>(
        '[Dashboard/Users] load failure',
      );
    }

    export namespace Create {
      export const Request = ActionBuilder.define<CreateUserPayload>(
        '[Dashboard/Users] create request',
      );
      export const Success = ActionBuilder.define<CreateUserSuccessPayload>(
        '[Dashboard/Users] create success',
      );
      export const Failure = ActionBuilder.define<CreateUserFailurePayload>(
        '[Dashboard/Users] create failure',
      );
    }

    export namespace Delete {
      export const Request = ActionBuilder.define<DeleteUserPayload>(
        '[Dashboard/Users] delete request',
      );
      export const Success = ActionBuilder.define<DeleteUserSuccessPayload>(
        '[Dashboard/Users] delete success',
      );
      export const Failure = ActionBuilder.define<DeleteUserFailurePayload>(
        '[Dashboard/Users] delete failure',
      );
    }

    // Prosta akcja bez trójki async
    export const Reset = ActionBuilder.define('[Dashboard/Users] reset');

    export const Select = ActionBuilder.define<string>(
      '[Dashboard/Users] select',
    );

  }
}
```

### 2.3 Payload interfaces

Każdy payload definiuj jako osobny interface w pliku akcji lub dedykowanym pliku modeli. Nigdy nie używaj inline `{ field: Type }` jako generyka — to utrudnia refaktoryzację.

```typescript
// ✅ DOBRZE — nazwane interfejsy
export interface LoadUsersPayload {
  filters?: UserFilters;
}

export interface LoadUsersSuccessPayload {
  users: User[];
  total: number;
}

export interface LoadUsersFailurePayload {
  error: string;
}

// ❌ ŹLE — inline typy jako generyk
export const Request = ActionBuilder.define<{ filters?: UserFilters }>(
  '[Dashboard/Users] load request',
);
```

### 2.4 Akcje nie dotyczą widoku

Akcje opisują **co zrobić ze stanem** — nie sterują widokiem. Otwieranie dialogów, nawigacja, toasty — to efekty uboczne obsługiwane w komponentach (przez `.dispatch(...).subscribe()`) lub przez `Actions` stream.

```typescript
// ❌ ŹLE — logika UI w nazwie / intencji akcji
export namespace Users {
  export namespace Delete {
    export const RequestWithConfirm = ActionBuilder.define<string>(
      '[Users] delete with confirm dialog',
    );
  }
}

// ✅ DOBRZE — akcja zmienia tylko stan; komponent decyduje o UI
export namespace Users {
  export namespace Delete {
    export const Request = ActionBuilder.define<string>(
      '[Users] delete request',
    );
  }
}
```

---

## 3. State Model — model stanu

### 3.1 Tylko plain object literals — bez klas, bez Map/Set

State musi być serializowalny (Redux DevTools, rehydracja). Przechowuj wyłącznie plain object literals i prymitywy.

```typescript
// ✅ DOBRZE — plain interface
export interface UsersStateModel {
  users: User[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ❌ ŹLE — klasy, Map, Set — problemy z serializacją
export interface UsersStateModel {
  users: Map<string, User>;    // nie serializowalne
  selected: UserClass;         // instancja klasy — nie serializowalna
  ids: Set<string>;            // nie serializowalne
}
```

### 3.2 Flagi stanu operacji asynchronicznych

Dla każdej operacji async modeluj trzy stany: ładowanie, błąd, dane.

```typescript
export interface UsersStateModel {
  items: User[];
  isLoading: boolean;
  error: string | null;
}

export const USERS_STATE_DEFAULTS: UsersStateModel = {
  items: [],
  isLoading: false,
  error: null,
};
```

---

## 4. State — klasa stanu

### 4.1 Zasada: State tylko aktualizuje stan

`*-state.ts` zawiera **wyłącznie** aktualizacje stanu przez `patchState` / `setState`. Zero logiki biznesowej, zero wywołań API, zero serwisów. Handler `@Action` to mapowanie akcji na zmianę stanu — nic więcej.

Logika asynchroniczna (wywołania HTTP, orkiestracja, efekty uboczne) należy do `*-effects.service.ts`, który nasłuchuje na akcje przez `Actions` stream i dispatchuje akcje `Success` / `Failure`.

```
Komponent / Fasada
      ↓ dispatch(Request)
EffectsService          ← wywołuje API, obsługuje błędy, dispatchuje Success/Failure
      ↓ dispatch(Success | Failure)
State                   ← tylko aktualizuje stan na podstawie payload
```

### 4.2 Struktura klasy

```typescript
// users.state.ts
import { Injectable } from '@angular/core';
import { State, Action, StateContext } from '@ngxs/store';
import { Dashboard } from './dashboard-users.actions';

export interface UsersStateModel {
  items: User[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULTS: UsersStateModel = {
  items: [],
  isLoading: false,
  error: null,
};

@State<UsersStateModel>({
  name: 'users',
  defaults: DEFAULTS,
})
@Injectable()
export class UsersState {

  // ✅ Ustawia flagę ładowania — brak logiki, brak serwisów
  @Action(Dashboard.Users.Load.Request)
  public onLoadRequest(ctx: StateContext<UsersStateModel>): void {
    ctx.patchState({ isLoading: true, error: null });
  }

  // ✅ Zapisuje dane z payloadu — brak logiki, brak serwisów
  @Action(Dashboard.Users.Load.Success)
  public onLoadSuccess(
    ctx: StateContext<UsersStateModel>,
    { payload }: InstanceType<typeof Dashboard.Users.Load.Success>,
  ): void {
    ctx.patchState({ items: payload.users, isLoading: false });
  }

  // ✅ Zapisuje błąd z payloadu — brak logiki, brak serwisów
  @Action(Dashboard.Users.Load.Failure)
  public onLoadFailure(
    ctx: StateContext<UsersStateModel>,
    { payload }: InstanceType<typeof Dashboard.Users.Load.Failure>,
  ): void {
    ctx.patchState({ error: payload.error, isLoading: false });
  }

  @Action(Dashboard.Users.Reset)
  public onReset(ctx: StateContext<UsersStateModel>): void {
    ctx.patchState({ items: [], error: null, isLoading: false });
  }

}
```

```typescript
// ❌ ŹLE — wywołanie API w state
@Action(Dashboard.Users.Load.Request)
public onLoadRequest(ctx: StateContext<UsersStateModel>): Observable<void> {
  return this.usersApi.getAll().pipe(         // API w state — zabronione
    tap(users => ctx.patchState({ items: users })),
  );
}

// ❌ ŹLE — logika biznesowa w state
@Action(Dashboard.Users.Load.Success)
public onLoadSuccess(ctx: StateContext<UsersStateModel>, { payload }: ...): void {
  const filtered = payload.users.filter(u => u.isActive);  // logika — zabroniona
  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name)); // zabroniona
  ctx.patchState({ items: sorted });
}
```

Logika filtrowania i sortowania należy do selectorów lub serwisu efektów — nie do state.

### 4.3 Effects Service — orkiestrator logiki async

Effects service to główne miejsce logiki asynchronicznej i biznesowej. Pełni rolę **orkiestratora i agregatora** — reaguje na akcje, wywołuje API, podejmuje decyzje i dispatchuje wyniki.

Projekt używa własnego systemu efektów opartego na:
- abstrakcyjnej klasie bazowej `NgxsEffectsService`
- dekoratorze `@Effect(actions, options?)` rejestrującym metodę jako handler
- dekoratorze `@CustomEffect()` dla efektów bez powiązania z konkretną akcją
- typie `EffectOperator` sterującym strategią subskrypcji: `'switchMap'` (domyślny), `'exhaustMap'`, `'concatMap'`, `'mergeMap'`

```typescript
// users-effects.service.ts
@Injectable()
export class UsersEffectsService extends NgxsEffectsService {
  private readonly usersApi = inject(UsersApiService);
  private readonly store = inject(Store);

  // ✅ @Effect — powiązany z akcją; domyślny operator: switchMap
  @Effect([Dashboard.Users.Load.Request])
  protected dashboardUsersLoadEffect(
    { payload }: InstanceType<typeof Dashboard.Users.Load.Request>,
  ): Observable<unknown> {
    return this.usersApi.getAll(payload).pipe(
      tap(users =>
        this.store.dispatch(new Dashboard.Users.Load.Success({ users })),
      ),
      catchError(err => {
        this.store.dispatch(new Dashboard.Users.Load.Failure({ error: err.message }));
        return EMPTY;
      }),
    );
  }

  // ✅ exhaustMap — ignoruje nowe żądania gdy poprzednie trwa (np. submit formularza)
  @Effect([Dashboard.Users.Create.Request], { operator: 'exhaustMap' })
  protected dashboardUsersCreateEffect(
    { payload }: InstanceType<typeof Dashboard.Users.Create.Request>,
  ): Observable<unknown> {
    return this.usersApi.create(payload).pipe(
      tap(user =>
        this.store.dispatch(new Dashboard.Users.Create.Success({ user })),
      ),
      catchError(err => {
        this.store.dispatch(new Dashboard.Users.Create.Failure({ error: err.message }));
        return EMPTY;
      }),
    );
  }

  // ✅ concatMap — kolejkuje żądania, zachowuje kolejność (np. zapis sekwencyjny)
  @Effect([Dashboard.Users.Delete.Request], { operator: 'concatMap' })
  protected dashboardUsersDeleteEffect(
    { payload }: InstanceType<typeof Dashboard.Users.Delete.Request>,
  ): Observable<unknown> {
    return this.usersApi.delete(payload.id).pipe(
      tap(() =>
        this.store.dispatch(new Dashboard.Users.Delete.Success({ id: payload.id })),
      ),
      catchError(err => {
        this.store.dispatch(new Dashboard.Users.Delete.Failure({ error: err.message }));
        return EMPTY;
      }),
    );
  }
}
```

### 4.4 Cykl życia efektów — `init()` i `destroy()`

`NgxsEffectsService` dostarcza dwie metody zarządzające subskrypcjami:

- `init()` — uruchamia wszystkie efekty zarejestrowane przez `@Effect`; subskrybuje na akcje i zaczyna nasłuchiwać
- `destroy()` — anuluje wszystkie aktywne subskrypcje; woła `resetSubscriptions()` wewnętrznie

Efekty **nie startują automatycznie** — `init()` musi być wywołane explicite. Odpowiada za to `*-state-providers.ts` przez wstrzyknięcie effects service do serwisu stanu lub przez `APP_INITIALIZER`, albo sam serwis fasady wywołuje `init()` w konstruktorze.

Najczęstszy wzorzec — fasada inicjalizuje i niszczy efekty razem ze swoim cyklem życia:

```typescript
// feature-state.service.ts
@Injectable()
export class FeatureStateService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly effects = inject(FeatureEffectsService);

  constructor() {
    this.effects.init();  // start nasłuchiwania na akcje
  }

  public ngOnDestroy(): void {
    this.effects.destroy();  // anuluj wszystkie subskrypcje
  }

  // ... signals i metody dispatch
}
```

Jeśli feature ma wiele serwisów efektów, fasada inicjalizuje wszystkie:

```typescript
@Injectable()
export class FeatureStateService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly mainEffects = inject(FeatureEffectsService);
  private readonly otherEffects = inject(FeatureOtherEffectsService);

  constructor() {
    this.mainEffects.init();
    this.otherEffects.init();
  }

  public ngOnDestroy(): void {
    this.mainEffects.destroy();
    this.otherEffects.destroy();
  }
}
```

```typescript
// ❌ ŹLE — efekty nigdy nie zostały uruchomione
@Injectable()
export class FeatureStateService {
  private readonly effects = inject(FeatureEffectsService);
  // brak init() — @Effect metody nie nasłuchują na żadne akcje
}

// ❌ ŹLE — wyciek pamięci — subskrypcje nie są anulowane
@Injectable()
export class FeatureStateService {
  private readonly effects = inject(FeatureEffectsService);

  constructor() {
    this.effects.init();
    // brak destroy() — subskrypcje żyją wiecznie
  }
}
```



### 4.5 Wybór operatora efektu

| Operator | Kiedy używać | Przykład |
|---|---|---|
| `switchMap` | **Domyślny.** Anuluje poprzednie, bierze najnowsze | wyszukiwanie, filtrowanie listy |
| `exhaustMap` | Blokuje nowe gdy poprzednie trwa | submit formularza, płatność |
| `concatMap` | Kolejkuje — zachowuje kolejność | zapis sekwencyjny, operacje zależne od siebie |
| `mergeMap` | Wykonuje wszystkie równolegle | niezależne requesty bez kolejności |

```typescript
// ✅ switchMap (domyślny) — nie trzeba podawać operatora
@Effect([Dashboard.Users.Load.Request])
protected dashboardUsersLoadEffect(...): Observable<unknown> { ... }

// ✅ exhaustMap — jawne podanie operatora
@Effect([Dashboard.Users.Create.Request], { operator: 'exhaustMap' })
protected dashboardUsersCreateEffect(...): Observable<unknown> { ... }
```

### 4.6 Nazewnictwo

- Klasa state: `<Feature>State` (np. `UsersState`)
- Plik: `<feature>.state.ts` (np. `users.state.ts`)
- Nazwa w `@State`: `name: 'users'` — camelCase, unikalny w całej aplikacji
- Handlery akcji w state: prefiks `on` + nazwa akcji (np. `onLoadRequest`, `onLoadSuccess`)
- Metody efektów: pełna ścieżka namespace'u w camelCase + sufiks `Effect` (np. `dashboardUsersLoadEffect`, `dashboardUsersCreateEffect`)

### 4.7 `patchState` vs `setState`

- `patchState` — preferowane dla aktualizacji częściowych (płytki merge)
- `setState` z operatorem — dla złożonych aktualizacji zagnieżdżonych lub z logiką warunkową

```typescript
// ✅ patchState — preferowane dla prostych aktualizacji
ctx.patchState({ isLoading: false, items: payload.users });

// ✅ setState z operatorem — dla zagnieżdżonej struktury
import { patch, updateItem } from '@ngxs/store/operators';

ctx.setState(
  patch<UsersStateModel>({
    items: updateItem(u => u.id === payload.id, patch({ name: payload.name })),
  }),
);

// ❌ ŹLE — mutacja stanu bezpośrednio
const state = ctx.getState();
state.items.push(newUser);  // mutacja — błąd!
ctx.setState(state);
```

### 4.8 Wstrzykiwanie zależności

State nie wstrzykuje żadnych serwisów — nie ma żadnych zależności do wstrzyknięcia.

```typescript
// ✅ DOBRZE — state bez zależności
@State<UsersStateModel>({ name: 'users', defaults: DEFAULTS })
@Injectable()
export class UsersState {
  // brak inject() — celowe
}

// ❌ ŹLE — serwis w state
@State<UsersStateModel>({ name: 'users', defaults: DEFAULTS })
@Injectable()
export class UsersState {
  private readonly usersApi = inject(UsersApiService);  // zabronione
  private readonly router = inject(Router);             // zabronione
}
```

---

## 5. Selectors — selektory

### 5.1 Selektory w oddzielnej klasie

Selektory wydzielaj do osobnej klasy — nie zagnieżdżaj ich w klasie `@State`. To poprawia czytelność i umożliwia łatwiejsze testowanie.

```typescript
// users.selectors.ts
import { Selector, createPropertySelectors } from '@ngxs/store';

export class UsersSelectors {
  @Selector([UsersState])
  public static items(state: UsersStateModel): User[] {
    return state.items;
  }

  @Selector([UsersState])
  public static isLoading(state: UsersStateModel): boolean {
    return state.isLoading;
  }

  @Selector([UsersState])
  public static error(state: UsersStateModel): string | null {
    return state.error;
  }

  // Selektor pochodny — kompozycja
  @Selector([UsersSelectors.items])
  public static activeUsers(users: User[]): User[] {
    return users.filter(u => u.isActive);
  }

  @Selector([UsersSelectors.items])
  public static count(users: User[]): number {
    return users.length;
  }
}
```

### 5.2 `createPropertySelectors` dla prostych właściwości

```typescript
// ✅ Skrócona forma dla property selectors
export const UsersPropertySelectors = createPropertySelectors<UsersStateModel>(UsersState);
// Generuje: UsersPropertySelectors.items, .isLoading, .error
```

### 5.3 Selektory z parametrami

```typescript
// feature.selectors.ts
export class FeatureSelectors {
  @Selector([FeatureState])
  public static getUserById(state: UsersStateModel): (id: string) => User | undefined {
    return (id: string) => state.items.find(u => u.id === id);
  }
}
```

Selektor z parametrem udostępniany jest przez metodę fasady — komponent nigdy nie wywołuje `store.selectSignal` bezpośrednio.

```typescript
// feature-state.service.ts
@Injectable()
export class FeatureStateService {
  private readonly store = inject(Store);

  public getUserById(id: string): Signal<User | undefined> {
    return this.store.selectSignal(FeatureSelectors.getUserById(id));
  }
}
```

```typescript
// komponent — korzysta z fasady
@Component({ ... })
export class UserDetailComponent {
  protected readonly featureState = inject(FeatureStateService);
  protected readonly user = this.featureState.getUserById('123');
}
```

---

## 6. Fasada (`*.state.service.ts`) — jedyny punkt dostępu do stanu

**Komponenty nigdy nie wstrzykują `Store` bezpośrednio.** Cały dostęp do stanu — odczyt danych i wysyłanie akcji — odbywa się wyłącznie przez fasadę (`*.state.service.ts`). Fasada ukrywa przed komponentem: `Store`, selektory, akcje i namespace'y.

```typescript
// users-state.service.ts
@Injectable()
export class UsersStateService {
  private readonly store = inject(Store);

  // Publiczne signals — API odczytu danych
  public readonly users = this.store.selectSignal(UsersSelectors.items);
  public readonly isLoading = this.store.selectSignal(UsersSelectors.isLoading);
  public readonly error = this.store.selectSignal(UsersSelectors.error);
  public readonly count = this.store.selectSignal(UsersSelectors.count);

  // Publiczne metody — API wysyłania akcji
  public load(payload?: LoadUsersPayload): void {
    this.store.dispatch(new Dashboard.Users.Load.Request(payload));
  }

  public create(payload: CreateUserPayload): Observable<void> {
    return this.store.dispatch(new Dashboard.Users.Create.Request(payload));
  }

  public delete(payload: DeleteUserPayload): void {
    this.store.dispatch(new Dashboard.Users.Delete.Request(payload));
  }

  public reset(): void {
    this.store.dispatch(new Dashboard.Users.Reset());
  }
}
```

```typescript
// ✅ DOBRZE — komponent wstrzykuje fasadę
@Component({ ... })
export class UsersListComponent {
  protected readonly usersState = inject(UsersStateService);

  protected ngOnInit(): void {
    this.usersState.load();
  }
}
```

```html
@if (usersState.isLoading()) {
  <app-spinner />
} @else if (usersState.error()) {
  <app-error [message]="usersState.error()!" />
} @else {
  @for (user of usersState.users(); track user.id) {
    <app-user-item [user]="user" />
  }
}
```

```typescript
// ❌ ŹLE — Store bezpośrednio w komponencie
@Component({ ... })
export class UsersListComponent {
  private readonly store = inject(Store);  // zabronione w komponentach

  protected readonly users = this.store.selectSignal(UsersSelectors.items);

  protected load(): void {
    this.store.dispatch(new Dashboard.Users.Load.Request());
  }
}
```

### `selectSnapshot` — tylko poza kontekstem reaktywnym

Wyjątek od reguły: `selectSnapshot` jest dopuszczalne bezpośrednio w interceptorach i guardach, gdzie fasada nie ma sensu.

```typescript
// ✅ selectSnapshot — interceptor, jednorazowy odczyt poza reaktywnym kontekstem
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly store = inject(Store);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.store.selectSnapshot(AuthSelectors.token);
    // ...
  }
}
```

---

## 7. Dispatch — wysyłanie akcji

Dispatch odbywa się wyłącznie przez metody fasady (`*.state.service.ts`). Bezpośrednie wywołanie `store.dispatch()` jest dozwolone tylko wewnątrz fasady oraz w effects service.

```typescript
// ✅ DOBRZE — dispatch przez metodę fasady
@Component({ ... })
export class UserFormComponent {
  protected readonly usersState = inject(UsersStateService);

  protected onSubmit(data: CreateUserPayload): void {
    this.usersState.create(data);
  }

  protected onDelete(id: string): void {
    this.usersState.delete({ id });
  }
}

// ❌ ŹLE — dispatch bezpośrednio w komponencie
@Component({ ... })
export class UserFormComponent {
  private readonly store = inject(Store);  // zabronione

  protected onSubmit(data: CreateUserPayload): void {
    this.store.dispatch(new Dashboard.Users.Create.Request(data));  // zabronione
  }
}
```

Fasada może zwracać `Observable<void>` z `store.dispatch()` gdy komponent musi czekać na zakończenie:

```typescript
// users-state.service.ts
public create(payload: CreateUserPayload): Observable<void> {
  return this.store.dispatch(new Dashboard.Users.Create.Request(payload));
}

// komponent
protected onSubmit(data: CreateUserPayload): void {
  this.usersState.create(data).subscribe(() => {
    this.router.navigate(['/users']);
  });
}
```

---

## 8. Fasada (`*.state.service.ts`) — konwencja

Fasada nie jest opcjonalna — to **jedyny punkt styku komponentu ze stanem**. Każdy feature state ma odpowiadający mu `*.state.service.ts` rejestrowany przez `*-state-providers.ts`.

Fasada udostępnia:
- `Signal<T>` przez `selectSignal` — odczyt danych reaktywny
- `Observable<void>` przez `store.dispatch()` — gdy komponent musi czekać na zakończenie
- `void` przez `store.dispatch()` — dla operacji fire-and-forget

```typescript
// users-state.service.ts
@Injectable()
export class UsersStateService {
  private readonly store = inject(Store);

  // Signals — odczyt reaktywny
  public readonly users = this.store.selectSignal(UsersSelectors.items);
  public readonly isLoading = this.store.selectSignal(UsersSelectors.isLoading);
  public readonly error = this.store.selectSignal(UsersSelectors.error);

  // Selektory z parametrem — computed w komponencie lub metodą fasady
  public getUserById(id: string): Signal<User | undefined> {
    return this.store.selectSignal(UsersSelectors.getUserById(id));
  }

  // Dispatch — metody publiczne
  public load(payload?: LoadUsersPayload): void {
    this.store.dispatch(new Dashboard.Users.Load.Request(payload));
  }

  public create(payload: CreateUserPayload): Observable<void> {
    return this.store.dispatch(new Dashboard.Users.Create.Request(payload));
  }

  public delete(payload: DeleteUserPayload): void {
    this.store.dispatch(new Dashboard.Users.Delete.Request(payload));
  }

  public reset(): void {
    this.store.dispatch(new Dashboard.Users.Reset());
  }
}
```

---

## 9. Rejestracja stanu — State Providers

Każdy feature state rejestrowany jest przez dedykowaną funkcję providers w osobnym pliku. Funkcja zwraca tablicę `Provider | EnvironmentProviders` — rejestruje state, serwisy efektów, API i fasadę jako jedną spójną jednostkę.

```typescript
// users-state-providers.ts
export function usersStateProviders(): Array<Provider | EnvironmentProviders> {
  return [
    UsersEffectsService,
    UsersApiService,
    UsersStateService,
    provideStates([UsersState]),
  ];
}
```

Funkcja providers jest wywoływana w `app.config.ts` dla stanów globalnych lub w definicji trasy dla stanów lazy-loaded:

```typescript
// app.config.ts — stany globalne
import { provideStore } from '@ngxs/store';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      [],
      withNgxsReduxDevtoolsPlugin(),  // tylko w development
    ),
    usersStateProviders(),
    authStateProviders(),
  ],
};
```

```typescript
// feature.routes.ts — stany lazy-loaded (rejestrowane razem z trasą)
export const featureRoutes: Routes = [
  {
    path: 'users',
    loadComponent: () =>
      import('./users-page.component').then(m => m.UsersPageComponent),
    providers: [usersStateProviders()],
  },
];
```

### Zasady

- Każdy state ma własny plik `<feature>-state-providers.ts` — jeden plik, jedna funkcja
- Funkcja providers rejestruje **wszystko** co potrzebne do działania tego slice'a stanu: state, serwisy efektów, serwisy API, serwis stanu
- Nie rejestruj stanów bezpośrednio w `provideStore([...])` — używaj osobnych funkcji providers
- Nazewnictwo: `<feature>StateProviders()` — camelCase, sufiks `StateProviders`

---

## 10. Struktura folderu stanu

Każdy feature state żyje we własnym folderze `state/`. Folder zawiera zawsze te same typy plików — ich liczba zależy od złożoności feature'u.

```
feature/
└── state/
    ├── api/                                          # Serwisy HTTP — może być wiele plików
    │   ├── users-api.service.ts
    │   └── users-roles-api.service.ts
    ├── payloads/                                     # Interfejsy payloadów — może być wiele plików
    │   ├── load-users.payload.ts
    │   └── create-user.payload.ts
    ├── feature-actions.ts               # Definicje akcji (ActionBuilder + namespace)
    ├── feature-effects.service.ts      # Efekty — może być wiele plików
    ├── feature-other-effects.service.ts
    ├── feature-selectors.ts             # Selektory
    ├── feature-state.service.ts         # Fasada — może być wiele plików
    ├── feature-other-state.service.ts
    ├── feature-state.ts                 # Klasa @State — jeden plik
    ├── feature-state-providers.ts       # Rejestracja state i serwisów
    └── index.ts                                      # Publiczne API folderu
```

### Odpowiedzialność każdego typu pliku

| Plik | Liczność | Odpowiedzialność |
|---|---|---|
| `api/` | **wiele plików** | Serwisy HTTP pogrupowane tematycznie; tylko wywołania HTTP i mapowanie odpowiedzi |
| `payloads/` | **wiele plików** | Interfejsy payloadów akcji pogrupowane per operacja |
| `*.actions.ts` | jeden | Wszystkie akcje feature'u w namespace'ach |
| `*.effects.service.ts` | **wiele plików** | Logika async pogrupowana tematycznie; każdy rozszerza `NgxsEffectsService` |
| `*.selectors.ts` | jeden | Klasa selektorów z `public static` metodami `@Selector` |
| `*.state.service.ts` | **wiele plików** | Fasady pogrupowane tematycznie; każda eksponuje signals i metody dispatch |
| `*.state.ts` | jeden | Klasa `@State` — wyłącznie `patchState`/`setState`, zero logiki i serwisów |
| `*-state-providers.ts` | jeden | Funkcja rejestrująca **wszystkie** serwisy i state tego folderu |
| `index.ts` | jeden | Barrel export — eksportuje wszystko co publiczne: providers, fasady, selektory, akcje, modele |

### `index.ts` — publiczne API folderu

`index.ts` eksportuje wszystko co jest publiczne ze stanu — providers, fasady, selektory, akcje i modele. Komponenty i inne części aplikacji importują wyłącznie przez ten plik.

```typescript
// feature/state/index.ts
export { featureStateProviders } from './feature-state-providers';

// Fasady
export { FeatureStateService } from './feature-state.service';
export { FeatureOtherStateService } from './feature-other-state.service';

// Selektory
export { FeatureSelectors } from './feature-selectors';

// Akcje
export { Feature } from './feature-actions';

// Modele / typy stanu
export type { FeatureStateModel } from './feature-state';
```

### `*-state-providers.ts` — rejestruje wszystko

Niezależnie od liczby serwisów, jeden plik providers rejestruje je wszystkie:

```typescript
// feature-state-providers.ts
export function featureStateProviders(): Array<Provider | EnvironmentProviders> {
  return [
    // effects — wszystkie serwisy efektów
    FeatureEffectsService,
    FeatureOtherEffectsService,
    // api — wszystkie serwisy HTTP
    FeatureApiService,
    FeatureRolesApiService,
    // state services (fasady) — wszystkie fasady
    FeatureStateService,
    FeatureOtherStateService,
    // state
    provideStates([FeatureState]),
  ];
}
```

---

## 11. Wzorce do unikania

| Antywzorzec | Właściwe podejście |
|---|---|
| Ręczne klasy akcji bez `ActionBuilder` | `ActionBuilder.define<Payload>(type)` |
| Płaskie klasy akcji z powtarzającym się prefiksem | Namespace'y: `Feature.Entity.Operation.Request/Success/Failure` |
| Brak `[Scope]` w `type` akcji | Format `'[Context/Entity] operation verb'` |
| Inline typy jako generyk w `ActionBuilder.define` | Nazwane interfejsy payloadu |
| Instancje klas w state | Plain object literals i interfejsy |
| `Map`, `Set` w state | Zwykłe tablice i obiekty |
| Mutacja stanu (`state.x = y`) | `patchState` / `setState` z operatorem |
| Selektory w klasie `@State` | Osobna klasa selektorów |
| `select` (Observable) w komponentach Angular 21 | `selectSignal` |
| `selectSnapshot` w komponentach | `selectSignal` |
| `Store` wstrzykiwany bezpośrednio w komponentach | Wyłącznie przez fasadę (`*.state.service.ts`) |
| `store.dispatch()` bezpośrednio w komponencie | Przez metodę fasady |
| `store.selectSignal()` bezpośrednio w komponencie | Przez property fasady |
| Akcje sterujące widokiem (dialogi, toasty) | Logika widoku w komponencie, akcja zmienia tylko stan |
| Ręczna subskrypcja `Actions` stream bez `NgxsEffectsService` | Rozszerz `NgxsEffectsService` i użyj `@Effect` |
| Brak wyboru operatora — zawsze `switchMap` | Dobierz operator do przypadku: `exhaustMap`, `concatMap`, `mergeMap` |
| Logika biznesowa w handlerach `@Action` | Przenieś do effects service lub selectorów |
| Wstrzykiwanie serwisów w `@State` | State nie ma zależności — `inject()` tylko w effects |
| Rejestracja state bezpośrednio w `provideStore([...])` | Dedykowana funkcja `<Feature>StateProviders()` w osobnym pliku |
| Brak `public` na metodach selektorów | Zawsze `public static` na metodach `@Selector` |
| Brak trójki Load/Success/Failure | Zawsze modeluj 3 stany async operacji |

---

## Szybka ściągawka dla AI

Gdy generujesz kod NGXS:

1. **Akcje** — `ActionBuilder.define<Payload>(type)` zamiast ręcznych klas; namespace'y: `Feature.Entity.Operation.Request/Success/Failure`; `type` w formacie `'[Context/Entity] operation verb'`; payload jako nazwany interface; akcje nie sterują widokiem
2. **State Model** — plain `interface` + obiekt defaults; wyłącznie serializowalne dane (no `Map`, `Set`, klas)
3. **State class** — `@State` + `@Injectable()`; **zero logiki, zero serwisów, zero wywołań API**; handlery `@Action` tylko `patchState`/`setState`; brak `inject()` — state nie ma zależności; prefiks `on` dla nazw handlerów (`onLoadRequest`, `onLoadSuccess`)
4. **Effects Service** — rozszerza `NgxsEffectsService`; logika async i biznesowa; dekorator `@Effect([Action], { operator })` rejestruje handler; nazwa metody: pełna ścieżka namespace'u + `Effect` (np. `dashboardUsersLoadEffect`); `init()` uruchamia efekty, `destroy()` anuluje subskrypcje — wywoływane przez fasadę w konstruktorze i `ngOnDestroy()`; domyślny operator `switchMap`
5. **Selectors** — osobna klasa poza `@State`; zawsze `public static` na metodach `@Selector([...])`
6. **Fasada (`*.state.service.ts`)** — **jedyny punkt dostępu do stanu dla komponentów**; eksponuje `Signal<T>` przez `selectSignal` i metody dispatch; komponenty nigdy nie wstrzykują `Store` bezpośrednio
7. **Dispatch** — wyłącznie przez metody fasady; `store.dispatch()` dozwolone tylko wewnątrz fasady i effects service; `selectSnapshot` tylko w interceptorach/guardach
8. **State Providers** — każdy feature ma `<feature>StateProviders()` w `<feature>-state-providers.ts`; rejestruje state + serwisy razem; wywoływana bezpośrednio w `providers` tablicy
9. **Struktura folderu** — `state/api/`, `state/payloads/`, `*.actions.ts`, `*.effects.service.ts`, `*.selectors.ts`, `*.state.service.ts`, `*.state.ts`, `*-state-providers.ts`, `index.ts`
