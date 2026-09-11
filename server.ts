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
        logs.push(`Fallito anche HTTP: ${err2.message}`);
        throw new Error(`Impossibile raggiungere l'URL: ${targetUrl}`);
      }
    } else {
      throw new Error(`Impossibile raggiungere l'URL: ${targetUrl} (${err.message})`);
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

    const { fullText, navigatedUrl, logs } = await scrapeWebsite(url);
    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Analizza il seguente testo estratto dal sito scolastico:\n\n${fullText}`,
      config: {
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            convocazioni_collaboratore_scolastico: { type: Type.INTEGER },
            convocazioni_assistente_amministrativo: { type: Type.INTEGER },
            convocazioni_docenti: { type: Type.INTEGER },
            convocazioni_assistente_tecnico: { type: Type.INTEGER },
            convocazioni_cuoco: { type: Type.INTEGER },
            convocazioni_assistente_agrario: { type: Type.INTEGER },
            pensionamenti_collaboratore_scolastico: { type: Type.INTEGER },
            pensionamenti_assistente_amministrativo: { type: Type.INTEGER },
            pensionamenti_docenti: { type: Type.INTEGER },
            pensionamenti_assistente_tecnico: { type: Type.INTEGER },
            pensionamenti_cuoco: { type: Type.INTEGER },
            pensionamenti_assistente_agrario: { type: Type.INTEGER },
          },
          required: [
            "convocazioni_collaboratore_scolastico",
            "convocazioni_assistente_amministrativo",
            "convocazioni_docenti",
            "convocazioni_assistente_tecnico",
            "convocazioni_cuoco",
            "convocazioni_assistente_agrario",
            "pensionamenti_collaboratore_scolastico",
            "pensionamenti_assistente_amministrativo",
            "pensionamenti_docenti",
            "pensionamenti_assistente_tecnico",
            "pensionamenti_cuoco",
            "pensionamenti_assistente_agrario",
          ],
        },
      },
    });

    const textResult = response.text || "{}";
    let extractedData = {};
    try {
      extractedData = JSON.parse(textResult);
    } catch {
      extractedData = {};
    }

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

    const ai = getAiClient();
    const results = [];

    for (const url of urls) {
      try {
        const { fullText, navigatedUrl, logs } = await scrapeWebsite(url);
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Analizza il seguente testo estratto dal sito scolastico:\n\n${fullText}`,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_PROMPT,
            responseMimeType: "application/json",
          },
        });

        let data = {};
        try {
          data = JSON.parse(response.text || "{}");
        } catch {
          data = {};
        }

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
    }

    res.json({ success: true, total: urls.length, results });
  } catch (error: any) {
    console.error("Batch CSV processing error:", error);
    res.status(500).json({ success: false, error: error.message || "Errore elaborazione batch" });
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
