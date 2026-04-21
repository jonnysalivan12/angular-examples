#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const [, , targetPath, name] = process.argv;

if (!targetPath || !name) {
  console.error('Usage: node generate-state.js <path> <name>');
  console.error('  path  — destination folder (e.g., libs/state/users)');
  console.error('  name  — state name in camelCase (e.g., dashboardUsers)');
  process.exit(1);
}

// Name transformations
const kebab = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const pascal = name.charAt(0).toUpperCase() + name.slice(1);

const dir = path.resolve(targetPath);
const payloadsDir = path.join(dir, 'payloads');
const apiDir = path.join(dir, 'api');

// Templates
const files = {
  [`${kebab}-actions.ts`]: `import { ActionBuilder } from '@core/state';

export namespace ${pascal}Actions {
}
`,

  [`${kebab}-state.ts`]: `import { Action, State, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';

export interface ${pascal}StateModel {
}

const DEFAULTS: ${pascal}StateModel = {
};

@State<${pascal}StateModel>({
  name: '${kebab}',
  defaults: DEFAULTS,
})
@Injectable()
export class ${pascal}State {
}
`,

  [`${kebab}-selectors.ts`]: `import { Selector } from '@ngxs/store';
import { ${pascal}State, ${pascal}StateModel } from './${kebab}-state';

export class ${pascal}Selectors {
}
`,

  [`api/${kebab}-api.service.ts`]: `import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/api/api.service';

@Injectable()
export class ${pascal}ApiService {
  private readonly api: ApiService = inject(ApiService);
}
`,

  [`${kebab}-state-effects.service.ts`]: `import { Injectable } from '@angular/core';
import { NgxsEffectsService } from '@core/state';

@Injectable()
export class ${pascal}StateEffectsService extends NgxsEffectsService {
}
`,

  [`${kebab}-state.service.ts`]: `import { Injectable, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { ${pascal}Selectors } from './${kebab}-selectors';
import { ${pascal}StateEffectsService } from './${kebab}-state-effects.service';

@Injectable()
export class ${pascal}StateService {
  private readonly store = inject(Store);
  private readonly effects = inject(${pascal}StateEffectsService);

  public initEffects(): void {
    this.effects.init();
  }

  public destroyEffects(): void {
    this.effects.destroy();
  }
}
`,

  [`${kebab}-state-providers.ts`]: `import { Provider, EnvironmentProviders } from '@angular/core';
import { provideStates } from '@ngxs/store';
import { ${pascal}State } from './${kebab}-state';
import { ${pascal}StateEffectsService } from './${kebab}-state-effects.service';
import { ${pascal}StateService } from './${kebab}-state.service';
import { ${pascal}ApiService } from './api/${kebab}-api.service';

export function ${name}StateProviders(): Array<Provider | EnvironmentProviders> {
  return [
    ${pascal}StateEffectsService,
    ${pascal}ApiService,
    provideStates([${pascal}State]),
    ${pascal}StateService,
  ];
}
`,

  ['index.ts']: `export { ${name}StateProviders } from './${kebab}-state-providers';
export { ${pascal}StateService } from './${kebab}-state.service';
export { ${pascal}Selectors } from './${kebab}-selectors';
export { ${pascal}Actions } from './${kebab}-actions';
export type { ${pascal}StateModel } from './${kebab}-state';
`,
};

// Create directories
fs.mkdirSync(payloadsDir, { recursive: true });
fs.mkdirSync(apiDir, { recursive: true });

// Write files
for (const [filename, content] of Object.entries(files)) {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    console.warn(`SKIP (exists): ${filePath}`);
    continue;
  }
  fs.writeFileSync(filePath, content);
  console.log(`CREATE: ${filePath}`);
}

console.log(`\nState "${name}" scaffolded in ${dir}`);
console.log('Next: use /ngxs-action-generator or /ngxs-async-action-generator to add actions');