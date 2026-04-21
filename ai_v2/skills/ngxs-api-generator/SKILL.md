---
name: ngxs-api-generator
description: >
  Use when adding API method to existing state API service.
  Triggers: add api method, add api call, add endpoint, add http method,
  add request method, add api service method.
---

# NGXS API Method Generator

Do NOT explore project structure. Do NOT read other API services as examples. Follow these steps exactly.

## Input

User provides:
- `path` — existing state folder
- `method name` — e.g., `loadAdvisors`, `updateUser`, `deleteUser`
- `HTTP method` — GET, POST, PUT, DELETE
- `url` — endpoint path
- `parameters` — path params, query params, body fields (or none)
- `response shape` (or none)

If not provided — ask.

## Naming Convention

- Request model: `<MethodName>Request`
- Request body (POST/PUT): `<MethodName>RequestBody` — in same file
- Response model: `<MethodName>Response`
- File: `api/<kebab-method-name>.ts` — request and response in same file

## Step 1 — Read existing file

Read only: `<path>/api/*-api.service.ts`

## Step 2 — Create model file in `api/` (only if needed)

**Skip this step entirely if method has no params AND no response.**

`api/<kebab-method>.ts`:

### GET / DELETE with params:
```typescript
export interface <MethodName>Request {
  // path params, query params
}
```

### GET / DELETE with response:
```typescript
export interface <MethodName>Response {
  // response fields
}
```

### POST / PUT:
```typescript
export interface <MethodName>RequestBody {
  // body fields
}

export interface <MethodName>Request {
  // path params
  body: <MethodName>RequestBody;
}

export interface <MethodName>Response {
  // response fields
}
```

All interfaces that exist go in one file. Skip interfaces that are not needed.

## Step 3 — Add method to API service

### GET — no params, no response:
```typescript
public <methodName>(): Observable<void> {
  return this.api.get<void>('<url>');
}
```

### GET — with params and/or response:
```typescript
public <methodName>({ <params> }: <MethodName>Request): Observable<<MethodName>Response> {
  return this.api.get<<MethodName>Response>('<url>', { <params> });
}
```

### POST:
```typescript
public <methodName>({ <params>, body }: <MethodName>Request): Observable<<MethodName>Response> {
  return this.api.post<<MethodName>Response, <MethodName>RequestBody>('<url>', { <params>, body });
}
```

### PUT:
```typescript
public <methodName>({ <params>, body }: <MethodName>Request): Observable<<MethodName>Response> {
  return this.api.put<<MethodName>Response, <MethodName>RequestBody>('<url>', { <params>, body });
}
```

### DELETE:
```typescript
public <methodName>({ <params> }: <MethodName>Request): Observable<<MethodName>Response> {
  return this.api.delete<<MethodName>Response>('<url>', { <params> });
}
```

## Rules

- Request + Response in one file — no separate `requests/` folder
- Skip model file entirely if no params and no response
- Skip individual interfaces that are not needed
- Use `this.api.get/post/put/delete` — never `HttpClient` directly
- One method per API endpoint