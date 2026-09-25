import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import dns from 'dns';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 30;

  let entry = rateLimitMap.get(clientIp);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(clientIp, entry);
    return true;
  }

  entry.count++;
  if (entry.count > maxReqs) {
    return false;
  }
  return true;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === 'localhost' || ip === '0.0.0.0' || ip === '::1') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) {
    return true;
  }
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd') || lowerIp.startsWith('fe80:')) {
    return true;
  }
  return false;
}

async function validateUrlForSsrf(rawUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (isPrivateOrLocalIp(hostname)) {
      return false;
    }
    try {
      const resolved = await dns.promises.lookup(hostname);
      if (resolved && isPrivateOrLocalIp(resolved.address)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const getClientIp = (req: any): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
};

function apiProxyPlugin(): Plugin {
  return {
    name: 'api-proxy-plugin',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const clientIp = getClientIp(req);
        if (!checkRateLimit(clientIp)) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Troppe richieste. Riprova tra un minuto.' }));
          return;
        }

        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          const formattedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
          const isSafe = await validateUrlForSsrf(formattedUrl);
          if (!isSafe) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'URL non consentito o potenzialmente pericoloso (SSRF block).' }));
            return;
          }

          const isRaw = urlObj.searchParams.get('raw') === '1';
          const isPdfUrl = formattedUrl.toLowerCase().endsWith('.pdf') || formattedUrl.toLowerCase().includes('.pdf?');

          let text = "";
          let contentType = "text/html; charset=utf-8";
          let directSuccess = false;

          try {
            const response = await fetch(formattedUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/pdf,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              },
              redirect: 'follow'
            });

            if (response.ok) {
              const ct = response.headers.get('content-type') || '';
              if (ct) contentType = ct;
              const isPdf = ct.toLowerCase().includes('application/pdf') || isPdfUrl || isRaw;

              if (isPdf) {
                const arrayBuf = await response.arrayBuffer();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/pdf');
                res.end(Buffer.from(arrayBuf));
                return;
              }

              text = await response.text();
              if (text && text.length > 100) {
                directSuccess = true;
              }
            }
          } catch {
            directSuccess = false;
          }

          if (!directSuccess) {
            try {
              const jinaUrl = `https://r.jina.ai/${formattedUrl}`;
              const jinaResponse = await fetch(jinaUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'text/html,text/plain,*/*',
                  'x-return-format': 'html'
                }
              });
              if (jinaResponse.ok) {
                text = await jinaResponse.text();
                contentType = 'text/html; charset=utf-8';
              } else {
                const jinaMd = await fetch(jinaUrl);
                if (jinaMd.ok) {
                  text = await jinaMd.text();
                  contentType = 'text/plain; charset=utf-8';
                }
              }
            } catch {
              // fallback failed
            }
          }

          if (!text || text.length < 50) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Impossibile scaricare la pagina (blocco anti-bot o server offline)' }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', contentType);
          res.end(text);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
