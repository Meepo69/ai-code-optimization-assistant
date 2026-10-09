import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../src/index.js';
test('health route returns model', async () => {
  const response = await handleApi(new Request('https://example.com/api/health'), {});
  assert.equal(response.status, 200);
  assert.match((await response.json()).model, /llama-3\.3/);
});
test('unbound storage returns 503 for chat', async () => {
  const response = await handleApi(new Request('https://example.com/api/chat', {method:'POST'}), {});
  assert.equal(response.status, 503);
});
