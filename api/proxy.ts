// Vercel Serverless Function: /api/proxy
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

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin || '*';
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Troppe richieste. Riprova tra un minuto." });
  }

  const targetUrl = req.query.url as string;
  const isRaw = req.query.raw === "1";
  if (!targetUrl) {
    return res.status(400).json({ error: "Parametro 'url' mancante nella query string." });
  }

  const formattedUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;

  const isSafe = await validateUrlForSsrf(formattedUrl);
  if (!isSafe) {
    return res.status(403).json({ error: "URL non consentito o potenzialmente pericoloso (SSRF block)." });
  }

  try {
    let response: Response | undefined;
    try {
      response = await fetch(formattedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/pdf,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        redirect: "follow"
      });
    } catch {
      response = undefined;
    }

    const ct = response?.headers?.get("content-type") || "";
    const isPdf = ct.toLowerCase().includes("application/pdf") || formattedUrl.toLowerCase().endsWith(".pdf") || formattedUrl.toLowerCase().includes(".pdf?");

    if (isRaw || isPdf) {
      if (response && response.ok) {
        const arrayBuf = await response.arrayBuffer();
        res.setHeader("Content-Type", "application/pdf");
        return res.status(200).send(Buffer.from(arrayBuf));
      }
    }

    let text = "";
    let contentType = "text/html; charset=utf-8";

    if (response && response.ok) {
      contentType = ct || contentType;
      text = await response.text();
    }

    let directSuccess = text && text.length > 100;

    // Resilient headless reader fallback
    if (!directSuccess) {
      try {
        const jinaUrl = `https://r.jina.ai/${formattedUrl}`;
        const jinaApiKey = process.env.VITE_JINA_API_KEY || process.env.JINA_API_KEY;
        
        const jinaHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,text/plain,*/*",
          "x-return-format": "html"
        };
        if (jinaApiKey) {
          jinaHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
        }

        const jinaResponse = await fetch(jinaUrl, {
          headers: jinaHeaders
        });

        if (jinaResponse.ok) {
          text = await jinaResponse.text();
          contentType = "text/html; charset=utf-8";
        } else {
          const jinaMdHeaders: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          };
          if (jinaApiKey) {
            jinaMdHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
          }

          const jinaMdResponse = await fetch(jinaUrl, {
            headers: jinaMdHeaders
          });
          if (jinaMdResponse.ok) {
            text = await jinaMdResponse.text();
            contentType = "text/plain; charset=utf-8";
          }
        }
      } catch (jinaErr: any) {
        // failed Jina fallback
      }
    }

    if (!text || text.length < 50) {
      return res.status(502).json({
        error: "Impossibile scaricare la pagina (il sito remoto rifiuta le connessioni ed è protetto da blocco restrittivo)."
      });
    }

    res.setHeader("Content-Type", contentType);
    return res.status(200).send(text);
  } catch (err: any) {
    return res.status(500).json({
      error: `Impossibile contattare il server remoto: ${err.message}`
    });
  }
}
