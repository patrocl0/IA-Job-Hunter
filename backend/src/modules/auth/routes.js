import { changePassword, PasswordChangeError } from './password-change.js';
import { credentials, hashPassword, verifyPassword } from './passwords.js';
import { createAuthService, sessionAge } from './service.js';
export function readAuthConfig(env = {}) {
  const origin = env.APP_ORIGIN || 'http://localhost:8080';
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol))
    throw new Error('APP_ORIGIN debe ser un origen http(s), sin ruta ni barra final.');
  if (
    parsed.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  )
    throw new Error('Fuera de localhost, APP_ORIGIN requiere HTTPS.');
  if (env.ALLOW_REGISTRATION && !['true', 'false'].includes(env.ALLOW_REGISTRATION))
    throw new Error('ALLOW_REGISTRATION debe ser true o false.');
  return {
    origin,
    secure: parsed.protocol === 'https:',
    registration: env.ALLOW_REGISTRATION === 'true',
  };
}
export function registerAuth(app, pool, config = readAuthConfig()) {
  const service = createAuthService(pool);
  const cookieName = config.secure ? '__Host-jobhunter_session' : 'jobhunter_session';
  const cookieOptions = { httpOnly: true, secure: config.secure, sameSite: 'strict', path: '/' };
  const token = (req) => {
    const value = (req.headers.cookie || '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
  };
  // Custom header forces preflight; no cross-origin CORS is enabled. Also enforce exact Origin.
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('X-Job-Hunter') !== '1' ||
        (req.get('origin') && req.get('origin') !== config.origin))
    )
      return res
        .status(403)
        .json({ error: 'Origen o cabecera de seguridad no permitido. Recarga la página.' });
    next();
  });
  app.get('/api/auth/session', async (req, res) => {
    res.json({ user: await service.findSession(token(req)), registration: config.registration });
  });
  for (const action of ['login', 'register']) {
    app.post(`/api/auth/${action}`, async (req, res) => {
      if (await service.limited('ip:' + req.ip, 30))
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
      if (action === 'register' && !config.registration)
        return res.status(403).json({ error: 'El registro está cerrado en esta instalación.' });
      let input;
      try {
        input = credentials(req.body);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      if (await service.limited('email:' + input.email, 10))
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
      let user;
      let verifiedPasswordHash;
      if (action === 'register') {
        const hash = await hashPassword(input.password);
        verifiedPasswordHash = hash;
        const result = await pool.query(
          'INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id,email',
          [input.email, hash],
        );
        user = result.rows[0];
        if (!user)
          return res
            .status(409)
            .json({ error: 'No se pudo crear la cuenta con esos datos. Intenta iniciar sesión.' });
      } else {
        const { rows } = await pool.query(
          'SELECT id,email,password_hash FROM users WHERE email=$1',
          [input.email],
        );
        if (!(await verifyPassword(input.password, rows[0]?.password_hash)))
          return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        user = { id: rows[0].id, email: rows[0].email };
        verifiedPasswordHash = rows[0].password_hash;
      }
      let value;
      try {
        value = await service.createSession(user.id, token(req), verifiedPasswordHash);
      } catch (error) {
        if (error.status === 401) return res.status(401).json({ error: error.message });
        throw error;
      }
      res.cookie(cookieName, value, { ...cookieOptions, maxAge: sessionAge });
      res.status(action === 'register' ? 201 : 200).json({ user });
    });
  }
  app.post('/api/auth/logout', async (req, res) => {
    await service.revoke(token(req));
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  app.use('/api', async (req, res, next) => {
    const user = await service.findSession(token(req));
    if (!user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    req.user = user;
    next();
  });
  app.post('/api/auth/password', async (req, res) => {
    if (await service.limited('password-change:' + req.user.id, 10))
      return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    try {
      await changePassword(pool, req.user.id, token(req), req.body);
      res.clearCookie(cookieName, cookieOptions);
      res.status(204).end();
    } catch (error) {
      if (error instanceof PasswordChangeError)
        return res.status(error.status).json({ error: error.message });
      throw error;
    }
  });
  return service;
}
