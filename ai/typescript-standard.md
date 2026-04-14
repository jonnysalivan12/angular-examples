# TypeScript Coding Standard
> Standard kodowania TypeScript dla generowania kodu przez AI.  
> Wersja: 1.0 | Źródła: Google TypeScript Style Guide, AWS Prescriptive Guidance, community best practices 2025.

---

## 1. Konfiguracja projektu (`tsconfig.json`)

Zawsze włączaj tryb ścisły. To fundament całego standardu.

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## 2. Typowanie

### 2.1 Zakaz `any`
Nigdy nie używaj `any`. Używaj `unknown` gdy typ jest nieznany i zawężaj go explicite.

```typescript
// ❌ ŹLE
function parse(data: any) { return data.name; }

// ✅ DOBRZE
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return String((data as { name: unknown }).name);
  }
  throw new Error('Invalid data');
}
```

### 2.2 Inferencja vs. adnotacja
Pozwól TypeScript inferencjonować typy gdy są oczywiste. Bądź explicite dla publicznych API i parametrów funkcji.

```typescript
// ✅ Inferencja — typ oczywisty z przypisania
const count = 0;
const name = 'Alice';
const items = ['a', 'b', 'c'];

// ✅ Explicite — publiczne API, parametry funkcji
interface User {
  id: number;
  name: string;
  email?: string;
}

function getUser(id: number): Promise<User> { ... }
```

### 2.3 `interface` vs `type`
- `interface` — dla kształtu obiektów i kontraktów klas (preferowane, rozszerzalne).
- `type` — dla union types, intersection types, aliasów prymitywów, utility types.

```typescript
// ✅ interface dla obiektów
interface UserRepository {
  findById(id: number): Promise<User>;
  save(user: User): Promise<void>;
}

// ✅ type dla unii i złożonych typów
type Status = 'active' | 'inactive' | 'pending';
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };
```

### 2.4 Unikaj pustych interfejsów
Puste interfejsy są niebezpieczne — nie wymuszają żadnych kontraktów.

```typescript
// ❌ ŹLE
interface Config {}

// ✅ DOBRZE
interface Config {
  apiUrl: string;
  timeout: number;
}
```

### 2.5 Readonly i as const
Używaj `readonly` i `as const` do oznaczenia niemutowalnych danych.

```typescript
// ✅
interface Point {
  readonly x: number;
  readonly y: number;
}

const ROUTES = {
  home: '/',
  about: '/about',
} as const;

type Route = typeof ROUTES[keyof typeof ROUTES]; // '/' | '/about'
```

### 2.6 Utility Types
Korzystaj z wbudowanych utility types zamiast kopiować interfejsy.

```typescript
// ✅
type UserDTO = Omit<User, 'password'>;
type PartialConfig = Partial<Config>;
type RequiredFields = Required<Pick<User, 'id' | 'name'>>;
type UserRecord = Record<string, User>;
```

---

## 3. Enums

Zawsze używaj `enum`, nigdy `const enum` (problemy z modułami i debugowaniem).

```typescript
// ❌ ŹLE
const enum Direction { Up, Down } // niewidoczne dla JS

// ✅ DOBRZE
enum EventType {
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
}
```

Eksportuj enums raz na poziomie globalnym, importuj w innych modułach.

---

## 4. Konwencje nazewnictwa

| Element | Konwencja | Przykład |
|---|---|---|
| Zmienne i funkcje | `camelCase` | `getUserById`, `isLoading` |
| Klasy i interfejsy | `PascalCase` | `UserService`, `HttpClient` |
| Typy i enums | `PascalCase` | `ApiResponse`, `EventType` |
| Stałe globalne | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_BASE_URL` |
| Pliki | `kebab-case` | `user-service.ts`, `auth.guard.ts` |
| Prywatne pola | `camelCase` (bez `_`) | `private count = 0` |

---

## 5. Funkcje

### 5.1 Parametry i return type
Zawsze typuj parametry funkcji. Return type adnotuj dla publicznych funkcji i wszędzie tam, gdzie poprawia czytelność.

```typescript
// ✅
function formatDate(date: Date, locale: string = 'pl-PL'): string {
  return date.toLocaleDateString(locale);
}

async function fetchUser(id: number): Promise<User | null> {
  ...
}
```

### 5.2 Unikaj nadmiernych parametrów
Powyżej 2-3 parametrów używaj obiektu opcji.

```typescript
// ❌ ŹLE
function createUser(name: string, email: string, role: string, active: boolean) {}

// ✅ DOBRZE
interface CreateUserOptions {
  name: string;
  email: string;
  role: string;
  active?: boolean;
}
function createUser(options: CreateUserOptions): User { ... }
```

### 5.3 Brak `var`
Zawsze `const` lub `let`. Nigdy `var`.

```typescript
// ✅
const userId = 42;
let retryCount = 0;
```

---

## 6. Klasy i modyfikatory dostępu

Zawsze deklaruj modyfikatory dostępu. Domyślnie wszystko `private`, eksponuj tylko to co konieczne.

```typescript
// ✅
class UserService {
  private readonly repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  async getUser(id: number): Promise<User | null> {
    return this.repository.findById(id);
  }
}
```

Dekoratory (`@Component`, `@Injectable` itp.) stosuj tylko z frameworków (Angular, NestJS). Nie definiuj własnych.

---

## 7. Null i undefined

TypeScript pozwala na oba. Wybierz jedno podejście w projekcie i trzymaj się go konsekwentnie. Preferowane: `undefined` dla "brak wartości", `null` dla "świadome pustki".

```typescript
// ✅ Obsługa null/undefined z Optional Chaining i Nullish Coalescing
const userName = user?.profile?.name ?? 'Anonymous';
const port = config.port ?? 3000;
```

Nigdy nie używaj non-null assertion (`!`) bez 100% pewności że wartość istnieje.

```typescript
// ❌ ŹLE — niebezpieczne
const el = document.getElementById('app')!;

// ✅ DOBRZE — z guardem
const el = document.getElementById('app');
if (!el) throw new Error('Element #app not found');
```

---

## 8. Importy i moduły

Używaj named imports. Relative imports (`./`, `../`) dla plików w tym samym projekcie.

```typescript
// ✅
import { UserService } from './user.service';
import { HttpClient } from '../http/client';
import type { User } from '../types/user'; // import tylko typów
```

Używaj `import type` gdy importujesz wyłącznie typy — to optymalizacja bundle'u.

---

## 9. Obsługa błędów

Nigdy nie rzucaj ani nie łap `any`. Typuj błędy.

```typescript
// ✅
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ✅ Bezpieczne łapanie błędów
try {
  await fetchUser(id);
} catch (error) {
  if (error instanceof AppError) {
    logger.error(error.code, error.message);
  } else {
    throw error; // nieznany błąd — propaguj
  }
}
```

---

## 10. Generyki

Używaj generyków zamiast duplikowania kodu dla różnych typów. Nadawaj opisowe nazwy parametrom (nie tylko `T`).

```typescript
// ✅
interface Repository<TEntity, TId = number> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

function groupBy<TItem, TKey extends string | number>(
  items: TItem[],
  keyFn: (item: TItem) => TKey,
): Record<TKey, TItem[]> { ... }
```

---

## 11. Asynchroniczność

Zawsze używaj `async/await` zamiast `.then()/.catch()` dla czytelności.

```typescript
// ❌ ŹLE
function loadData(): Promise<Data> {
  return fetch(url)
    .then(res => res.json())
    .catch(err => { throw err; });
}

// ✅ DOBRZE
async function loadData(): Promise<Data> {
  const res = await fetch(url);
  if (!res.ok) throw new AppError('Fetch failed', 'FETCH_ERROR', res.status);
  return res.json() as Promise<Data>;
}
```

---

## 12. Komentarze i dokumentacja

Używaj JSDoc dla publicznych API. Nie komentuj oczywistego kodu — pisz samodokumentujący się kod.

```typescript
/**
 * Pobiera użytkownika na podstawie ID.
 * @param id - Unikalny identyfikator użytkownika
 * @returns Użytkownik lub null jeśli nie istnieje
 * @throws {AppError} Gdy wystąpi błąd komunikacji z bazą danych
 */
async function getUserById(id: number): Promise<User | null> { ... }
```

Nie używaj `@override`, `@implements` w JSDoc gdy TypeScript już to wyraża w kodzie.

---

## 13. Tooling (wymagane w projekcie)

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

```json
// .prettierrc
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

---

## 14. Testowanie

Każda publiczna funkcja/klasa powinna mieć testy. Używaj Jest z TypeScript.

```typescript
// ✅
import { getUserById } from './user.service';

describe('getUserById', () => {
  it('returns user when found', async () => {
    const user = await getUserById(1);
    expect(user).toMatchObject<User>({ id: 1, name: expect.any(String) });
  });

  it('returns null when not found', async () => {
    const user = await getUserById(999999);
    expect(user).toBeNull();
  });
});
```

---

## 15. Wzorce do unikania

| Antywzorzec | Zamiennik |
|---|---|
| `any` | `unknown` + type guard |
| `const enum` | `enum` |
| `var` | `const` / `let` |
| Non-null assertion `!` | Explicit guard / optional chaining |
| Puste interfejsy | Interfejsy z polami |
| Własne dekoratory | Tylko dekoratory z frameworków |
| `eval` / `Function(string)` | Nigdy |
| `debugger` w produkcji | Usuń przed commitem |
| Kopiowanie interfejsów | Utility types (`Pick`, `Omit`, itp.) |
| `.then()` chains | `async/await` |

---

## Szybka ściągawka dla AI

Gdy generujesz kod TypeScript:
1. `strict: true` zawsze włączone
2. Brak `any` — używaj `unknown` lub właściwych typów
3. `interface` dla obiektów, `type` dla unii i aliasów
4. `enum` (nie `const enum`)
5. `camelCase` zmienne/funkcje, `PascalCase` klasy/typy, `UPPER_SNAKE_CASE` stałe
6. Zawsze typuj parametry funkcji, typuj return type dla publicznych API
7. `const`/`let` (nigdy `var`)
8. `async/await` (nie `.then()`)
9. Obsługa błędów przez własne klasy błędów, nie łap `any`
10. JSDoc dla publicznych API
