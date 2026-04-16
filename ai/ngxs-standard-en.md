# NGXS Coding Standard
> State management standard with NGXS for AI code generation.  
> Version: 1.1 | Sources: ngxs.io Style Guide, ngxs.io docs, community best practices 2025.  
> Use together with TypeScript Standard and Angular 21 Standard.

---

## 1. Four NGXS Concepts

NGXS is built around four concepts that must be strictly separated:

- **Store** — global state container; the only place to `dispatch` actions and `select` data
- **State** — class defining a slice of state and handling actions (`@Action`)
- **Action** — class describing what should happen; carries data needed to change the state
- **Selector** — pure function that extracts and transforms a slice of state; automatically memoized

---

## 2. Actions

### 2.1 ActionBuilder — helper class

All actions are created via `ActionBuilder.define()`. This eliminates constructor boilerplate and enforces a consistent action shape throughout the application.

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

### 2.2 Grouping actions in namespaces

Actions are grouped in nested namespaces:
- level 1 — context / page / module (e.g. `Dashboard`)
- level 2 — domain entity (e.g. `Users`)
- level 3 — operation (e.g. `Load`)
- `Request`, `Success`, `Failure` constants — always inside the operation namespace

`type` format: `'[Context/Entity] operation verb'` — camelCase, lowercase after the bracket.

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

    // Simple action without async triplet
    export const Reset = ActionBuilder.define('[Dashboard/Users] reset');

    export const Select = ActionBuilder.define<string>(
      '[Dashboard/Users] select',
    );

  }
}
```

### 2.3 Payload interfaces

Define each payload as a separate interface in the actions file or a dedicated models file. Never use inline `{ field: Type }` as a generic — it makes refactoring harder.

```typescript
// ✅ GOOD — named interfaces
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

// ❌ BAD — inline types as generic
export const Request = ActionBuilder.define<{ filters?: UserFilters }>(
  '[Dashboard/Users] load request',
);
```

### 2.4 Actions are not view-concerned

Actions describe **what to do with the state** — they do not control the view. Opening dialogs, navigation, toasts — these are side effects handled in components (via `.dispatch(...).subscribe()`) or through the `Actions` stream.

```typescript
// ❌ BAD — UI logic in the action name / intent
export namespace Users {
  export namespace Delete {
    export const RequestWithConfirm = ActionBuilder.define<string>(
      '[Users] delete with confirm dialog',
    );
  }
}

// ✅ GOOD — action only changes state; component decides on UI
export namespace Users {
  export namespace Delete {
    export const Request = ActionBuilder.define<string>(
      '[Users] delete request',
    );
  }
}
```

---

## 3. State Model

### 3.1 Plain object literals only — no classes, no Map/Set

State must be serializable (Redux DevTools, rehydration). Store only plain object literals and primitives.

```typescript
// ✅ GOOD — plain interface
export interface UsersStateModel {
  users: User[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ❌ BAD — classes, Map, Set — serialization issues
export interface UsersStateModel {
  users: Map<string, User>;    // not serializable
  selected: UserClass;         // class instance — not serializable
  ids: Set<string>;            // not serializable
}
```

### 3.2 State flags for async operations

For each async operation, model three states: loading, error, data.

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

## 4. State — state class

### 4.1 Rule: State only updates state

`*-state.ts` contains **exclusively** state updates via `patchState` / `setState`. Zero business logic, zero API calls, zero services. An `@Action` handler is a mapping from action to state change — nothing more.

Asynchronous logic (HTTP calls, orchestration, side effects) belongs in `*-effects.service.ts`, which listens for actions via the `Actions` stream and dispatches `Success` / `Failure` actions.

```
Component / Facade
      ↓ dispatch(Request)
EffectsService          ← calls API, handles errors, dispatches Success/Failure
      ↓ dispatch(Success | Failure)
State                   ← only updates state based on payload
```

### 4.2 Class structure

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

  // ✅ Sets loading flag — no logic, no services
  @Action(Dashboard.Users.Load.Request)
  public onLoadRequest(ctx: StateContext<UsersStateModel>): void {
    ctx.patchState({ isLoading: true, error: null });
  }

  // ✅ Saves data from payload — no logic, no services
  @Action(Dashboard.Users.Load.Success)
  public onLoadSuccess(
    ctx: StateContext<UsersStateModel>,
    { payload }: InstanceType<typeof Dashboard.Users.Load.Success>,
  ): void {
    ctx.patchState({ items: payload.users, isLoading: false });
  }

  // ✅ Saves error from payload — no logic, no services
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
// ❌ BAD — API call in state
@Action(Dashboard.Users.Load.Request)
public onLoadRequest(ctx: StateContext<UsersStateModel>): Observable<void> {
  return this.usersApi.getAll().pipe(         // API in state — forbidden
    tap(users => ctx.patchState({ items: users })),
  );
}

// ❌ BAD — business logic in state
@Action(Dashboard.Users.Load.Success)
public onLoadSuccess(ctx: StateContext<UsersStateModel>, { payload }: ...): void {
  const filtered = payload.users.filter(u => u.isActive);  // logic — forbidden
  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name)); // forbidden
  ctx.patchState({ items: sorted });
}
```

Filtering and sorting logic belongs in selectors or the effects service — not in state.

### 4.3 Effects Service — async logic orchestrator

The effects service is the primary home for asynchronous and business logic. It acts as an **orchestrator and aggregator** — it reacts to actions, calls APIs, makes decisions, and dispatches results.

The project uses a custom effects system based on:
- abstract base class `NgxsEffectsService`
- `@Effect(actions, options?)` decorator registering a method as a handler
- `@CustomEffect()` decorator for effects not tied to a specific action
- `EffectOperator` type controlling subscription strategy: `'switchMap'` (default), `'exhaustMap'`, `'concatMap'`, `'mergeMap'`

```typescript
// users-effects.service.ts
@Injectable()
export class UsersEffectsService extends NgxsEffectsService {
  private readonly usersApi = inject(UsersApiService);
  private readonly store = inject(Store);

  // ✅ @Effect — bound to an action; default operator: switchMap
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

  // ✅ exhaustMap — ignores new requests while previous is in flight (e.g. form submit)
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

  // ✅ concatMap — queues requests, preserves order (e.g. sequential save)
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

### 4.4 Effects lifecycle — `init()` and `destroy()`

`NgxsEffectsService` provides two methods for managing subscriptions:

- `init()` — starts all effects registered via `@Effect`; subscribes to actions and begins listening
- `destroy()` — cancels all active subscriptions; calls `resetSubscriptions()` internally

Effects **do not start automatically** — `init()` must be called explicitly. This is handled by `*-state-providers.ts` by injecting the effects service into the state service or via `APP_INITIALIZER`, or the facade service itself calls `init()` in its constructor.

The most common pattern — the facade initializes and destroys effects along with its own lifecycle:

```typescript
// feature-state.service.ts
@Injectable()
export class FeatureStateService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly effects = inject(FeatureEffectsService);

  constructor() {
    this.effects.init();  // start listening for actions
  }

  public ngOnDestroy(): void {
    this.effects.destroy();  // cancel all subscriptions
  }

  // ... signals and dispatch methods
}
```

If the feature has multiple effects services, the facade initializes all of them:

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
// ❌ BAD — effects were never started
@Injectable()
export class FeatureStateService {
  private readonly effects = inject(FeatureEffectsService);
  // no init() — @Effect methods are not listening for any actions
}

// ❌ BAD — memory leak — subscriptions are never cancelled
@Injectable()
export class FeatureStateService {
  private readonly effects = inject(FeatureEffectsService);

  constructor() {
    this.effects.init();
    // no destroy() — subscriptions live forever
  }
}
```

### 4.5 Choosing the effect operator

| Operator | When to use | Example |
|---|---|---|
| `switchMap` | **Default.** Cancels previous, takes the latest | search, list filtering |
| `exhaustMap` | Blocks new while previous is in flight | form submit, payment |
| `concatMap` | Queues — preserves order | sequential save, interdependent operations |
| `mergeMap` | Executes all in parallel | independent requests without ordering |

```typescript
// ✅ switchMap (default) — no need to specify operator
@Effect([Dashboard.Users.Load.Request])
protected dashboardUsersLoadEffect(...): Observable<unknown> { ... }

// ✅ exhaustMap — operator specified explicitly
@Effect([Dashboard.Users.Create.Request], { operator: 'exhaustMap' })
protected dashboardUsersCreateEffect(...): Observable<unknown> { ... }
```

### 4.6 Naming conventions

- State class: `<Feature>State` (e.g. `UsersState`)
- File: `<feature>.state.ts` (e.g. `users.state.ts`)
- Name in `@State`: `name: 'users'` — camelCase, unique across the whole application
- Action handlers in state: `on` prefix + action name (e.g. `onLoadRequest`, `onLoadSuccess`)
- Effect methods: full namespace path in camelCase + `Effect` suffix (e.g. `dashboardUsersLoadEffect`, `dashboardUsersCreateEffect`)

### 4.7 `patchState` vs `setState`

- `patchState` — preferred for partial updates (shallow merge)
- `setState` with operator — for complex nested updates or conditional logic

```typescript
// ✅ patchState — preferred for simple updates
ctx.patchState({ isLoading: false, items: payload.users });

// ✅ setState with operator — for nested structure
import { patch, updateItem } from '@ngxs/store/operators';

ctx.setState(
  patch<UsersStateModel>({
    items: updateItem(u => u.id === payload.id, patch({ name: payload.name })),
  }),
);

// ❌ BAD — direct state mutation
const state = ctx.getState();
state.items.push(newUser);  // mutation — error!
ctx.setState(state);
```

### 4.8 Dependency injection

State does not inject any services — it has no dependencies to inject.

```typescript
// ✅ GOOD — state without dependencies
@State<UsersStateModel>({ name: 'users', defaults: DEFAULTS })
@Injectable()
export class UsersState {
  // no inject() — intentional
}

// ❌ BAD — service in state
@State<UsersStateModel>({ name: 'users', defaults: DEFAULTS })
@Injectable()
export class UsersState {
  private readonly usersApi = inject(UsersApiService);  // forbidden
  private readonly router = inject(Router);             // forbidden
}
```

---

## 5. Selectors

### 5.1 Selectors in a separate class

Extract selectors into a separate class — do not nest them inside the `@State` class. This improves readability and makes testing easier.

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

  // Derived selector — composition
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

### 5.2 `createPropertySelectors` for simple properties

```typescript
// ✅ Shorthand for property selectors
export const UsersPropertySelectors = createPropertySelectors<UsersStateModel>(UsersState);
// Generates: UsersPropertySelectors.items, .isLoading, .error
```

### 5.3 Selectors with parameters

```typescript
// feature.selectors.ts
export class FeatureSelectors {
  @Selector([FeatureState])
  public static getUserById(state: UsersStateModel): (id: string) => User | undefined {
    return (id: string) => state.items.find(u => u.id === id);
  }
}
```

A parameterized selector is exposed through a facade method — a component never calls `store.selectSignal` directly.

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
// component — uses the facade
@Component({ ... })
export class UserDetailComponent {
  protected readonly featureState = inject(FeatureStateService);
  protected readonly user = this.featureState.getUserById('123');
}
```

---

## 6. Facade (`*.state.service.ts`) — single point of access to state

**Components never inject `Store` directly.** All access to state — reading data and dispatching actions — goes exclusively through the facade (`*.state.service.ts`). The facade hides from the component: `Store`, selectors, actions, and namespaces.

```typescript
// users-state.service.ts
@Injectable()
export class UsersStateService {
  private readonly store = inject(Store);

  // Public signals — data read API
  public readonly users = this.store.selectSignal(UsersSelectors.items);
  public readonly isLoading = this.store.selectSignal(UsersSelectors.isLoading);
  public readonly error = this.store.selectSignal(UsersSelectors.error);
  public readonly count = this.store.selectSignal(UsersSelectors.count);

  // Public methods — action dispatch API
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
// ✅ GOOD — component injects facade
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
// ❌ BAD — Store directly in component
@Component({ ... })
export class UsersListComponent {
  private readonly store = inject(Store);  // forbidden in components

  protected readonly users = this.store.selectSignal(UsersSelectors.items);

  protected load(): void {
    this.store.dispatch(new Dashboard.Users.Load.Request());
  }
}
```

### `selectSnapshot` — only outside reactive context

Exception to the rule: `selectSnapshot` is acceptable directly in interceptors and guards, where a facade does not make sense.

```typescript
// ✅ selectSnapshot — interceptor, one-time read outside reactive context
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

## 7. Dispatch — dispatching actions

Dispatch happens exclusively through facade methods (`*.state.service.ts`). Direct `store.dispatch()` calls are only allowed inside the facade and effects service.

```typescript
// ✅ GOOD — dispatch via facade method
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

// ❌ BAD — dispatch directly in component
@Component({ ... })
export class UserFormComponent {
  private readonly store = inject(Store);  // forbidden

  protected onSubmit(data: CreateUserPayload): void {
    this.store.dispatch(new Dashboard.Users.Create.Request(data));  // forbidden
  }
}
```

The facade can return `Observable<void>` from `store.dispatch()` when the component needs to wait for completion:

```typescript
// users-state.service.ts
public create(payload: CreateUserPayload): Observable<void> {
  return this.store.dispatch(new Dashboard.Users.Create.Request(payload));
}

// component
protected onSubmit(data: CreateUserPayload): void {
  this.usersState.create(data).subscribe(() => {
    this.router.navigate(['/users']);
  });
}
```

---

## 8. Facade (`*.state.service.ts`) — convention

The facade is not optional — it is the **only point of contact between a component and the state**. Every feature state has a corresponding `*.state.service.ts` registered through `*-state-providers.ts`.

The facade exposes:
- `Signal<T>` via `selectSignal` — reactive data read
- `Observable<void>` via `store.dispatch()` — when the component needs to wait for completion
- `void` via `store.dispatch()` — for fire-and-forget operations

```typescript
// users-state.service.ts
@Injectable()
export class UsersStateService {
  private readonly store = inject(Store);

  // Signals — reactive read
  public readonly users = this.store.selectSignal(UsersSelectors.items);
  public readonly isLoading = this.store.selectSignal(UsersSelectors.isLoading);
  public readonly error = this.store.selectSignal(UsersSelectors.error);

  // Selectors with parameter — computed in component or via facade method
  public getUserById(id: string): Signal<User | undefined> {
    return this.store.selectSignal(UsersSelectors.getUserById(id));
  }

  // Dispatch — public methods
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

## 9. State Registration — State Providers

Each feature state is registered via a dedicated providers function in a separate file. The function returns an array of `Provider | EnvironmentProviders` — registering the state, effects services, API services, and facade as one cohesive unit.

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

The providers function is called in `app.config.ts` for global states or in route definitions for lazy-loaded states:

```typescript
// app.config.ts — global states
import { provideStore } from '@ngxs/store';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      [],
      withNgxsReduxDevtoolsPlugin(),  // development only
    ),
    usersStateProviders(),
    authStateProviders(),
  ],
};
```

```typescript
// feature.routes.ts — lazy-loaded states (registered alongside the route)
export const featureRoutes: Routes = [
  {
    path: 'users',
    loadComponent: () =>
      import('./users-page.component').then(m => m.UsersPageComponent),
    providers: [usersStateProviders()],
  },
];
```

### Rules

- Each state has its own `<feature>-state-providers.ts` file — one file, one function
- The providers function registers **everything** needed for that state slice to work: state, effects services, API services, state service
- Do not register states directly in `provideStore([...])` — use separate providers functions
- Naming: `<feature>StateProviders()` — camelCase, `StateProviders` suffix

---

## 10. State Folder Structure

Each feature state lives in its own `state/` folder. The folder always contains the same types of files — the number of each depends on the feature's complexity.

```
feature/
└── state/
    ├── api/                                          # HTTP services — can be multiple files
    │   ├── users-api.service.ts
    │   └── users-roles-api.service.ts
    ├── payloads/                                     # Payload interfaces — can be multiple files
    │   ├── load-users.payload.ts
    │   └── create-user.payload.ts
    ├── feature-actions.ts               # Action definitions (ActionBuilder + namespaces)
    ├── feature-effects.service.ts      # Effects — can be multiple files
    ├── feature-other-effects.service.ts
    ├── feature-selectors.ts             # Selectors
    ├── feature-state.service.ts         # Facade — can be multiple files
    ├── feature-other-state.service.ts
    ├── feature-state.ts                 # @State class — single file
    ├── feature-state-providers.ts       # State and services registration
    └── index.ts                                      # Public API of the folder
```

### Responsibility of each file type

| File | Cardinality | Responsibility |
|---|---|---|
| `api/` | **multiple files** | HTTP services grouped by topic; only HTTP calls and response mapping |
| `payloads/` | **multiple files** | Action payload interfaces grouped per operation |
| `*.actions.ts` | single | All feature actions in namespaces |
| `*.effects.service.ts` | **multiple files** | Async logic grouped by topic; each extends `NgxsEffectsService` |
| `*.selectors.ts` | single | Selectors class with `public static` `@Selector` methods |
| `*.state.service.ts` | **multiple files** | Facades grouped by topic; each exposes signals and dispatch methods |
| `*.state.ts` | single | `@State` class — only `patchState`/`setState`, zero logic and services |
| `*-state-providers.ts` | single | Function registering **all** services and state in this folder |
| `index.ts` | single | Barrel export — exports everything public: providers, facades, selectors, actions, models |

### `index.ts` — public API of the folder

`index.ts` exports everything that is public from the state — providers, facades, selectors, actions, and models. Components and other parts of the application import exclusively through this file.

```typescript
// feature/state/index.ts
export { featureStateProviders } from './feature-state-providers';

// Facades
export { FeatureStateService } from './feature-state.service';
export { FeatureOtherStateService } from './feature-other-state.service';

// Selectors
export { FeatureSelectors } from './feature-selectors';

// Actions
export { Feature } from './feature-actions';

// State models / types
export type { FeatureStateModel } from './feature-state';
```

### `*-state-providers.ts` — registers everything

Regardless of the number of services, a single providers file registers them all:

```typescript
// feature-state-providers.ts
export function featureStateProviders(): Array<Provider | EnvironmentProviders> {
  return [
    // effects — all effects services
    FeatureEffectsService,
    FeatureOtherEffectsService,
    // api — all HTTP services
    FeatureApiService,
    FeatureRolesApiService,
    // state services (facades) — all facades
    FeatureStateService,
    FeatureOtherStateService,
    // state
    provideStates([FeatureState]),
  ];
}
```

---

## 11. Anti-patterns to Avoid

| Anti-pattern | Correct approach |
|---|---|
| Manual action classes without `ActionBuilder` | `ActionBuilder.define<Payload>(type)` |
| Flat action classes with repeated prefix | Namespaces: `Feature.Entity.Operation.Request/Success/Failure` |
| Missing `[Scope]` in action `type` | Format `'[Context/Entity] operation verb'` |
| Inline types as generic in `ActionBuilder.define` | Named payload interfaces |
| Class instances in state | Plain object literals and interfaces |
| `Map`, `Set` in state | Regular arrays and objects |
| State mutation (`state.x = y`) | `patchState` / `setState` with operator |
| Selectors in the `@State` class | Separate selectors class |
| `select` (Observable) in Angular 21 components | `selectSignal` |
| `selectSnapshot` in components | `selectSignal` |
| `Store` injected directly in components | Only through facade (`*.state.service.ts`) |
| `store.dispatch()` directly in component | Through facade method |
| `store.selectSignal()` directly in component | Through facade property |
| Actions controlling view (dialogs, toasts) | View logic in component, action only changes state |
| Manual `Actions` stream subscription without `NgxsEffectsService` | Extend `NgxsEffectsService` and use `@Effect` |
| Not choosing operator — always `switchMap` | Pick operator for the case: `exhaustMap`, `concatMap`, `mergeMap` |
| Business logic in `@Action` handlers | Move to effects service or selectors |
| Injecting services in `@State` | State has no dependencies — `inject()` only in effects |
| Registering state directly in `provideStore([...])` | Dedicated `<Feature>StateProviders()` function in a separate file |
| Missing `public` on selector methods | Always `public static` on `@Selector` methods |
| Missing Load/Success/Failure triplet | Always model 3 states for async operations |

---

## Quick Reference for AI

When generating NGXS code:

1. **Actions** — `ActionBuilder.define<Payload>(type)` instead of manual classes; namespaces: `Feature.Entity.Operation.Request/Success/Failure`; `type` in format `'[Context/Entity] operation verb'`; payload as named interface; actions do not control view
2. **State Model** — plain `interface` + defaults object; only serializable data (no `Map`, `Set`, classes)
3. **State class** — `@State` + `@Injectable()`; **zero logic, zero services, zero API calls**; `@Action` handlers use only `patchState`/`setState`; no `inject()` — state has no dependencies; `on` prefix for handler names (`onLoadRequest`, `onLoadSuccess`)
4. **Effects Service** — extends `NgxsEffectsService`; async and business logic; `@Effect([Action], { operator })` decorator registers a handler; method name: full namespace path + `Effect` suffix (e.g. `dashboardUsersLoadEffect`); `init()` starts effects, `destroy()` cancels subscriptions — called by facade in constructor and `ngOnDestroy()`; default operator `switchMap`
5. **Selectors** — separate class outside `@State`; always `public static` on `@Selector([...])` methods
6. **Facade (`*.state.service.ts`)** — **the only point of access to state for components**; exposes `Signal<T>` via `selectSignal` and dispatch methods; components never inject `Store` directly
7. **Dispatch** — exclusively through facade methods; `store.dispatch()` allowed only inside facade and effects service; `selectSnapshot` only in interceptors/guards
8. **State Providers** — each feature has `<feature>StateProviders()` in `<feature>-state-providers.ts`; registers state + services together; called directly in the `providers` array
9. **Folder structure** — `state/api/`, `state/payloads/`, `*.actions.ts`, `*.effects.service.ts`, `*.selectors.ts`, `*.state.service.ts`, `*.state.ts`, `*-state-providers.ts`, `index.ts`
