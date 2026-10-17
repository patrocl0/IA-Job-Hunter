import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, STORAGE_KEY } from '../src/data/demo/demo-store.mjs';
import { analysesCsv } from '../../shared/analyses-csv.mjs';

test('Demo CSV uses the shared format, includes all filtered pages and never writes to storage', async () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    title: i === 0 ? '=1+1' : 'Demo ' + i,
    status: 'Postulada',
    created_at: '2026-10-17T00:00:00Z',
    tracking: { followUpOn: '2026-10-16', notes: 'Línea uno\nLínea dos' },
    result: { mode: 'demo', score: null },
  }));
  items.push({ ...items[0], id: 'closed', title: 'Cerrada', status: 'Oferta' });
  const raw = JSON.stringify({ profile: { profile: null }, analyses: items, saved: [] });
  const api = createDemoApi({
    getItem: (key) => (key === STORAGE_KEY ? raw : null),
    setItem: () => assert.fail('Export must not mutate storage'),
  });
  const response = await api('/api/analyses/export?today=2026-10-17&status=Postulada&followUp=due');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Export-Count'), '25');
  assert.match(response.headers.get('Content-Disposition'), /postulaciones-demo/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes], [...new TextEncoder().encode(analysesCsv(items.slice(0, 25)))]);
  for (const query of [
    'today=no',
    'today=2026-10-17&status=wrong',
    'today=2026-10-17&today=2026-10-16',
    'today=2026-10-17&followUp=unknown',
  ])
    assert.equal((await api('/api/analyses/export?' + query)).status, 400);
  const other = createDemoApi({ getItem: () => null, setItem: () => assert.fail() });
  assert.equal(
    (await other('/api/analyses/export?today=2026-10-17')).headers.get('X-Export-Count'),
    '0',
  );
});
