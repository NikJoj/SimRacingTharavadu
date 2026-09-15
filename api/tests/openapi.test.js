import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiRoot = new URL('../', import.meta.url);
const spec = readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8');

test('OpenAPI covers the routes and methods registered by the API entry point', () => {
  // Read registrations without importing handlers or connecting to external services.
  const entry = readFileSync(new URL('index.js', apiRoot), 'utf8');
  const implemented = [];
  for (const [, file] of entry.matchAll(/import\s+['"]\.\/([^'"]+)['"]/g)) {
    const source = readFileSync(new URL(file, apiRoot), 'utf8');
    for (const [, name, configuration] of source.matchAll(/app\.http\(['"]([^'"]+)['"],\s*\{([\s\S]*?)(?=handler\s*[:,}])/g)) {
      const route = configuration.match(/route:\s*['"]([^'"]+)['"]/)?.[1] || name;
      const methods = configuration.match(/methods:\s*\[([^\]]+)\]/)?.[1];
      assert.ok(methods, `Cannot determine methods for ${file}; update this coverage check.`);
      for (const [, method] of methods.matchAll(/['"]([A-Z]+)['"]/g)) implemented.push(`${method.toLowerCase()} /api/${route}`);
    }
    assert.match(source, /app\.http\(/, `Imported ${file} has no HTTP registration; review coverage extraction.`);
  }
  assert.ok(implemented.length > 0, 'No API registrations were detected.');
  const documented = [];
  let route;
  for (const line of spec.split(/\r?\n/)) {
    const path = line.match(/^  (\/api\/[^:]+):\s*$/);
    if (path) route = path[1];
    const method = line.match(/^    (get|post|put|delete|patch|head|options):\s*$/);
    if (route && method) documented.push(`${method[1]} ${route}`);
  }
  assert.deepEqual(documented.sort(), implemented.sort(), 'Update docs/openapi.yaml when registering, removing, or changing an API route.');
});

test('OpenAPI operation IDs are unique and every operation has one', () => {
  const ids = [...spec.matchAll(/^      operationId:\s*(\S+)/gm)].map(match => match[1]);
  const operations = [...spec.matchAll(/^    (get|post|put|delete|patch|head|options):\s*$/gm)];
  assert.equal(ids.length, operations.length);
  assert.equal(new Set(ids).size, ids.length);
});
