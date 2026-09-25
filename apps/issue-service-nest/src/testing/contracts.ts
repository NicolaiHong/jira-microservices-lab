import { AssertionError } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

// Test-only: validates bodies against the shared JSON Schemas in /contracts.
const contractsRoot = join(__dirname, '..', '..', '..', '..', 'contracts');
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
for (const directory of ['events', 'http']) {
  for (const file of readdirSync(join(contractsRoot, directory))) {
    if (file.endsWith('.schema.json')) {
      ajv.addSchema(JSON.parse(readFileSync(join(contractsRoot, directory, file), 'utf8')));
    }
  }
}

/** `ref` is relative to /contracts, e.g. `http/project.schema.json#/$defs/accessContext`. */
export function assertContract(ref: string, value: unknown): void {
  const validate = ajv.getSchema(`https://jira-like.local/contracts/${ref}`);
  if (!validate) throw new Error(`Unknown contract schema ${ref}`);
  if (!validate(value)) {
    throw new AssertionError({ message: `${ref}: ${ajv.errorsText(validate.errors)}`, actual: value });
  }
}
