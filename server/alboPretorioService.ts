import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import fs from "fs";
import os from "os";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface AlboPretorioContract {
  id: string;
  titolo_bando: string;
  data_pubblicazione: string;
  pdf_url: string;
  graduatoria_fascia: string;
  profilo_professionale: string;
  classe_di_concorso: string;
  ore_settimanali: string;
  decorrenza_da: string;
  decorrenza_a: string;
  note_filtro?: string;
}

export interface AlboPretorioScanResult {
  alboUrl: string;
  attiTrovatiTotali: number;
  attiFiltratiValidi: number;
  attiEsclusi: number;
  contratti: AlboPretorioContract[];
  graduatoria_fascia: string;
  profilo_professionale: string;
  classe_di_concorso: string;
  ore_settimanali: string;
  decorrenza_da: string;
  decorrenza_a: string;
  logs: string[];
}

const PDF_EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di contratti scolastici di supplenza e atti dell'Albo Pretorio per il personale scolastico (ATA e Docenti) delle scuole italiane.
Analizza il documento PDF del contratto di supplenza ed estrai con la massima precisione le informazioni contrattuali.

⚠️ VINCOLO FONDAMENTALE DI PRIVACY (NON NEGOZIABILE):
- NON estrarre MAI nomi, cognomi, codici fiscali, indirizzi, numeri di telefono o dati anagrafici individuali. Ometti categoricamente qualsiasi dato personale identificativo del lavoratore o del dirigente.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "graduatoria_fascia": stringa (es. "I Fascia", "II Fascia", "III Fascia", oppure "Non specificata"),
  "profilo_professionale": stringa (es. "Collaboratore Scolastico", "Assistente Amministrativo", "Assistente Tecnico", "Docente", ecc.),
  "classe_di_concorso": stringa (es. "A012", "A022", "AA25", oppure "" se non applicabile o non presente),
  "ore_settimanali": stringa (es. "36 ore", "18 ore", "12 ore", ecc.),
  "decorrenza_da": stringa (Formato obbligatorio: GG/MM/AA, es. "01/09/25" o "15/01/26"),
  "decorrenza_a": stringa (Formato obbligatorio: GG/MM/AA, es. "30/06/26" o "31/08/26")
}
Se un campo non è deducibile dal testo del documento, assegna come valore una stringa vuota "". Non aggiungere testo prima o dopo il JSON.`;

// Helper: check if title matches inclusion & exclusion filters
export function matchesNoticeFilters(rawTitle: string): { included: boolean; reason: string } {
  const norm = (rawTitle || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

  // 1. Strict Exclusions
  const excludeTerms = [
    "assegnazione ai plessi del personale ata",
    "ci_031 assenze del personale docente e ata",
    "direttiva_ds",
    "direttiva ds",
    "informativa sindacale",
  ];

  for (const exc of excludeTerms) {
    if (norm.includes(exc)) {
      return {
        included: false,
        reason: `Escluso categoricamente: contiene "${exc}"`,
      };
    }
  }

  // 2. Strict Inclusions
  const includeTerms = [
    "contratto di supplenza annuale",
    "contratto di supplenza breve",
    "contratto di supplenza",
  ];

  for (const inc of includeTerms) {
    if (norm.includes(inc)) {
      return {
        included: true,
        reason: `Incluso: contiene "${inc}"`,
      };
    }
  }

  return {
    included: false,
    reason: "Non contiene i termini obbligatori di contratto di supplenza",
  };
}

// Helper: parse date in Italian formats
export function parseItalianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD
  const ymdMatch = clean.match(/(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Italian textual month: es. "15 maggio 2026"
  const monthsMap: Record<string, number> = {
    gennaio: 0,
    febbraio: 1,
    marzo: 2,
    aprile: 3,
    maggio: 4,
    giugno: 5,
    luglio: 6,
    agosto: 7,
    settembre: 8,
    ottobre: 9,
    novembre: 10,
    dicembre: 11,
    gen: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    mag: 4,
    giu: 5,
    lug: 6,
    ago: 7,
    set: 8,
    ott: 9,
    nov: 10,
    dic: 11,
  };

  const textMatch = clean.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2];
    const year = parseInt(textMatch[3], 10);
    if (monthsMap[monthName] !== undefined) {
      const d = new Date(year, monthsMap[monthName], day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

// Format Date object to GG/MM/AA
export function formatDateToGG_MM_AA(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Normalize any date string output to GG/MM/AA
export function normalizeDateOutput(dateStr: string): string {
  if (!dateStr || dateStr.trim() === "" || dateStr === "N/D") return "";
  const parsed = parseItalianDate(dateStr);
  if (parsed) {
    return formatDateToGG_MM_AA(parsed);
  }
  return dateStr.trim();
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

// Call Gemini API to extract data from PDF buffer
export async function extractFromPdfGemini(pdfBuffer: Buffer, customApiKey?: string): Promise<{
  graduatoria_fascia: string;
  profilo_professionale: string;
  classe_di_concorso: string;
  ore_settimanali: string;
  decorrenza_da: string;
  decorrenza_a: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const pdfBase64 = pdfBuffer.toString("base64");
    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    };

    const textPart = {
      text: "Estrai le informazioni del contratto di supplenza scolastica dal file PDF rispettando lo schema JSON e le regole di privacy (nessun dato anagrafico).",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [pdfPart, textPart],
      config: {
        systemInstruction: PDF_EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const resText = response.text || "{}";
    try {
      const parsed = JSON.parse(resText);
      return {
        graduatoria_fascia: parsed.graduatoria_fascia || "",
        profilo_professionale: parsed.profilo_professionale || "",
        classe_di_concorso: parsed.classe_di_concorso || "",
        ore_settimanali: parsed.ore_settimanali || "",
        decorrenza_da: normalizeDateOutput(parsed.decorrenza_da),
        decorrenza_a: normalizeDateOutput(parsed.decorrenza_a),
      };
    } catch {
      // Fallback
    }
  }

  // Fallback: If OpenRouter is configured
  const openRouterKey = customApiKey || process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    // Extract text strings from PDF buffer as best effort
    const rawPdfText = pdfBuffer.toString("latin1").replace(/[^\x20-\x7E\xC0-\xFF\n\r]/g, " ");
    const textSnippet = rawPdfText.substring(0, 15000);

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PDF_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: `Analizza il testo estratto dal PDF del contratto di supplenza:\n\n${textSnippet}` },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      graduatoria_fascia: parsed.graduatoria_fascia || "",
      profilo_professionale: parsed.profilo_professionale || "",
      classe_di_concorso: parsed.classe_di_concorso || "",
      ore_settimanali: parsed.ore_settimanali || "",
      decorrenza_da: normalizeDateOutput(parsed.decorrenza_da),
      decorrenza_a: normalizeDateOutput(parsed.decorrenza_a),
    };
  }

  throw new Error("Nessuna chiave API (GEMINI_API_KEY o OPENROUTER_API_KEY) disponibile per l'estrazione PDF.");
}

interface RawNotice {
  title: string;
  dateStr: string;
  dateObj: Date | null;
  detailUrl?: string;
  pdfUrl?: string;
}

/**
 * Main function: Process Albo Pretorio for a school
 * - Identifies Albo Pretorio page
 * - Scans notices published in the last 6 months
 * - Applies inclusion & exclusion filters
 * - Downloads attached PDFs temporarily to disk
 * - Extracts fields via Gemini AI
 * - Obligatory Memory Management: deletes temp file in try...finally
 */
export async function processAlboPretorio(
  originalUrl: string,
  navigatedUrl: string,
  customApiKey?: string
): Promise<AlboPretorioScanResult> {
  const logs: string[] = [];
  const baseUrl = navigatedUrl || originalUrl;
  let alboUrl = "";

  try {
    logs.push(`[Albo Pretorio Add-on] Avvio ricerca Albo Pretorio per: ${navigatedUrl || originalUrl}`);

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    logs.push(`[Albo Pretorio Add-on] Finestra temporale: ultimi 6 mesi (a partire dal ${formatDateToGG_MM_AA(cutoffDate)})`);

    let alboHtml = "";

  // 1. Probing & discovering Albo Pretorio section
  try {
    const res = await axios.get(baseUrl, {
      timeout: 10000,
      httpsAgent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(res.data);
    const candidateKeywords = [
      "albo pretorio",
      "albo online",
      "albo-pretorio",
      "albo_pretorio",
      "pubblicità legale",
      "pubblicita legale",
      "albo sindacale",
      "albo",
    ];

    $("a").each((_, el) => {
      const text = $(el).text().toLowerCase().trim();
      const href = $(el).attr("href");
      if (href && href !== "#" && !href.startsWith("javascript:")) {
        for (const kw of candidateKeywords) {
          if (text.includes(kw) || href.toLowerCase().includes(kw)) {
            alboUrl = resolveUrl(baseUrl, href);
            logs.push(`[Albo Pretorio Add-on] Individuato link Albo Pretorio: ${alboUrl} (parola chiave: "${kw}")`);
            return false;
          }
        }
      }
    });
  } catch (err: any) {
    logs.push(`[Albo Pretorio Add-on] Avviso verifica homepage: ${err.message}`);
  }

  // If not found directly, try standard well-known endpoints
  if (!alboUrl) {
    const probePaths = ["/albo-pretorio/", "/albo-online/", "/albo/", "/pubblicita-legale/"];
    for (const p of probePaths) {
      const testUrl = resolveUrl(baseUrl, p);
      try {
        const probeRes = await axios.get(testUrl, {
          timeout: 6000,
          httpsAgent,
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (probeRes.status === 200 && probeRes.data.length > 500) {
          alboUrl = testUrl;
          alboHtml = probeRes.data;
          logs.push(`[Albo Pretorio Add-on] Trovata sezione Albo standard: ${alboUrl}`);
          break;
        }
      } catch {
        // Continue to next probe
      }
    }
  }

  // If found and not yet loaded, fetch Albo Pretorio page
  if (alboUrl && !alboHtml) {
    try {
      const res = await axios.get(alboUrl, {
        timeout: 12000,
        httpsAgent,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      alboHtml = res.data;
    } catch (err: any) {
      logs.push(`[Albo Pretorio Add-on] Errore apertura Albo Pretorio (${alboUrl}): ${err.message}`);
    }
  }

  if (!alboUrl || !alboHtml) {
    logs.push("[Albo Pretorio Add-on] Nessuna sezione Albo Pretorio pubblica accessibile trovata.");
    return {
      alboUrl: alboUrl || baseUrl,
      attiTrovatiTotali: 0,
      attiFiltratiValidi: 0,
      attiEsclusi: 0,
      contratti: [],
      graduatoria_fascia: "",
      profilo_professionale: "",
      classe_di_concorso: "",
      ore_settimanali: "",
      decorrenza_da: "",
      decorrenza_a: "",
      logs,
    };
  }

  // 2. Parse notices from Albo Pretorio page
  const $albo = cheerio.load(alboHtml);
  const rawNotices: RawNotice[] = [];

  // Strategy A: Tables (tr rows)
  $albo("table tr").each((_, tr) => {
    const text = $albo(tr).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 10) return;

    // Look for link to detail or pdf
    let pdfUrl: string | undefined;
    let detailUrl: string | undefined;

    $albo(tr).find("a").each((_, a) => {
      const href = $albo(a).attr("href");
      if (href) {
        const fullHref = resolveUrl(alboUrl, href);
        if (fullHref.toLowerCase().includes(".pdf")) {
          pdfUrl = fullHref;
        } else if (!detailUrl && !href.startsWith("#") && !href.startsWith("javascript:")) {
          detailUrl = fullHref;
        }
      }
    });

    // Date extraction from row text
    const dateMatch = text.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    const dateObj = dateStr ? parseItalianDate(dateStr) : null;

    rawNotices.push({
      title: text,
      dateStr,
      dateObj,
      detailUrl,
      pdfUrl,
    });
  });

  // Strategy B: Cards / Articles / Lists
  $albo("article, .card, .atto, .bando, .documento, .post, .item, li").each((_, el) => {
    const titleEl = $albo(el).find("h1, h2, h3, h4, h5, .title, .titolo, strong, a").first();
    const title = titleEl.text().replace(/\s+/g, " ").trim() || $albo(el).text().replace(/\s+/g, " ").trim();
    if (!title || title.length < 10) return;

    let pdfUrl: string | undefined;
    let detailUrl: string | undefined;

    $albo(el).find("a").each((_, a) => {
      const href = $albo(a).attr("href");
      if (href) {
        const fullHref = resolveUrl(alboUrl, href);
        if (fullHref.toLowerCase().includes(".pdf")) {
          pdfUrl = fullHref;
        } else if (!detailUrl && !href.startsWith("#")) {
          detailUrl = fullHref;
        }
      }
    });

    const fullText = $albo(el).text().replace(/\s+/g, " ").trim();
    const dateMatch = fullText.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    const dateObj = dateStr ? parseItalianDate(dateStr) : null;

    rawNotices.push({
      title,
      dateStr,
      dateObj,
      detailUrl,
      pdfUrl,
    });
  });

  logs.push(`[Albo Pretorio Add-on] Rilevati ${rawNotices.length} elementi/righe nell'Albo Pretorio.`);

  let attiEsclusi = 0;
  const matchedNotices: RawNotice[] = [];

  // 3. Filter by Date (last 6 months) & Filter by Title (Inclusions/Exclusions)
  for (const notice of rawNotices) {
    // Check Date if present
    if (notice.dateObj && notice.dateObj < cutoffDate) {
      attiEsclusi++;
      continue;
    }

    // Check inclusion/exclusion filters
    const filterRes = matchesNoticeFilters(notice.title);
    if (!filterRes.included) {
      attiEsclusi++;
      continue;
    }

    matchedNotices.push(notice);
  }

  logs.push(`[Albo Pretorio Add-on] Bandi conformi ai filtri (ultimi 6 mesi & supplenze): ${matchedNotices.length} (Esclusi: ${attiEsclusi})`);

  // 4. Download attached PDFs temporarily and extract data with Gemini
  const extractedContracts: AlboPretorioContract[] = [];

  // Limit processing to first 5 matching PDFs to avoid timeouts
  const maxPdfToProcess = Math.min(matchedNotices.length, 5);

  for (let i = 0; i < maxPdfToProcess; i++) {
    const notice = matchedNotices[i];
    let pdfDownloadUrl = notice.pdfUrl;

    // If no direct PDF URL, try opening the detail page
    if (!pdfDownloadUrl && notice.detailUrl) {
      try {
        const detRes = await axios.get(notice.detailUrl, {
          timeout: 8000,
          httpsAgent,
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const $det = cheerio.load(detRes.data);
        $det("a").each((_, a) => {
          const href = $det(a).attr("href");
          if (href && (href.toLowerCase().includes(".pdf") || href.toLowerCase().includes("allegato") || href.toLowerCase().includes("download"))) {
            pdfDownloadUrl = resolveUrl(notice.detailUrl!, href);
            return false;
          }
        });
      } catch (detErr: any) {
        logs.push(`[Albo Pretorio Add-on] Impossibile aprire dettaglio atto (${notice.detailUrl}): ${detErr.message}`);
      }
    }

    if (!pdfDownloadUrl) {
      logs.push(`[Albo Pretorio Add-on] Nessun allegato PDF trovato per l'atto: "${notice.title.substring(0, 60)}..."`);
      continue;
    }

    logs.push(`[Albo Pretorio Add-on] Download temporaneo PDF allegato da: ${pdfDownloadUrl}`);

    // Temporary file path on disk (os.tmpdir)
    const tempFileName = `scuola_albo_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      const pdfRes = await axios.get(pdfDownloadUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        httpsAgent,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      const pdfBuffer = Buffer.from(pdfRes.data);

      // Write to temp file on disk
      await fs.promises.writeFile(tempFilePath, pdfBuffer);
      logs.push(`[Albo Pretorio Add-on] File temporaneo salvato su disco (${(pdfBuffer.length / 1024).toFixed(1)} KB). Analisi Gemini in corso...`);

      // Extract structured fields via Gemini AI
      const extracted = await extractFromPdfGemini(pdfBuffer, customApiKey);

      extractedContracts.push({
        id: `contratto_${Date.now()}_${i}`,
        titolo_bando: notice.title.substring(0, 150),
        data_pubblicazione: notice.dateStr || (notice.dateObj ? formatDateToGG_MM_AA(notice.dateObj) : formatDateToGG_MM_AA(new Date())),
        pdf_url: pdfDownloadUrl,
        graduatoria_fascia: extracted.graduatoria_fascia || "Non specificata",
        profilo_professionale: extracted.profilo_professionale || "Personale ATA / Docente",
        classe_di_concorso: extracted.classe_di_concorso || "",
        ore_settimanali: extracted.ore_settimanali || "",
        decorrenza_da: extracted.decorrenza_da || "",
        decorrenza_a: extracted.decorrenza_a || "",
      });

      logs.push(
        `[Albo Pretorio Add-on] Estrazione completata con successo per Atto #${i + 1}: Profilo="${extracted.profilo_professionale}", Fascia="${extracted.graduatoria_fascia}", Ore="${extracted.ore_settimanali}", Decorrenza=${extracted.decorrenza_da}-${extracted.decorrenza_a}`
      );
    } catch (pdfErr: any) {
      logs.push(`[Albo Pretorio Add-on] Errore durante l'elaborazione del PDF (${pdfDownloadUrl}): ${pdfErr.message}`);
    } finally {
      // 5. GESTIONE MEMORIA (Obbligatorio): Immediatamente dopo l'estrazione, ELIMINA il file temporaneo
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
          logs.push(`[Albo Pretorio Add-on] Pulizia memoria: file temporaneo ${tempFileName} eliminato con successo dal disco.`);
        }
      } catch (unlinkErr: any) {
        logs.push(`[Albo Pretorio Add-on] Avviso pulizia file temporaneo: ${unlinkErr.message}`);
      }
    }
  }

  // Aggregate fields for single record representation in CSV
  const graduatoria_fascia = extractedContracts.map((c) => c.graduatoria_fascia).filter(Boolean).join(" | ") || (matchedNotices.length > 0 ? "Bandi rilevati" : "");
  const profilo_professionale = extractedContracts.map((c) => c.profilo_professionale).filter(Boolean).join(" | ") || "";
  const classe_di_concorso = extractedContracts.map((c) => c.classe_di_concorso).filter(Boolean).join(" | ") || "";
  const ore_settimanali = extractedContracts.map((c) => c.ore_settimanali).filter(Boolean).join(" | ") || "";
  const decorrenza_da = extractedContracts.map((c) => c.decorrenza_da).filter(Boolean).join(" | ") || "";
  const decorrenza_a = extractedContracts.map((c) => c.decorrenza_a).filter(Boolean).join(" | ") || "";

    return {
      alboUrl,
      attiTrovatiTotali: rawNotices.length,
      attiFiltratiValidi: matchedNotices.length,
      attiEsclusi,
      contratti: extractedContracts,
      graduatoria_fascia,
      profilo_professionale,
      classe_di_concorso,
      ore_settimanali,
      decorrenza_da,
      decorrenza_a,
      logs,
    };
  } catch (globalErr: any) {
    logs.push(`[Albo Pretorio Add-on] Errore critico durante l'elaborazione: ${globalErr.message}`);
    return {
      alboUrl: alboUrl || baseUrl,
      attiTrovatiTotali: 0,
      attiFiltratiValidi: 0,
      attiEsclusi: 0,
      contratti: [],
      graduatoria_fascia: "",
      profilo_professionale: "",
      classe_di_concorso: "",
      ore_settimanali: "",
      decorrenza_da: "",
      decorrenza_a: "",
      logs,
    };
  }
}
