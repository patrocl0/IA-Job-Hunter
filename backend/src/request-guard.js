export function requestGuard(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Origen no permitido.' });
    const importing = req.method === 'POST' && req.path === '/api/cv/import';
    const type = importing ? 'multipart/form-data' : 'application/json';
    if (!req.is(type)) return res.status(415).json({ error: importing ? 'Adjunta el archivo como multipart/form-data.' : 'Se requiere application/json.' });
  }
  next();
}
