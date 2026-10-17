import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { analysesCsv, csvCell, EXPORT_LIMIT } from '../../shared/analyses-csv.mjs';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { activateOwner } from '../src/modules/auth/owner.js';
import { createAuthService } from '../src/modules/auth/service.js';

test('CSV escapes delimiters and quotes, preserves multiline notes and neutralizes formulas', () => {
  assert.equal(csvCell('React, "Node"\nSegunda línea'), '"React, ""Node""\nSegunda línea"');
  for (const value of [
    '=1+1',
    '+SUM(A1)',
    '-1',
    '@SUM(A1)',
    ' \t=1',
    '\n=1',
    '＝1',
    '＠SUM(A1)',
    '\ttexto',
    '\rtexto',
  ])
    assert.ok(csvCell(value).startsWith('"\''));
  const csv = analysesCsv([
    {
      id: '1',
      title: 'Desarrollador · Medellín',
      status: 'Postulada',
      created_at: '2026-10-17T00:00:00Z',
      tracking: { notes: 'Hola, "equipo"\nSegunda línea' },
      result: { mode: 'demo', score: 100 },
    },
    { id: '2', title: 'Backend', created_at: 'invalid', result: { mode: 'openai', score: 85 } },
  ]);
  assert.ok(csv.startsWith('\uFEFF"ID","Título"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.includes('"2026-10-17T00:00:00.000Z"'));
  assert.ok(csv.includes('"Hola, ""equipo""\nSegunda línea","demo",""'));
  assert.ok(csv.includes('"openai","85"'));
  assert.equal(analysesCsv([]).split('\r\n').length, 2);
});

test('CSV HTTP exports every filtered row for the session owner, validates scope and refuses truncation', async () => {
  const db = new PGlite();
  const query = async (sql, args) => {
    if (sql.includes(';') && !args?.length) return (await db.exec(sql)).at(-1);
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  await migrate(pool);
  await activateOwner(pool, { email: 'csv@example.com', password: 'CSV password phrase' });
  const hash = (await query('SELECT password_hash FROM users WHERE id=1')).rows[0].password_hash;
  const token = await createAuthService(pool).createSession(1, null, hash);
  await query("INSERT INTO users(email,password_hash) VALUES('other@example.com',$1)", [hash]);
  await query(
    `INSERT INTO analyses(title,result,status,tracking,user_id) SELECT 'Propia '||n,'{"mode":"demo","score":null,"summary":"NO_EXPORTAR_RESUMEN"}','Postulada','{"notes":"Nota propia","followUpOn":"2026-10-16"}',1 FROM generate_series(1,25) n`,
  );
  await query(
    `INSERT INTO analyses(title,result,status,user_id) VALUES('OTRO_USUARIO','{}','Postulada',2),('Oferta cerrada','{"mode":"openai","score":90}','Oferta',1)`,
  );
  const app = createApp({ pool, config: { mode: 'demo' }, vacancies: {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/analyses/export`;
  const get = (params, cookie = 'jobhunter_session=' + token) =>
    fetch(base + params, { headers: { Cookie: cookie } });
  try {
    assert.equal((await get('?today=2026-10-17', '')).status, 401);
    for (const params of [
      '?today=bad',
      '?today=2026-10-17&status=bad',
      '?today=2026-10-17&userId=2',
      '?today=2026-10-17&page=2',
      '?today=2026-10-17&status=Oferta&status=Postulada',
    ])
      assert.equal((await get(params)).status, 400);
    const response = await get('?today=2026-10-17&status=Postulada&followUp=due');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/csv; charset=utf-8/);
    assert.equal(response.headers.get('x-export-count'), '25');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
      response.headers.get('content-disposition'),
      /attachment; filename="postulaciones-2026-10-17.csv"/,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
    const text = new TextDecoder().decode(bytes);
    for (let i = 1; i <= 25; i++) assert.ok(text.includes(`"Propia ${i}"`));
    for (const privateText of [
      'OTRO_USUARIO',
      'Oferta cerrada',
      'NO_EXPORTAR_RESUMEN',
      'password_hash',
      'csv@example.com',
    ])
      assert.ok(!text.includes(privateText));
    const empty = await get('?today=2026-10-17&status=Entrevista');
    assert.equal(empty.headers.get('x-export-count'), '0');
    assert.equal((await empty.text()).split('\r\n').length, 2);
    await query(
      `INSERT INTO analyses(title,result,status,user_id) SELECT 'Extra '||n,'{}','Guardada',1 FROM generate_series(1,$1::int) n`,
      [EXPORT_LIMIT + 1],
    );
    const tooMany = await get('?today=2026-10-17');
    assert.equal(tooMany.status, 413);
    assert.match((await tooMany.json()).error, /no se ha generado un archivo parcial/);
    assert.equal((await get('?today=2026-10-17&status=Oferta')).headers.get('x-export-count'), '1');
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
  }
});
