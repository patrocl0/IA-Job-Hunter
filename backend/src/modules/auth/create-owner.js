import pg from 'pg';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { activateOwner } from './owner.js';
if (!process.stdin.isTTY) throw new Error('Ejecuta este comando desde una terminal interactiva.');
let hidden = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!hidden) process.stdout.write(chunk);
    done();
  },
});
const prompt = createInterface({ input: process.stdin, output, terminal: true });
const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });
try {
  const email = await prompt.question('Correo de la cuenta propietaria: ');
  process.stdout.write('Contraseña (mínimo 12 caracteres; no se mostrará): ');
  hidden = true;
  const password = await prompt.question('');
  process.stdout.write('\nRepite la contraseña: ');
  const confirmation = await prompt.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  await activateOwner(pool, { email, password });
  console.log('Cuenta propietaria activada. Inicia sesión para ver tus datos anteriores.');
} catch (error) {
  console.error(
    error.code === '23505'
      ? 'Ese correo ya pertenece a otra cuenta. Usa otro correo.'
      : error.message,
  );
  process.exitCode = 1;
} finally {
  prompt.close();
  await pool.end();
}
