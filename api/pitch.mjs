import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const defaultPasswordHash = '81534ea73fe40623c058bbdb672e5b537112b5e6dc04e318c421d123e421e35f';

export default async function pitch(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const authorization = req.headers.authorization || '';
  const credentials = /^Basic /i.test(authorization)
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8') : '';
  const separator = credentials.indexOf(':');
  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  const expected = process.env.PITCH_PASSWORD
    ? createHash('sha256').update(process.env.PITCH_PASSWORD).digest()
    : Buffer.from(defaultPasswordHash, 'hex');
  const supplied = createHash('sha256').update(password).digest();
  if (separator < 0 || username !== 'admin' || !timingSafeEqual(supplied, expected)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Viveu - Pitch de investimento", charset="UTF-8"');
    return res.status(401).end(req.method === 'HEAD' ? '' : '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Acesso restrito — Viveu</title><body style="background:#f6f4ed;color:#213c33;font:18px system-ui;max-width:560px;margin:15vh auto;padding:24px"><h1>Pitch de investimento</h1><p>Entre com o usuário admin e a senha de acesso na janela do navegador.</p><a href="/pitch">Tentar novamente</a></body></html>');
  }

  try {
    const html = await readFile(new URL('../docs/PITCH_INVESTIMENTO_VIVEU.html', import.meta.url), 'utf8');
    return res.status(200).end(req.method === 'HEAD' ? '' : html);
  } catch {
    return res.status(500).end('Não foi possível abrir a apresentação. Tente novamente mais tarde.');
  }
}
