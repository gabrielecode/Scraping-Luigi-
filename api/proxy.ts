// Vercel Serverless Function: /api/proxy
export default async function handler(req: any, res: any) {
  // Set CORS headers so it can be called from anywhere
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const targetUrl = req.query.url as string;
  const isRaw = req.query.raw === "1";
  if (!targetUrl) {
    return res.status(400).json({ error: "Parametro 'url' mancante nella query string." });
  }

  try {
    const formattedUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    
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

    // 2. Resilient headless reader fallback (anti-403, anti-bot bypass & JS rendering)
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
          // Try markdown format from Jina
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
