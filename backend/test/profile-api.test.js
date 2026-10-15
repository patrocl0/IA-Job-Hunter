import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerProfileRoutes } from '../src/profile.js';

test('HTTP: crear, recuperar, editar, rechazar datos inválidos y eliminar perfil', async () => {
  // Simulated database adapter: exercises HTTP handlers, not PostgreSQL itself.
  let row;
  const pool = { query: async (sql, args) => {
    if (sql.startsWith('INSERT')) row = {data: args[0], updated_at: new Date().toISOString()};
    if (sql.startsWith('DELETE')) row = undefined;
    return { rows: row ? [structuredClone(row)] : [] };
  }};
  const app = express(); app.use(express.json()); registerProfileRoutes(app, pool);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/profile`;
  const put = body => fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await (await fetch(url)).json()).profile,null);
    let response = await put({name:'Ana',headline:'Frontend developer',skills:'React'});
    assert.equal(response.status,200);
    assert.match((await response.json()).cvText,/React/);
    assert.equal((await (await fetch(url)).json()).profile.name,'Ana');
    response = await put({name:'Ana',headline:'Full Stack developer',skills:'React, Node'});
    assert.equal(response.status,200);
    assert.equal((await (await fetch(url)).json()).profile.headline,'Full Stack developer');
    assert.equal((await put({name:'A'})).status,400);
    assert.equal((await (await fetch(url)).json()).profile.headline,'Full Stack developer');
    assert.equal((await fetch(url,{method:'DELETE'})).status,204);
    assert.equal((await (await fetch(url)).json()).profile,null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
