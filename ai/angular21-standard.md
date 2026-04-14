# Angular 21 Coding Standard
> Standard kodowania Angular 21 dla generowania kodu przez AI.  
> Wersja: 1.2 | Źródła: angular.dev Style Guide, Angular v21 release notes, community best practices 2025/2026.  
> Uzupełnia TypeScript Standard — stosuj oba jednocześnie.

---

## 1. Modyfikatory dostępu — jawne intencje

### Zasada
Każda właściwość i metoda klasy musi mieć **jawnie zadeklarowany modyfikator dostępu**. Brak modyfikatora to ukryta intencja — AI i inni programiści nie wiedzą, czy pominięcie `public` było świadome.

| Modyfikator | Kiedy używać |
|---|---|
| `private` | Serwisy, zależności (inject), wewnętrzny stan niewidoczny dla szablonu |
| `protected` | **Domyślny dla właściwości i metod komponentu** — widoczny w szablonie, niewidoczny z zewnątrz |
| `public` | Jawnie eksponowane API klasy — używaj gdy świadomie chcesz umożliwić dostęp z zewnątrz |

### Dlaczego `protected` jako domyślny w komponentach?

Szablon HTML komponentu w Angular traktowany jest jak "wewnętrzna część klasy" — może odwoływać się do `protected`. Używając `protected` zamiast `public` dla właściwości używanych w szablonie:

- **sygnalizujesz intencję**: "to jest dla szablonu, nie dla innych klas"
- **zapobiegasz przypadkowemu użyciu z zewnątrz** (np. `component.someValue` w teście lub rodzicu)
- **ułatwiasz refaktoryzację**: zmiana `protected` na `private` to świadoma decyzja o ukryciu przed szablonem
- **AI generuje kod, który jasno komunikuje kontrakt klasy** — widząc `protected`, wiadomo że to element "wewnętrzny", widząc `public` — że to świadome API

```typescript
// ❌ ŹLE — brak modyfikatorów, ukryte intencje
@Component({ ... })
export class UserCardComponent {
  userService = inject(UserService);   // public? protected? celowe?
  isLoading = signal(false);           // czy można użyć z zewnątrz?
  user = signal<User | null>(null);

  onSave(): void { ... }               // czy to API publiczne czy handler szablonu?
  loadUser(): void { ... }
}

// ✅ DOBRZE — jawne intencje
@Component({ ... })
export class UserCardComponent {
  private readonly userService = inject(UserService);  // tylko wewnątrz klasy
  protected readonly isLoading = signal(false);        // używane w szablonie
  protected readonly user = signal<User | null>(null); // używane w szablonie

  protected onSave(): void { ... }    // handler szablonu (click, submit itp.)
  private loadUser(): void { ... }    // wewnętrzna logika, niewidoczna w szablonie
}

// ✅ Serwis — public tylko dla świadomego API
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  public readonly items = this._items.asReadonly();         // świadome publiczne API
  public readonly count = computed(() => this._items().length);

  public addItem(item: CartItem): void { ... }              // świadome publiczne API
  public removeItem(id: string): void { ... }

  private validate(item: CartItem): boolean { ... }         // wewnętrzna logika
}
```

---

## 2. Architektura — fundamenty Angular 21

### 2.1 Standalone-first (domyślne)
Angular 21 porzuca NgModules jako domyślne podejście. Każdy nowy komponent, dyrektywa i pipe musi być **standalone**.

```typescript
// ✅ DOBRZE — standalone component (domyślne w Angular 21)
@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCardComponent { }

// ❌ ŹLE — NgModule (legacy, nie twórz nowych)
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule],
})
export class UserCardModule { }
```

### 2.2 Zoneless — brak Zone.js
Nowe projekty Angular 21 są zoneless domyślnie (CLI to konfiguruje). Nie dodawaj Zone.js ręcznie.

```typescript
// ✅ main.ts — bootstrapApplication bez Zone.js
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(console.error);

// ✅ app.config.ts
import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
  ],
};
```

---

## 3. Signals — reaktywność

Signals to **podstawowy mechanizm stanu** w Angular 21. Zastępują `BehaviorSubject` i `ChangeDetectorRef` dla prostego stanu komponentu.

### 3.1 Podstawowe API

```typescript
import { signal, computed, effect, Signal, WritableSignal } from '@angular/core';

@Component({ ... })
export class CounterComponent {
  // private — zapisywalny signal, tylko wewnątrz klasy
  private readonly _count = signal(0);

  // protected — odczyt w szablonie, ale nie z zewnątrz
  protected readonly count: Signal<number> = this._count.asReadonly();
  protected readonly doubled = computed(() => this._count() * 2);
  protected readonly label = computed(() => `Wartość: ${this._count()}`);

  protected increment(): void {
    this._count.update(v => v + 1);
  }

  protected reset(): void {
    this._count.set(0);
  }
}
```

### 3.2 Effect — efekty uboczne

`effect()` używaj wyłącznie do efektów ubocznych (logowanie, synchronizacja z localStorage itp.), **nie** do obliczania wartości (do tego jest `computed`).

```typescript
@Component({ ... })
export class ThemeComponent {
  private readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    // ✅ effect w konstruktorze — wymagany injection context
    effect(() => {
      document.body.setAttribute('data-theme', this.theme());
    });
  }

  protected setTheme(value: 'light' | 'dark'): void {
    this.theme.set(value);
  }
}
```

### 3.3 Signal w serwisach

W serwisach publiczne API jest jawnie oznaczone `public` — to świadomy kontrakt do użycia z zewnątrz.

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  public readonly items = this._items.asReadonly();
  public readonly count = computed(() => this._items().length);
  public readonly total = computed(() =>
    this._items().reduce((sum, item) => sum + item.price * item.qty, 0),
  );

  public addItem(item: CartItem): void {
    this._items.update(items => [...items, item]);
  }

  public removeItem(id: string): void {
    this._items.update(items => items.filter(i => i.id !== id));
  }

  private validateItem(item: CartItem): boolean {
    return item.price > 0 && !!item.id;
  }
}
```

### 3.4 Kiedy RxJS, kiedy Signals

| Przypadek | Użyj |
|---|---|
| Stan komponentu / UI | `signal()` |
| Dane pochodne | `computed()` |
| Efekty uboczne | `effect()` |
| HTTP requesty, strumienie eventów | RxJS (`Observable`) |
| Złożone operacje async (retry, debounce, merge) | RxJS |
| Interop RxJS ↔ Signals | `toSignal()`, `toObservable()` |

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  // ✅ Konwersja Observable → Signal jako publiczne API serwisu
  public readonly users = toSignal(this.http.get<User[]>('/api/users'), {
    initialValue: [],
  });
}
```

---

## 4. Dependency Injection — funkcja `inject()`

Zawsze używaj funkcji `inject()` zamiast wstrzykiwania przez konstruktor. Zależności są zawsze `private readonly`.

```typescript
// ❌ ŹLE — constructor injection (legacy)
@Component({ ... })
export class UserComponent {
  constructor(
    private readonly userService: UserService,
    private readonly router: Router,
  ) {}
}

// ✅ DOBRZE — inject() function
@Component({ ... })
export class UserComponent {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
}
```

---

## 5. Komponenty

### 5.1 Kolejność deklaracji i modyfikatory

```typescript
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  // 1. Injections — zawsze private readonly
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  // 2. Inputs / Outputs — public (kontrakt z rodzicem)
  public readonly userId = input.required<number>();
  public readonly userChanged = output<User>();

  // 3. Stan (signals) — protected gdy używane w szablonie, private gdy tylko logika
  protected readonly isLoading = signal(false);
  protected readonly user = signal<User | null>(null);
  private readonly retryCount = signal(0);

  // 4. Computed — protected gdy używane w szablonie
  protected readonly fullName = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  // 5. Handlery szablonu (click, submit itp.) — protected
  protected onSave(user: User): void {
    this.userChanged.emit(user);
  }

  // 6. Wewnętrzna logika — private
  private loadUser(id: number): void {
    this.isLoading.set(true);
    this.userService.getUser(id).subscribe({
      next: user => {
        this.user.set(user);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
```

### 5.2 Input / Output — nowe API

`input()`, `output()` i `model()` są zawsze **`public readonly`** — stanowią publiczny kontrakt komponentu z jego rodzicem.

```typescript
import { input, output, model } from '@angular/core';

@Component({ ... })
export class SliderComponent {
  // public — kontrakt komponentu (bindowania z zewnątrz)
  public readonly min = input(0);
  public readonly max = input(100);
  public readonly label = input.required<string>();
  public readonly valueChange = output<number>();
  public readonly value = model(0);

  // protected — handler używany tylko w szablonie
  protected onChange(newValue: number): void {
    this.value.set(newValue);
    this.valueChange.emit(newValue);
  }
}
```

```html
<!-- Template — użycie model() z [()] -->
<app-slider [(value)]="selectedValue" label="Volume" [min]="0" [max]="10" />
```

### 5.3 ChangeDetection — zawsze OnPush

```typescript
// ✅ Zawsze OnPush — wymagane przy zoneless
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  ...
})
```

### 5.4 Rozmiar i odpowiedzialność

- Max ~400 linii na plik, max ~75 linii na metodę.
- Jeden komponent = jedna odpowiedzialność UI.
- Logika biznesowa i async → serwisy, nie komponenty.
- Szablony deklaratywne, bez logiki biznesowej.

```html
<!-- ❌ ŹLE — logika w szablonie -->
{{ user.firstName + ' ' + user.lastName | uppercase }}
{{ items.filter(i => i.active).length }}

<!-- ✅ DOBRZE — computed w klasie, template tylko wyświetla -->
{{ fullName() }}
{{ activeCount() }}
```

---

## 6. Szablony (Templates)

### 6.1 Nowa składnia control flow (`@if`, `@for`, `@switch`)

Od Angular 17 — obowiązkowo w Angular 21. Nie używaj `*ngIf`, `*ngFor`, `*ngSwitch`.

```html
@if (user()) {
  <app-user-card [user]="user()!" />
} @else {
  <app-skeleton />
}

@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>Brak elementów</li>
}

@switch (status()) {
  @case ('loading') { <app-spinner /> }
  @case ('error')   { <app-error [message]="error()" /> }
  @default          { <app-content /> }
}
```

### 6.2 Deferrable views — lazy loading komponentów

```html
@defer (on viewport) {
  <app-heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading (minimum 300ms) {
  <app-spinner />
}
```

### 6.3 Smart Styling — natywne bindowania

Angular 21 promuje natywne `[class]` i `[style]` zamiast `NgClass` / `NgStyle`.

```html
<!-- ❌ ŹLE — NgClass / NgStyle (nadmiarowe) -->
<div [ngClass]="{ active: isActive(), disabled: isDisabled() }"></div>
<div [ngStyle]="{ color: textColor(), 'font-size': fontSize() + 'px' }"></div>

<!-- ✅ DOBRZE — natywne bindowania -->
<div [class.active]="isActive()" [class.disabled]="isDisabled()"></div>
<div [style.color]="textColor()" [style.font-size.px]="fontSize()"></div>
```

### 6.4 TrackBy w `@for`

```html
<!-- ✅ Zawsze używaj track z unikalnym identyfikatorem -->
@for (user of users(); track user.id) {
  <app-user-item [user]="user" />
}
```

---

## 7. Serwisy

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  // public — świadome publiczne API serwisu
  public getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }

  public getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  public create(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(this.baseUrl, user);
  }

  public update(id: number, changes: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}`, changes);
  }

  public delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // private — wewnętrzna logika serwisu
  private buildUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
}
```

---

## 8. Routing

```typescript
// ✅ app.routes.ts — lazy loading przez dynamic import
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        m => m.DashboardComponent,
      ),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./features/users/users.routes').then(m => m.usersRoutes),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found/not-found.component').then(
        m => m.NotFoundComponent,
      ),
  },
];
```

### 8.1 Route Guards — funkcyjne

```typescript
// ✅ Funkcyjny guard (nie klasa)
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};
```

---

## 9. Formularze — Reactive Forms

Signal Forms (Angular 21) są eksperymentalne — **nie używamy ich na razie**.  
Stosuj wyłącznie Reactive Forms. Template-driven forms (`ngModel`) tylko dla bardzo prostych, jednopolowych przypadków.

```typescript
@Component({ ... })
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);

  // protected — używane w szablonie przez [formGroup]
  protected readonly form = this.fb.nonNullable.group({
    name:     ['', [Validators.required, Validators.minLength(2)]],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // protected — getter używany w szablonie do wyświetlania błędów
  protected get emailControl() {
    return this.form.controls.email;
  }

  // protected — handler (submit) wywoływany w szablonie
  protected onSubmit(): void {
    if (this.form.valid) {
      this.save(this.form.getRawValue());
    }
  }

  // private — wewnętrzna logika
  private save(data: RegisterFormValue): void {
    // ...
  }
}
```

---

## 10. Stylowanie komponentów

### 10.1 Enkapsulacja — zawsze domyślna (`Emulated`)

Nie zmieniaj `ViewEncapsulation`. Domyślna wartość `Emulated` sprawia, że Angular automatycznie odseparowuje style komponentu przez atrybut `_ngcontent-xxx`. Pisz zwykłe klasy — Angular sam dba o izolację.

```typescript
// ❌ ŹLE — wyłącza enkapsulację, style wyciekają globalnie
@Component({
  encapsulation: ViewEncapsulation.None,
  ...
})

// ✅ DOBRZE — domyślne, nie podawaj encapsulation w ogóle
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

### 10.2 `:host` — stylowanie elementu hosta komponentu

Użyj `:host` gdy chcesz stylować root element komponentu (zamiast owijać template dodatkowym `<div>`).

```scss
// card.component.scss

// ✅ :host — styluje sam element <app-card>
:host {
  display: block;   // komponenty są domyślnie inline — zawsze ustaw display
  width: 100%;
}

// ✅ :host z klasą warunkową — reaguje na [class.is-active]="..." w rodzicu
:host(.is-active) {
  border: 2px solid var(--color-primary);
}

// ✅ :host-context — reaguje na klasę gdziekolwiek w drzewie rodziców
:host-context(.dark-theme) {
  --color-surface: #1e1e1e;
}
```

### 10.3 CSS Custom Properties jako API stylowania dla potomków

Zamiast `::ng-deep` (deprecated) używaj CSS Custom Properties jako jawnych "hooków" do stylowania elementów wewnątrz komponentu z zewnątrz.

```scss
// ❌ ŹLE — ::ng-deep jest deprecated i wycieka poza komponent
::ng-deep .mat-mdc-button {
  border-radius: 20px;
}

// ✅ DOBRZE — CSS Custom Property jako API: rodzic ustawia, komponent używa
// button.component.scss
:host {
  --btn-radius: 4px;   // wartość domyślna
}

.button {
  border-radius: var(--btn-radius);
}
```

```html
<!-- rodzic nadpisuje hook przez [style] lub klasę -->
<app-button [style.--btn-radius]="'20px'" />
```

Nadpisania bibliotek UI (Angular Material, PrimeNG) trzymaj wyłącznie w globalnym `styles.scss` — nigdy w plikach komponentów.

### 10.4 Import SCSS — tylko abstrakcje, nigdy CSS

W plikach komponentów importuj wyłącznie pliki nieprodukcyjne (zmienne, mixiny, funkcje). Import pliku zawierającego selektory CSS duplikuje te style w każdym komponencie, który go importuje.

```scss
// ✅ DOBRZE — importuj tylko abstrakcje (zero CSS output w pliku abstrakcji)
@use 'abstracts' as *;

.card {
  padding: $space-md;
  border-radius: $radius-base;

  @include respond-to(md) {
    padding: $space-lg;
  }
}

// ❌ ŹLE — plik zawiera selektory CSS → zduplikuje się w każdym imporcie
@use 'components/buttons';
```

### 10.5 Natywne bindowania klas i stylów w szablonie

Preferuj natywne bindowania `[class.x]` i `[style.x]` nad `NgClass`/`NgStyle`. Integrują się naturalnie z Signals i są wydajniejsze.

```html
<!-- ❌ ŹLE — nadmiarowe dyrektywy -->
<div [ngClass]="{ active: isActive(), disabled: isDisabled() }"></div>
<div [ngStyle]="{ color: textColor(), fontSize: fontSize() + 'px' }"></div>

<!-- ✅ DOBRZE — natywne bindowania -->
<div [class.active]="isActive()" [class.disabled]="isDisabled()"></div>
<div [style.color]="textColor()" [style.font-size.px]="fontSize()"></div>

<!-- ✅ Wiele klas jednocześnie — obiekt lub tablica -->
<div [class]="{ active: isActive(), featured: isFeatured() }"></div>
```

Dynamiczne klasy obliczaj w `computed()` w klasie komponentu — nie w szablonie.

```typescript
// ✅ computed zamiast logiki w szablonie
protected readonly cardClasses = computed(() => ({
  'card--active':   this.isActive(),
  'card--featured': this.isFeatured(),
  'card--loading':  this.isLoading(),
}));
```

```html
<div [class]="cardClasses()"></div>
```

---

## 11. Nazewnictwo plików i selektorów

| Element | Format pliku | Selektor |
|---|---|---|
| Component | `user-card.component.ts` | `app-user-card` |
| Directive | `highlight.directive.ts` | `[appHighlight]` |
| Pipe | `truncate.pipe.ts` | `truncate` |
| Service | `user.service.ts` | — |
| Guard | `auth.guard.ts` | — |
| Interceptor | `auth.interceptor.ts` | — |
| Model/Interface | `user.model.ts` | — |
| Routes | `users.routes.ts` | — |

- Słowa oddzielaj myślnikiem: `user-profile.component.ts`
- Prefiks selektorów komponentów: `app-` (lub projekt-specyficzny, np. `ui-`)
- Prefiks selektorów dyrektyw atrybutowych: `camelCase` z prefiksem projektu

---

## 12. Wzorce do unikania

| Antywzorzec | Zamiennik w Angular 21 |
|---|---|
| Brak modyfikatora dostępu | Jawne `private` / `protected` / `public` |
| NgModules dla nowych rzeczy | Standalone components |
| `*ngIf`, `*ngFor`, `*ngSwitch` | `@if`, `@for`, `@switch` |
| `@Input()` / `@Output()` dekoratory | `input()`, `output()`, `model()` |
| Constructor injection | `inject()` |
| `BehaviorSubject` dla stanu UI | `signal()` |
| `ChangeDetectorRef.markForCheck()` | Signals + OnPush |
| Zone.js | Zoneless (`provideExperimentalZonelessChangeDetection`) |
| `NgClass` / `NgStyle` | `[class.x]` / `[style.x]` lub `[class]="computed()"` |
| `ViewEncapsulation.None` | Domyślna enkapsulacja (`Emulated`) — nie podawaj w ogóle |
| `::ng-deep` | CSS Custom Properties jako hook w `:host` |
| Logika klas w szablonie | `computed()` zwracający obiekt klas |
| Import CSS z pełnymi selektorami w komponentach | Importuj tylko abstrakcje (zmienne, mixiny) |
| Style komponentu bez `:host { display: block }` | Zawsze ustaw `display` na `:host` |
| Logika w szablonach | `computed()` w klasie |
| Wywoływanie funkcji w szablonach | `computed()` (memoizacja) |
| `async` pipe z Observable | `toSignal()` |
| `providedIn: 'any'` | `providedIn: 'root'` (singleton) |
| Importowanie całego `CommonModule` | Importuj tylko potrzebne (np. `AsyncPipe`, `DatePipe`) |
| Własne dekoratory | Dekoratory Angular (`@Component`, `@Injectable` itp.) |
| `debugger` w kodzie produkcyjnym | Usuń przed commitem |

---

## Szybka ściągawka dla AI

Gdy generujesz kod Angular 21:

1. **Modyfikatory dostępu — zawsze jawne:**
   - `private readonly` — injections i wewnętrzna logika
   - `protected` — domyślny dla właściwości i metod komponentu (widoczne w szablonie)
   - `public` — świadome API serwisów i kontrakty komponentu (`input()`, `output()`, `model()`)
2. **Standalone** — każdy komponent/dyrektywa/pipe ma `standalone: true`
3. **Signals** — stan przez `signal()`, wartości pochodne przez `computed()`; `effect()` tylko dla efektów ubocznych
4. **inject()** — zawsze zamiast constructor injection; zależności zawsze `private readonly`
5. **input() / output() / model()** — zawsze `public readonly`
6. **OnPush** — każdy komponent ma `changeDetection: ChangeDetectionStrategy.OnPush`
7. **@if / @for / @switch** — nowa składnia, nigdy `*ngIf`, `*ngFor`
8. **Lazy loading** — każda feature route przez `loadComponent()` lub `loadChildren()`
9. **Natywne bindowania** — `[class.x]` i `[style.x]` zamiast NgClass/NgStyle; złożone klasy przez `computed()` zwracający obiekt
10. **Stylowanie** — domyślna enkapsulacja (nie podawaj `encapsulation`); `:host { display: block }` zawsze; `::ng-deep` zabroniony; CSS Custom Properties jako API dla potomków; importuj w SCSS tylko abstrakcje
11. **RxJS** tylko dla HTTP i złożonych strumieni — nie dla stanu UI
11. **RxJS** tylko dla HTTP i złożonych strumieni — nie dla stanu UI
12. **Reactive Forms** — nie Signal Forms (eksperymentalne), nie template-driven
13. **HttpClient** jest auto-provided — nie dodawaj `provideHttpClient()` ręcznie
