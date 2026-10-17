import pg from 'pg';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resetPasswordLocally } from './password-change.js';

// Do not accept passwords in arguments, environment variables, or redirected input.
if (!process.stdin.isTTY || !process.stdout.isTTY)
  throw new Error(
    'Ejecuta la recuperación desde una terminal interactiva con docker compose exec.',
  );
let hidden = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!hidden) process.stdout.write(chunk);
    done();
  },
});
const prompt = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
const pool = new pg.Pool({ connectionTimeoutMillis: 5000, statement_timeout: 15000 });
prompt.on('SIGINT', () => {
  prompt.close();
  process.stdout.write('\nOperación cancelada.\n');
  process.exit(130);
});
try {
  console.log(
    'Recuperación administrativa local. Cerrará todas las sesiones de la cuenta indicada.',
  );
  const email = (await prompt.question('Correo de la cuenta: ')).trim();
  const confirmation = await prompt.question(`Para restablecer ${email}, escribe RESTABLECER: `);
  if (confirmation !== 'RESTABLECER')
    throw new Error('Operación cancelada. No se modificó la cuenta.');
  process.stdout.write('Nueva contraseña (mínimo 12 caracteres; no se mostrará): ');
  hidden = true;
  const password = await prompt.question('');
  process.stdout.write('\nRepite la nueva contraseña: ');
  const repeated = await prompt.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password !== repeated)
    throw new Error('Las contraseñas no coinciden. No se modificó la cuenta.');
  await resetPasswordLocally(pool, { email, password });
  console.log(
    'Contraseña restablecida y sesiones cerradas. Inicia sesión con tu nueva contraseña.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
  await pool.end();
}
