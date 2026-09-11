import express, { Request, Response } from "express";
import path from "path";
import multer from "multer";
import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import { Readable } from "stream";
import csvParser from "csv-parser";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({ storage: multer.memoryStorage() });

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Initialize Gemini AI client server-side
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

async function callGeminiWithRetry(ai: any, params: any, maxRetries = 3): Promise<any> {
  const modelsToTry = [params.model || "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const res = await ai.models.generateContent({
          ...params,
          model: modelName,
        });
        return res;
      } catch (err: any) {
        lastError = err;
        attempt++;
        const isUnavailable = err?.status === 503 || err?.message?.includes("503") || err?.message?.includes("UNAVAILABLE") || err?.message?.includes("high demand") || err?.message?.includes("overloaded");
        if (isUnavailable && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2500));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("Gemini API temporaneamente non disponibile (503 High Demand). Riprovare tra pochi secondi.");
}

async function callOpenRouter(fullText: string, customApiKey?: string): Promise<any> {
  const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY non è configurato. Inserisci la tua OpenRouter API Key nelle impostazioni dell'app.");
  }

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Analizza il seguente testo estratto dal sito scolastico:\n\n${fullText}` }
      ],
      plugins: [{ id: "web" }],
      response_format: { type: "json_object" }
    },
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "https://ai.studio",
        "X-Title": "ScuolaATA Scraper",
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Risposta vuota da OpenRouter");
  }
  return JSON.parse(content);
}

async function extractData(fullText: string, customApiKey?: string): Promise<any> {
  const apiKeyToUse = customApiKey || process.env.OPENROUTER_API_KEY;
  let openRouterError: string | null = null;

  if (apiKeyToUse) {
    try {
      return await callOpenRouter(fullText, apiKeyToUse);
    } catch (err: any) {
      openRouterError = err.message;
      console.warn("OpenRouter API error, falling back to Gemini if available:", err.message);
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(openRouterError ? `Errore OpenRouter: ${openRouterError}` : "Nessuna chiave API configurata. Inserisci la tua OpenRouter API Key nelle impostazioni dell'app.");
  }

  // Fallback to Gemini
  const ai = getAiClient();
  const response = await callGeminiWithRetry(ai, {
    model: "gemini-3.8-flash",
    contents: `Analizza il seguente testo estratto dal sito scolastico:\n\n${fullText}`,
    config: {
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  const textResult = response.text || "{}";
  return JSON.parse(textResult);
}

const EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di documenti scolastici e bandi di gara. Leggi il testo seguente e restituisci ESCLUSIVAMENTE un oggetto JSON con le seguenti chiavi:
{
  "convocazioni_collaboratore_scolastico": numero,
  "convocazioni_assistente_amministrativo": numero,
  "convocazioni_docenti": numero,
  "convocazioni_assistente_tecnico": numero,
  "convocazioni_cuoco": numero,
  "convocazioni_assistente_agrario": numero,
  "pensionamenti_collaboratore_scolastico": numero,
  "pensionamenti_assistente_amministrativo": numero,
  "pensionamenti_docenti": numero,
  "pensionamenti_assistente_tecnico": numero,
  "pensionamenti_cuoco": numero,
  "pensionamenti_assistente_agrario": numero
}
Se un dato non viene menzionato nel testo, assegna il valore 0 alla chiave corrispondente. Non aggiungere testo fuori dal JSON.`;

// Helper to normalize and resolve URLs
function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

async function scrapeWebsite(targetUrl: string): Promise<{ fullText: string; navigatedUrl: string; logs: string[] }> {
  const logs: string[] = [];
  let currentUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
  logs.push(`Accesso alla home page: ${currentUrl}`);

  let homeHtml = "";
  try {
    const res = await axios.get(currentUrl, {
      timeout: 10000,
      httpsAgent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      maxRedirects: 5,
    });
    homeHtml = res.data;
  } catch (err: any) {
    logs.push(`Errore accesso home ${currentUrl}: ${err.message}`);
    if (currentUrl.startsWith("https://")) {
      try {
        currentUrl = currentUrl.replace("https://", "http://");
        logs.push(`Tentativo con HTTP: ${currentUrl}`);
        const res = await axios.get(currentUrl, { timeout: 10000, httpsAgent, headers: { "User-Agent": "Mozilla/5.0" } });
        homeHtml = res.data;
      } catch (err2: any) {
        logs.push(`Sito non raggiungibile (${targetUrl}): ${err2.message}. URL offline o non valido.`);
        return {
          fullText: `Sito non raggiungibile o offline: ${targetUrl}. Nessun dato disponibile.`,
          navigatedUrl: targetUrl,
          logs,
        };
      }
    } else {
      logs.push(`Sito non raggiungibile (${targetUrl}): ${err.message}. URL offline o non valido.`);
      return {
        fullText: `Sito non raggiungibile o offline: ${targetUrl}. Nessun dato disponibile.`,
        navigatedUrl: targetUrl,
        logs,
      };
    }
  }

  const $ = cheerio.load(homeHtml);
  let pageText = $("body").text().replace(/\s+/g, " ").trim();

  const keywords = ["ata", "bandi di gara", "graduatorie", "collaboratore scolastico", "avvisi", "albo pretorio", "convocazioni"];
  let targetSubUrl = "";
  let matchedKeyword = "";

  $("a").each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr("href");
    if (href && href !== "#" && !href.startsWith("javascript:")) {
      for (const kw of keywords) {
        if (text.includes(kw) || href.toLowerCase().includes(kw)) {
          targetSubUrl = resolveUrl(currentUrl, href);
          matchedKeyword = kw;
          return false;
        }
      }
    }
  });

  if (targetSubUrl) {
    logs.push(`Sezione trovata tramite parola chiave "${matchedKeyword}": ${targetSubUrl}`);
    try {
      const subRes = await axios.get(targetSubUrl, {
        timeout: 10000,
        httpsAgent,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const $sub = cheerio.load(subRes.data);
      const subText = $sub("body").text().replace(/\s+/g, " ").trim();
      pageText = `--- HOMEPAGE ---\n${pageText}\n\n--- SEZIONE ${matchedKeyword.toUpperCase()} (${targetSubUrl}) ---\n${subText}`;
      currentUrl = targetSubUrl;
    } catch (err: any) {
      logs.push(`Impossibile aprire la sezione ${targetSubUrl}: ${err.message}. Uso il testo della home.`);
    }
  } else {
    logs.push(`Nessun link specifico ATA/Bandi trovato in evidenza. Analizzo il testo della homepage.`);
  }

  if (pageText.length > 30000) {
    pageText = pageText.substring(0, 30000);
  }

  return { fullText: pageText, navigatedUrl: currentUrl, logs };
}

// API Routes
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/extract-single", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL è obbligatorio." });
    }

    const customApiKey = req.headers["x-openrouter-key"] as string;
    const { fullText, navigatedUrl, logs } = await scrapeWebsite(url);
    const extractedData = await extractData(fullText, customApiKey);

    res.json({
      success: true,
      url,
      navigatedUrl,
      logs,
      data: extractedData,
    });
  } catch (error: any) {
    console.error("Extraction error:", error);
    res.status(500).json({ success: false, error: error.message || "Errore durante l'elaborazione" });
  }
});

async function parseCsv(csvBuffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const results: string[] = [];
    const stream = Readable.from(csvBuffer);

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.toLowerCase().trim().replace(/^["']|["']$/g, ""),
          skipComments: true,
          strict: false,
        })
      )
      .on("data", (row) => {
        try {
          let foundUrl = "";
          // Check standard keys or iterate values
          for (const key of Object.keys(row)) {
            const val = row[key];
            if (val && typeof val === "string") {
              const cleanVal = val.trim().replace(/^["']|["']$/g, "");
              if (
                cleanVal.startsWith("http://") ||
                cleanVal.startsWith("https://") ||
                cleanVal.includes(".edu.it") ||
                cleanVal.includes(".gov.it") ||
                cleanVal.includes("www.") ||
                cleanVal.includes(".it")
              ) {
                foundUrl = cleanVal;
                break;
              }
            }
          }

          if (!foundUrl && Object.values(row).length > 0) {
            const firstVal = Object.values(row)[0];
            if (firstVal && typeof firstVal === "string") {
              const cleanVal = firstVal.trim().replace(/^["']|["']$/g, "");
              if (cleanVal && !cleanVal.toLowerCase().includes("url") && !cleanVal.toLowerCase().includes("link")) {
                foundUrl = cleanVal;
              }
            }
          }

          if (foundUrl) {
            if (!foundUrl.startsWith("http://") && !foundUrl.startsWith("https://")) {
              foundUrl = `https://${foundUrl}`;
            }
            results.push(foundUrl);
          }
        } catch (rowErr) {
          console.error("Errore parsing riga CSV:", rowErr);
        }
      })
      .on("error", (err) => {
        reject(new Error(`Errore di lettura CSV: ${err.message}`));
      })
      .on("end", () => {
        // Deduplicate
        const uniqueUrls = Array.from(new Set(results));
        resolve(uniqueUrls);
      });
  });
}

interface BatchJob {
  status: "running" | "completed" | "error";
  current: number;
  total: number;
  results: any[];
  error?: string;
}

const jobsStore = new Map<string, BatchJob>();

app.post("/api/process-csv", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file CSV caricato o file non valido." });
    }

    let urls: string[] = [];
    try {
      urls = await parseCsv(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr.message || "File CSV non valido o corrotto." });
    }

    if (urls.length === 0) {
      return res.status(400).json({ error: "Nessun URL valido trovato nel file CSV. Assicurarsi che il file contenga una colonna con link validi." });
    }

    const jobId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    jobsStore.set(jobId, { status: "running", current: 0, total: urls.length, results: [] });

    const customApiKey = req.headers["x-openrouter-key"] as string;

    // Process asynchronously in background
    (async () => {
      const results = [];
      let current = 0;
      for (const url of urls) {
        try {
          const { fullText, navigatedUrl, logs } = await scrapeWebsite(url);
          const data = await extractData(fullText, customApiKey);

          results.push({
            url,
            navigatedUrl,
            status: "success",
            logs,
            data,
          });
        } catch (err: any) {
          results.push({
            url,
            navigatedUrl: url,
            status: "error",
            error: err.message,
            logs: [err.message],
            data: {
              convocazioni_collaboratore_scolastico: 0,
              convocazioni_assistente_amministrativo: 0,
              convocazioni_docenti: 0,
              convocazioni_assistente_tecnico: 0,
              convocazioni_cuoco: 0,
              convocazioni_assistente_agrario: 0,
              pensionamenti_collaboratore_scolastico: 0,
              pensionamenti_assistente_amministrativo: 0,
              pensionamenti_docenti: 0,
              pensionamenti_assistente_tecnico: 0,
              pensionamenti_cuoco: 0,
              pensionamenti_assistente_agrario: 0,
            },
          });
        }
        current++;
        jobsStore.set(jobId, { status: "running", current, total: urls.length, results });
      }
      jobsStore.set(jobId, { status: "completed", current: urls.length, total: urls.length, results });
    })().catch((err) => {
      jobsStore.set(jobId, { status: "error", current: 0, total: urls.length, results: [], error: err.message });
    });

    res.json({ success: true, jobId });
  } catch (error: any) {
    console.error("Batch CSV initiation error:", error);
    res.status(500).json({ success: false, error: error.message || "Errore avvio elaborazione batch" });
  }
});

app.get("/api/batch-status/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobsStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job non trovato." });
  }
  res.json({ success: true, job });
});

app.post("/api/export-github", async (req: Request, res: Response) => {
  try {
    const { owner, repo, path: filePath, content, message } = req.body;
    const pat = req.headers["x-github-pat"] as string;

    if (!owner || !repo || !filePath || !content) {
      return res.status(400).json({ error: "Parametri mancanti (owner, repo, path, content)." });
    }
    if (!pat) {
      return res.status(400).json({ error: "GitHub Personal Access Token (PAT) mancante nell'header x-github-pat." });
    }

    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    let fileSha: string | undefined;

    try {
      const existing = await axios.get(githubApiUrl, {
        headers: {
          "Authorization": `Bearer ${pat}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });
      fileSha = existing.data?.sha;
    } catch {
      // File doesn't exist yet
    }

    const putResponse = await axios.put(
      githubApiUrl,
      {
        message: message || "Export risultati ScuolaATA Data Scraper",
        content: Buffer.from(content, "utf-8").toString("base64"),
        ...(fileSha ? { sha: fileSha } : {})
      },
      {
        headers: {
          "Authorization": `Bearer ${pat}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      success: true,
      commitUrl: putResponse.data?.commit?.html_url || `https://github.com/${owner}/${repo}/blob/main/${filePath}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message || "Errore durante l'esportazione su GitHub." });
  }
});

app.post("/api/google-search", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query di ricerca obbligatoria." });
    }

    const customApiKey = req.headers["x-openrouter-key"] as string;
    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;

    if (apiKey) {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Sei un assistente di ricerca specializzato nel reperire bandi, convocazioni ATA e pensionamenti delle scuole italiane sul web. Fornisci link e dettagli precisi trovati." },
            { role: "user", content: `Cerca sul web informazioni aggiornate su: ${query}` }
          ],
          plugins: [{ id: "web" }]
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.APP_URL || "https://ai.studio",
            "X-Title": "ScuolaATA Scraper",
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      const resultText = response.data?.choices?.[0]?.message?.content || "Nessun risultato trovato.";
      return res.json({ success: true, result: resultText });
    } else if (process.env.GEMINI_API_KEY) {
      const ai = getAiClient();
      const response = await callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: `Cerca sul web informazioni aggiornate su: ${query}`,
        config: {
          systemInstruction: "Sei un assistente di ricerca specializzato nel reperire bandi, convocazioni ATA e pensionamenti delle scuole italiane sul web.",
          tools: [{ googleSearch: {} }]
        }
      });
      return res.json({ success: true, result: response.text || "Nessun risultato trovato." });
    } else {
      return res.status(400).json({ error: "Nessuna chiave API (OpenRouter o Gemini) configurata per la ricerca web." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore durante la ricerca web." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
