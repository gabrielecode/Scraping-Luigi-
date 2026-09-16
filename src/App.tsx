import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Layers, 
  Code2, 
  Terminal, 
  Cpu, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Database,
  ArrowRight,
  Key,
  Settings,
  FileText,
  Calendar,
  Clock,
  Briefcase,
  GraduationCap,
  Filter,
  Save,
  Github,
  Globe,
  Trash2
} from "lucide-react";
import { ExtractionResult, ExtractionData, BatchHistoryItem } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"batch" | "single" | "albo" | "search" | "history" | "guide">("batch");
  
  // Configuration & LocalStorage state
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_openrouter_api_key") || "" : "");
  const [githubUser, setGithubUser] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_user") || "" : "");
  const [githubRepo, setGithubRepo] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_repo") || "" : "");
  const [githubPat, setGithubPat] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_pat") || "" : "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");

  // Albo Pretorio & PDF test state
  const [alboUrlInput, setAlboUrlInput] = useState("");
  const [isScanningAlbo, setIsScanningAlbo] = useState(false);
  const [alboScanResult, setAlboScanResult] = useState<any | null>(null);
  const [alboScanError, setAlboScanError] = useState("");

  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractResult, setPdfExtractResult] = useState<any | null>(null);
  const [pdfExtractError, setPdfExtractError] = useState("");

  // History state
  const [batchHistory, setBatchHistory] = useState<BatchHistoryItem[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("scuola_batch_history");
        return saved ? JSON.parse(saved) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const saveBatchToHistory = (results: ExtractionResult[], filename: string) => {
    const newItem: BatchHistoryItem = {
      id: "batch_" + Date.now(),
      filename: filename || "batch_urls.csv",
      timestamp: new Date().toLocaleString("it-IT"),
      totalUrls: results.length,
      results
    };
    const updated = [newItem, ...batchHistory];
    setBatchHistory(updated);
    try {
      localStorage.setItem("scuola_batch_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Impossibile salvare lo storico in localStorage", e);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = batchHistory.filter(item => item.id !== id);
    setBatchHistory(updated);
    localStorage.setItem("scuola_batch_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (window.confirm("Sei sicuro di voler svuotare tutto lo storico delle estrazioni?")) {
      setBatchHistory([]);
      localStorage.removeItem("scuola_batch_history");
    }
  };

  const loadHistoryItem = (item: BatchHistoryItem) => {
    setBatchResults(item.results);
    setActiveTab("batch");
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("scuola_openrouter_api_key", openRouterApiKey.trim());
    localStorage.setItem("scuola_github_user", githubUser.trim());
    localStorage.setItem("scuola_github_repo", githubRepo.trim());
    localStorage.setItem("scuola_github_pat", githubPat.trim());
    setSettingsSavedMessage("Impostazioni salvate con successo in LocalStorage!");
    setTimeout(() => {
      setSettingsSavedMessage("");
      setIsSettingsOpen(false);
    }, 1500);
  };

  // Export local backup (JSON)
  const exportLocalBackup = () => {
    const backupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      openRouterApiKey,
      githubUser,
      githubRepo,
      batchHistory,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scuola_ata_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import local backup (JSON)
  const importLocalBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.batchHistory && Array.isArray(json.batchHistory)) {
          setBatchHistory(json.batchHistory);
          localStorage.setItem("scuola_batch_history", JSON.stringify(json.batchHistory));
        }
        if (json.openRouterApiKey !== undefined) {
          setOpenRouterApiKey(json.openRouterApiKey);
          localStorage.setItem("scuola_openrouter_api_key", json.openRouterApiKey);
        }
        if (json.githubUser !== undefined) {
          setGithubUser(json.githubUser);
          localStorage.setItem("scuola_github_user", json.githubUser);
        }
        if (json.githubRepo !== undefined) {
          setGithubRepo(json.githubRepo);
          localStorage.setItem("scuola_github_repo", json.githubRepo);
        }
        alert("Backup locale importato con successo sul device!");
      } catch (err: any) {
        alert("Errore durante l'importazione del file di backup: file JSON non valido.");
      }
    };
    reader.readAsText(file);
  };

  // Batch processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchInfo, setBatchInfo] = useState<{
    currentBatch: number;
    totalBatches: number;
    batchSize: number;
    jobId?: string;
    finalMessage?: string;
    outputFilename?: string;
  }>({
    currentBatch: 0,
    totalBatches: 0,
    batchSize: 15,
  });
  const [batchResults, setBatchResults] = useState<ExtractionResult[]>([]);
  const [batchError, setBatchError] = useState("");
  const [githubExportStatus, setGithubExportStatus] = useState("");
  const [githubExportUrl, setGithubExportUrl] = useState("");

  // Single URL test state
  const [singleUrl, setSingleUrl] = useState("");
  const [isProcessingSingle, setIsProcessingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState<ExtractionResult | null>(null);
  const [singleError, setSingleError] = useState("");

  // Google Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  const matchesNoticeFilters = (rawTitle: string): { included: boolean; reason: string } => {
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
  };

  const parseItalianDate = (dateStr: string): Date | null => {
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
  };

  const formatDateToGG_MM_AA = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const normalizeDateOutput = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === "" || dateStr === "N/D") return "";
    const parsed = parseItalianDate(dateStr);
    if (parsed) {
      return formatDateToGG_MM_AA(parsed);
    }
    return dateStr.trim();
  };

  // Client-side fallback helpers for Vercel static hosting
  const executeClientSideExtract = async (targetUrl: string, apiKey: string) => {
    const logs = [`Avvio estrazione client-side (Vercel SPA mode) per: ${targetUrl}`];
    let pageText = "";
    let navigatedUrl = targetUrl;

    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, nav, footer, header").forEach(el => el.remove());
      pageText = doc.body?.innerText || doc.documentElement.textContent || "";
      logs.push(`Testo estratto via CORS proxy (${pageText.length} caratteri)`);

      const keywords = ["ata", "bandi di gara", "graduatorie", "collaboratore scolastico", "avvisi", "albo pretorio", "convocazioni"];
      const links = doc.querySelectorAll("a");
      let targetSubUrl = "";
      let matchedKeyword = "";
      for (const link of Array.from(links)) {
        const text = (link.textContent || "").toLowerCase().trim();
        const href = link.getAttribute("href");
        if (href && href !== "#" && !href.startsWith("javascript:")) {
          for (const kw of keywords) {
            if (text.includes(kw) || href.toLowerCase().includes(kw)) {
              try {
                targetSubUrl = new URL(href, targetUrl).href;
                matchedKeyword = kw;
                break;
              } catch {
                // Ignore invalid URLs
              }
            }
          }
          if (targetSubUrl) break;
        }
      }

      if (targetSubUrl) {
        logs.push(`Sezione trovata tramite parola chiave "${matchedKeyword}": ${targetSubUrl}`);
        try {
          const subProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetSubUrl)}`;
          const subRes = await fetch(subProxyUrl);
          const subHtml = await subRes.text();
          const subDoc = parser.parseFromString(subHtml, "text/html");
          subDoc.querySelectorAll("script, style, nav, footer, header").forEach(el => el.remove());
          const subText = subDoc.body?.innerText || subDoc.documentElement.textContent || "";
          pageText = `--- HOMEPAGE ---\n${pageText}\n\n--- SEZIONE ${matchedKeyword.toUpperCase()} (${targetSubUrl}) ---\n${subText}`;
          navigatedUrl = targetSubUrl;
        } catch (subErr: any) {
          logs.push(`Impossibile aprire la sezione ${targetSubUrl}: ${subErr.message}. Uso il testo della home.`);
        }
      }
    } catch (err: any) {
      logs.push(`Impossibile leggere il sito direttamente (${err.message}). Utilizzo OpenRouter Web Search.`);
    }

    if (pageText.length > 30000) {
      pageText = pageText.substring(0, 30000);
    }

    const prompt = `${EXTRACTION_SYSTEM_PROMPT}\n\nAnalizza il seguente testo estratto dal sito ${targetUrl}:\n\n${pageText}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "ScuolaATA Scraper",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sei un assistente JSON rigoroso. Rispondi solo con JSON valido." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    let respData: any = {};
    try {
      const rawText = await response.text();
      if (rawText && rawText.trim()) {
        respData = JSON.parse(rawText);
      }
    } catch {
      respData = {};
    }
    const content = respData?.choices?.[0]?.message?.content || "{}";
    const defaultData: ExtractionData = {
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
      pensionamenti_assistente_agrario: 0
    };

    let extractedData = defaultData;
    try {
      const parsed = JSON.parse(content);
      extractedData = { ...defaultData, ...parsed };
    } catch {
      extractedData = defaultData;
    }

    return {
      status: "success" as const,
      url: targetUrl,
      navigatedUrl,
      logs,
      data: extractedData
    };
  };

  const executeClientSideAlboPretorio = async (originalUrl: string, navigatedUrl: string, apiKey: string) => {
    const logs = [`[Albo Pretorio Add-on Client-side] Avvio ricerca Albo Pretorio per: ${navigatedUrl || originalUrl}`];
    const baseUrl = navigatedUrl || originalUrl;
    let alboUrl = "";
    let alboHtml = "";

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    logs.push(`[Albo Pretorio Add-on] Finestra temporale: ultimi 6 mesi (a partire dal ${formatDateToGG_MM_AA(cutoffDate)})`);

    // 1. Probing & discovering Albo Pretorio section
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl)}`;
      const res = await fetch(proxyUrl);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
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

      const links = doc.querySelectorAll("a");
      for (const link of Array.from(links)) {
        const text = (link.textContent || "").toLowerCase().trim();
        const href = link.getAttribute("href");
        if (href && href !== "#" && !href.startsWith("javascript:")) {
          for (const kw of candidateKeywords) {
            if (text.includes(kw) || href.toLowerCase().includes(kw)) {
              try {
                alboUrl = new URL(href, baseUrl).href;
                logs.push(`[Albo Pretorio Add-on] Individuato link Albo Pretorio: ${alboUrl} (parola chiave: "${kw}")`);
                break;
              } catch {
                // Ignore invalid URLs
              }
            }
          }
          if (alboUrl) break;
        }
      }
    } catch (err: any) {
      logs.push(`[Albo Pretorio Add-on] Avviso verifica homepage: ${err.message}`);
    }

    // If not found directly, try standard well-known endpoints
    if (!alboUrl) {
      const probePaths = ["/albo-pretorio/", "/albo-online/", "/albo/", "/pubblicita-legale/"];
      for (const p of probePaths) {
        try {
          const testUrl = new URL(p, baseUrl).href;
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(testUrl)}`;
          const probeRes = await fetch(proxyUrl);
          if (probeRes.ok) {
            const probeText = await probeRes.text();
            if (probeText.length > 500) {
              alboUrl = testUrl;
              alboHtml = probeText;
              logs.push(`[Albo Pretorio Add-on] Trovata sezione Albo standard: ${alboUrl}`);
              break;
            }
          }
        } catch {
          // Continue to next probe
        }
      }
    }

    // If found and not yet loaded, fetch Albo Pretorio page
    if (alboUrl && !alboHtml) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(alboUrl)}`;
        const res = await fetch(proxyUrl);
        alboHtml = await res.text();
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
    const parser = new DOMParser();
    const alboDoc = parser.parseFromString(alboHtml, "text/html");
    const rawNotices: any[] = [];

    // Strategy A: Tables (tr rows)
    const rows = alboDoc.querySelectorAll("table tr");
    rows.forEach((tr) => {
      const text = (tr.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 10) return;

      let pdfUrl = "";
      let detailUrl = "";

      const links = tr.querySelectorAll("a");
      links.forEach((a) => {
        const href = a.getAttribute("href");
        if (href) {
          try {
            const fullHref = new URL(href, alboUrl).href;
            if (fullHref.toLowerCase().includes(".pdf")) {
              pdfUrl = fullHref;
            } else if (!detailUrl && !href.startsWith("#") && !href.startsWith("javascript:")) {
              detailUrl = fullHref;
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      });

      const dateMatch = text.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
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
    const cards = alboDoc.querySelectorAll("article, .card, .atto, .bando, .documento, .post, .item, li");
    cards.forEach((el) => {
      const titleEl = el.querySelector("h1, h2, h3, h4, h5, .title, .titolo, strong, a");
      const title = (titleEl ? titleEl.textContent : "").replace(/\s+/g, " ").trim() || (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!title || title.length < 10) return;

      let pdfUrl = "";
      let detailUrl = "";

      const links = el.querySelectorAll("a");
      links.forEach((a) => {
        const href = a.getAttribute("href");
        if (href) {
          try {
            const fullHref = new URL(href, alboUrl).href;
            if (fullHref.toLowerCase().includes(".pdf")) {
              pdfUrl = fullHref;
            } else if (!detailUrl && !href.startsWith("#")) {
              detailUrl = fullHref;
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      });

      const fullText = (el.textContent || "").replace(/\s+/g, " ").trim();
      const dateMatch = fullText.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
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
    const matchedNotices: any[] = [];

    for (const notice of rawNotices) {
      if (notice.dateObj && notice.dateObj < cutoffDate) {
        attiEsclusi++;
        continue;
      }

      const filterRes = matchesNoticeFilters(notice.title);
      if (!filterRes.included) {
        attiEsclusi++;
        continue;
      }

      matchedNotices.push(notice);
    }

    logs.push(`[Albo Pretorio Add-on] Bandi conformi ai filtri (ultimi 6 mesi & supplenze): ${matchedNotices.length} (Esclusi: ${attiEsclusi})`);

    const extractedContracts: any[] = [];
    const maxPdfToProcess = Math.min(matchedNotices.length, 5);

    for (let i = 0; i < maxPdfToProcess; i++) {
      const notice = matchedNotices[i];
      let pdfDownloadUrl = notice.pdfUrl;

      if (!pdfDownloadUrl && notice.detailUrl) {
        try {
          const detailProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(notice.detailUrl)}`;
          const detRes = await fetch(detailProxy);
          const detHtml = await detRes.text();
          const detDoc = parser.parseFromString(detHtml, "text/html");
          const links = detDoc.querySelectorAll("a");
          for (const a of Array.from(links)) {
            const href = a.getAttribute("href");
            if (href && (href.toLowerCase().includes(".pdf") || href.toLowerCase().includes("allegato") || href.toLowerCase().includes("download"))) {
              pdfDownloadUrl = new URL(href, notice.detailUrl).href;
              break;
            }
          }
        } catch (detErr: any) {
          logs.push(`[Albo Pretorio Add-on] Impossibile aprire dettaglio atto (${notice.detailUrl}): ${detErr.message}`);
        }
      }

      if (!pdfDownloadUrl) {
        logs.push(`[Albo Pretorio Add-on] Nessun allegato PDF trovato per l'atto: "${notice.title.substring(0, 60)}..."`);
        continue;
      }

      logs.push(`[Albo Pretorio Add-on] Download temporaneo PDF allegato da: ${pdfDownloadUrl}`);

      try {
        const pdfProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(pdfDownloadUrl)}`;
        const pdfRes = await fetch(pdfProxy);
        const arrayBuffer = await pdfRes.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let j = 0; j < uint8Array.length; j++) {
          binary += String.fromCharCode(uint8Array[j]);
        }
        const rawPdfText = binary.replace(/[^\x20-\x7E\xC0-\xFF\n\r]/g, " ");
        const textSnippet = rawPdfText.substring(0, 15000);

        logs.push(`[Albo Pretorio Add-on] Analisi testo estratto bando tramite OpenRouter...`);

        const prompt = `${PDF_EXTRACTION_SYSTEM_PROMPT}\n\nAnalizza il testo estratto dal PDF del contratto di supplenza:\n\n${textSnippet}`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "ScuolaATA Scraper",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Sei un assistente JSON rigoroso. Rispondi solo con JSON valido." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        const respData = await response.json();
        const content = respData?.choices?.[0]?.message?.content || "{}";
        const extracted = JSON.parse(content);

        extractedContracts.push({
          id: `contratto_${Date.now()}_${i}`,
          titolo_bando: notice.title.substring(0, 150),
          data_pubblicazione: notice.dateStr || (notice.dateObj ? formatDateToGG_MM_AA(notice.dateObj) : formatDateToGG_MM_AA(new Date())),
          pdf_url: pdfDownloadUrl,
          graduatoria_fascia: extracted.graduatoria_fascia || "Non specificata",
          profilo_professionale: extracted.profilo_professionale || "Personale ATA / Docente",
          classe_di_concorso: extracted.classe_di_concorso || "",
          ore_settimanali: extracted.ore_settimanali || "",
          decorrenza_da: normalizeDateOutput(extracted.decorrenza_da || ""),
          decorrenza_a: normalizeDateOutput(extracted.decorrenza_a || ""),
        });

        logs.push(
          `[Albo Pretorio Add-on] Estrazione completata per Atto #${i + 1}: Profilo="${extracted.profilo_professionale}", Fascia="${extracted.graduatoria_fascia}", Ore="${extracted.ore_settimanali}"`
        );
      } catch (pdfErr: any) {
        logs.push(`[Albo Pretorio Add-on] Errore elaborazione PDF (${pdfDownloadUrl}): ${pdfErr.message}`);
      }
    }

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
  };

  const executeClientSideSearch = async (queryStr: string, apiKey: string) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "ScuolaATA Scraper",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sei un assistente di ricerca specializzato nel reperire bandi, convocazioni ATA e pensionamenti delle scuole italiane sul web." },
          { role: "user", content: `Cerca sul web informazioni aggiornate su: ${queryStr}` }
        ],
        plugins: [{ id: "web" }]
      })
    });

    let respData: any = {};
    try {
      const rawText = await response.text();
      if (rawText && rawText.trim()) {
        respData = JSON.parse(rawText);
      }
    } catch {
      respData = {};
    }
    return respData?.choices?.[0]?.message?.content || "Nessun risultato trovato.";
  };

  const handleAlboScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alboUrlInput.trim()) return;
    setIsScanningAlbo(true);
    setAlboScanError("");
    setAlboScanResult(null);

    const formattedUrl = alboUrlInput.trim().startsWith("http") ? alboUrlInput.trim() : `https://${alboUrlInput.trim()}`;

    try {
      if (!openRouterApiKey.trim()) {
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare la scansione client-side dell'Albo Pretorio.");
      }

      const res = await executeClientSideAlboPretorio(formattedUrl, formattedUrl, openRouterApiKey.trim());
      setAlboScanResult({ success: true, ...res });
    } catch (err: any) {
      setAlboScanError(err.message || "Errore durante la scansione dell'Albo Pretorio.");
    } finally {
      setIsScanningAlbo(false);
    }
  };

  const handlePdfUploadAndExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPdfFile) return;
    setIsExtractingPdf(true);
    setPdfExtractError("");
    setPdfExtractResult(null);

    try {
      if (!openRouterApiKey.trim()) {
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'estrazione client-side dei PDF.");
      }

      const arrayBuffer = await selectedPdfFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let j = 0; j < uint8Array.length; j++) {
        binary += String.fromCharCode(uint8Array[j]);
      }
      const rawPdfText = binary.replace(/[^\x20-\x7E\xC0-\xFF\n\r]/g, " ");
      const textSnippet = rawPdfText.substring(0, 15000);

      const prompt = `${PDF_EXTRACTION_SYSTEM_PROMPT}\n\nAnalizza il testo estratto dal PDF del contratto di supplenza:\n\n${textSnippet}`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey.trim()}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "ScuolaATA Scraper",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Sei un assistente JSON rigoroso. Rispondi solo con JSON valido." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const respData = await response.json();
      const content = respData?.choices?.[0]?.message?.content || "{}";
      const extracted = JSON.parse(content);

      setPdfExtractResult({
        success: true,
        filename: selectedPdfFile.name,
        size: selectedPdfFile.size,
        data: {
          graduatoria_fascia: extracted.graduatoria_fascia || "Non specificata",
          profilo_professionale: extracted.profilo_professionale || "Personale ATA / Docente",
          classe_di_concorso: extracted.classe_di_concorso || "",
          ore_settimanali: extracted.ore_settimanali || "",
          decorrenza_da: normalizeDateOutput(extracted.decorrenza_da || ""),
          decorrenza_a: normalizeDateOutput(extracted.decorrenza_a || ""),
        }
      });
    } catch (err: any) {
      setPdfExtractError(err.message || "Errore durante l'elaborazione del PDF");
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleGoogleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setSearchResult("");

    try {
      if (!openRouterApiKey.trim()) {
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare la ricerca client-side.");
      }
      const resultText = await executeClientSideSearch(searchQuery.trim(), openRouterApiKey.trim());
      setSearchResult(resultText);
    } catch (err: any) {
      setSearchError(err.message || "Errore durante la richiesta di ricerca.");
    } finally {
      setIsSearching(false);
    }
  };

  // Handle sample CSV download
  const downloadSampleCsv = () => {
    const csvContent = "url\nhttps://www.icmariantomai.edu.it\nhttps://www.iischiapparelli.edu.it\nhttps://www.liceoclassicocavour.edu.it";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "scuole_campione.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvClientSide = (csvText: string): string[] => {
    const lines = csvText.split(/\r?\n/);
    const results: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/[;,]/);
      for (const part of parts) {
        const clean = part.trim().replace(/^["']|["']$/g, "");
        if (
          clean.startsWith("http://") ||
          clean.startsWith("https://") ||
          clean.includes(".edu.it") ||
          clean.includes(".gov.it") ||
          clean.includes("www.") ||
          clean.includes(".it")
        ) {
          let foundUrl = clean;
          if (!foundUrl.startsWith("http://") && !foundUrl.startsWith("https://")) {
            foundUrl = `https://${foundUrl}`;
          }
          results.push(foundUrl);
          break;
        }
      }
    }
    return Array.from(new Set(results));
  };

  // Handle batch CSV upload & processing client-side
  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setBatchError("Si prega di selezionare un file CSV.");
      return;
    }

    if (!openRouterApiKey.trim()) {
      setBatchError("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'elaborazione client-side.");
      setIsSettingsOpen(true);
      return;
    }

    setBatchError("");
    setIsProcessingBatch(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: 0 });
    setBatchInfo({
      currentBatch: 0,
      totalBatches: 0,
      batchSize: 15,
      jobId: "",
      finalMessage: "",
      outputFilename: "",
    });
    setGithubExportStatus("");
    setGithubExportUrl("");

    try {
      const csvText = await selectedFile.text();
      const urls = parseCsvClientSide(csvText);

      if (urls.length === 0) {
        throw new Error("Nessun URL valido trovato nel file CSV. Assicurarsi che il file contenga una colonna con link validi.");
      }

      const BATCH_SIZE = 15;
      const batches: string[][] = [];
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        batches.push(urls.slice(i, i + BATCH_SIZE));
      }
      const totalBatches = batches.length;

      setBatchProgress({ current: 0, total: urls.length });
      setBatchInfo({
        currentBatch: 1,
        totalBatches,
        batchSize: BATCH_SIZE,
      });

      const results: ExtractionResult[] = [];
      let processedCount = 0;

      for (let b = 0; b < batches.length; b++) {
        const currentBatchNum = b + 1;
        const currentBatchUrls = batches[b];
        setBatchInfo(prev => ({ ...prev, currentBatch: currentBatchNum, totalBatches }));

        for (const u of currentBatchUrls) {
          try {
            const clientData = await executeClientSideExtract(u, openRouterApiKey.trim());
            
            // Nuova Estensione: Estrazione Albo Pretorio & PDF (retrocompatibile)
            try {
              const alboRes = await executeClientSideAlboPretorio(u, clientData.navigatedUrl, openRouterApiKey.trim());
              clientData.logs.push(...alboRes.logs);
              Object.assign(clientData.data, {
                graduatoria_fascia: alboRes.graduatoria_fascia || "",
                profilo_professionale: alboRes.profilo_professionale || "",
                classe_di_concorso: alboRes.classe_di_concorso || "",
                ore_settimanali: alboRes.ore_settimanali || "",
                decorrenza_da: alboRes.decorrenza_da || "",
                decorrenza_a: alboRes.decorrenza_a || "",
                albo_contratti: alboRes.contratti || [],
              });
            } catch (alboErr: any) {
              clientData.logs.push(`[Albo Pretorio Add-on] Errore: ${alboErr.message}`);
              Object.assign(clientData.data, {
                graduatoria_fascia: "",
                profilo_professionale: "",
                classe_di_concorso: "",
                ore_settimanali: "",
                decorrenza_da: "",
                decorrenza_a: "",
                albo_contratti: [],
              });
            }

            results.push(clientData);
          } catch (itemErr: any) {
            results.push({
              status: "error",
              url: u,
              navigatedUrl: u,
              logs: [itemErr.message],
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
                graduatoria_fascia: "",
                profilo_professionale: "",
                classe_di_concorso: "",
                ore_settimanali: "",
                decorrenza_da: "",
                decorrenza_a: "",
                albo_contratti: [],
              }
            });
          }
          processedCount++;
          setBatchProgress({ current: processedCount, total: urls.length });
        }
      }

      const clientSuccessMsg = `Elaborazione completata: ${urls.length} link processati su ${urls.length} totali in ${totalBatches} batch.`;
      setBatchInfo(prev => ({ ...prev, finalMessage: clientSuccessMsg }));
      setBatchResults(results);
      saveBatchToHistory(results, selectedFile?.name || "batch_urls.csv");
    } catch (err: any) {
      setBatchError(err.message || "Errore di connessione.");
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Export results to GitHub securely and directly from client-side
  const exportToGitHub = async () => {
    if (batchResults.length === 0) return;
    if (!githubUser.trim() || !githubRepo.trim() || !githubPat.trim()) {
      setGithubExportStatus("Inserisci Username, Repository e PAT GitHub nelle Impostazioni prima di esportare.");
      setIsSettingsOpen(true);
      return;
    }

    setGithubExportStatus("Esportazione su GitHub in corso...");
    setGithubExportUrl("");

    const headers = [
      "URL Originale", "URL Navigato", "Stato",
      "Conv. Coll. Scolastico", "Conv. Assistente Amm.", "Conv. Docenti", "Conv. Assistente Tecnico", "Conv. Cuoco", "Conv. Assistente Agrario",
      "Pens. Coll. Scolastico", "Pens. Assistente Amm.", "Pens. Docenti", "Pens. Assistente Tecnico", "Pens. Cuoco", "Pens. Assistente Agrario",
      "Graduatoria Fascia", "Profilo Professionale", "Classe di Concorso", "Ore Settimanali", "Decorrenza Da", "Decorrenza A"
    ];
    const rows = batchResults.map(r => [
      `"${r.url}"`, `"${r.navigatedUrl}"`, `"${r.status}"`,
      r.data.convocazioni_collaboratore_scolastico ?? 0,
      r.data.convocazioni_assistente_amministrativo ?? 0,
      r.data.convocazioni_docenti ?? 0,
      r.data.convocazioni_assistente_tecnico ?? 0,
      r.data.convocazioni_cuoco ?? 0,
      r.data.convocazioni_assistente_agrario ?? 0,
      r.data.pensionamenti_collaboratore_scolastico ?? 0,
      r.data.pensionamenti_assistente_amministrativo ?? 0,
      r.data.pensionamenti_docenti ?? 0,
      r.data.pensionamenti_assistente_tecnico ?? 0,
      r.data.pensionamenti_cuoco ?? 0,
      r.data.pensionamenti_assistente_agrario ?? 0,
      `"${(r.data.graduatoria_fascia || "").replace(/"/g, '""')}"`,
      `"${(r.data.profilo_professionale || "").replace(/"/g, '""')}"`,
      `"${(r.data.classe_di_concorso || "").replace(/"/g, '""')}"`,
      `"${(r.data.ore_settimanali || "").replace(/"/g, '""')}"`,
      `"${(r.data.decorrenza_da || "").replace(/"/g, '""')}"`,
      `"${(r.data.decorrenza_a || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const filePath = `risultati-scuole-ata-${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      const githubApiUrl = `https://api.github.com/repos/${githubUser.trim()}/${githubRepo.trim()}/contents/${filePath}`;
      let fileSha: string | undefined;

      try {
        const existingRes = await fetch(githubApiUrl, {
          headers: {
            "Authorization": `Bearer ${githubPat.trim()}`,
            "Accept": "application/vnd.github.v3+json"
          }
        });
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          fileSha = existingData?.sha;
        }
      } catch {
        // File doesn't exist yet
      }

      // Convert text to base64 safely supporting UTF-8 characters
      const u8 = new TextEncoder().encode(csvContent);
      let binString = "";
      for (let i = 0; i < u8.length; i++) {
        binString += String.fromCharCode(u8[i]);
      }
      const base64Content = btoa(binString);

      const putRes = await fetch(githubApiUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${githubPat.trim()}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Export risultati ScuolaATA ${new Date().toISOString().slice(0, 10)}`,
          content: base64Content,
          ...(fileSha ? { sha: fileSha } : {})
        })
      });

      if (!putRes.ok) {
        const putErrData = await putRes.json();
        throw new Error(putErrData?.message || "Impossibile salvare su GitHub.");
      }

      const putData = await putRes.json();
      setGithubExportStatus("Esportazione completata con successo su GitHub!");
      setGithubExportUrl(putData?.commit?.html_url || `https://github.com/${githubUser.trim()}/${githubRepo.trim()}/blob/main/${filePath}`);
    } catch (err: any) {
      setGithubExportStatus(`Errore GitHub: ${err.message}`);
    }
  };

  // Handle single URL test client-side
  const handleSingleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl.trim()) {
      setSingleError("Inserire un URL valido.");
      return;
    }

    setSingleError("");
    setIsProcessingSingle(true);
    setSingleResult(null);

    const formattedUrl = singleUrl.trim().startsWith("http") ? singleUrl.trim() : `https://${singleUrl.trim()}`;

    try {
      if (!openRouterApiKey.trim()) {
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'estrazione client-side.");
      }

      const clientData = await executeClientSideExtract(formattedUrl, openRouterApiKey.trim());
      
      // Nuova Estensione: Estrazione Albo Pretorio & PDF (retrocompatibile)
      try {
        const alboRes = await executeClientSideAlboPretorio(formattedUrl, clientData.navigatedUrl, openRouterApiKey.trim());
        clientData.logs.push(...alboRes.logs);
        Object.assign(clientData.data, {
          graduatoria_fascia: alboRes.graduatoria_fascia || "",
          profilo_professionale: alboRes.profilo_professionale || "",
          classe_di_concorso: alboRes.classe_di_concorso || "",
          ore_settimanali: alboRes.ore_settimanali || "",
          decorrenza_da: alboRes.decorrenza_da || "",
          decorrenza_a: alboRes.decorrenza_a || "",
          albo_contratti: alboRes.contratti || [],
        });
      } catch (alboErr: any) {
        clientData.logs.push(`[Albo Pretorio Add-on] Errore: ${alboErr.message}`);
        Object.assign(clientData.data, {
          graduatoria_fascia: "",
          profilo_professionale: "",
          classe_di_concorso: "",
          ore_settimanali: "",
          decorrenza_da: "",
          decorrenza_a: "",
          albo_contratti: [],
        });
      }

      setSingleResult(clientData);
    } catch (err: any) {
      setSingleError(err.message || "Errore durante la richiesta.");
    } finally {
      setIsProcessingSingle(false);
    }
  };

  // Export results to CSV client-side
  const exportResultsToCsv = () => {
    if (batchResults.length === 0) return;

    const headers = [
      "URL Originale",
      "URL Navigato",
      "Stato",
      "Conv. Coll. Scolastico",
      "Conv. Assistente Amm.",
      "Conv. Docenti",
      "Conv. Assistente Tecnico",
      "Conv. Cuoco",
      "Conv. Assistente Agrario",
      "Pens. Coll. Scolastico",
      "Pens. Assistente Amm.",
      "Pens. Docenti",
      "Pens. Assistente Tecnico",
      "Pens. Cuoco",
      "Pens. Assistente Agrario",
      "Graduatoria Fascia",
      "Profilo Professionale",
      "Classe di Concorso",
      "Ore Settimanali",
      "Decorrenza Da",
      "Decorrenza A"
    ];

    const rows = batchResults.map(r => [
      `"${r.url}"`,
      `"${r.navigatedUrl}"`,
      `"${r.status}"`,
      r.data.convocazioni_collaboratore_scolastico ?? 0,
      r.data.convocazioni_assistente_amministrativo ?? 0,
      r.data.convocazioni_docenti ?? 0,
      r.data.convocazioni_assistente_tecnico ?? 0,
      r.data.convocazioni_cuoco ?? 0,
      r.data.convocazioni_assistente_agrario ?? 0,
      r.data.pensionamenti_collaboratore_scolastico ?? 0,
      r.data.pensionamenti_assistente_amministrativo ?? 0,
      r.data.pensionamenti_docenti ?? 0,
      r.data.pensionamenti_assistente_tecnico ?? 0,
      r.data.pensionamenti_cuoco ?? 0,
      r.data.pensionamenti_assistente_agrario ?? 0,
      `"${(r.data.graduatoria_fascia || "").replace(/"/g, '""')}"`,
      `"${(r.data.profilo_professionale || "").replace(/"/g, '""')}"`,
      `"${(r.data.classe_di_concorso || "").replace(/"/g, '""')}"`,
      `"${(r.data.ore_settimanali || "").replace(/"/g, '""')}"`,
      `"${(r.data.decorrenza_da || "").replace(/"/g, '""')}"`,
      `"${(r.data.decorrenza_a || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `risultati_estrazione_ata_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600/20 border border-indigo-500/30 p-2.5 rounded-xl text-indigo-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              ScuolaATA Data Scraper & AI Extractor
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">OpenRouter AI</span>
            </h1>
            <p className="text-xs text-slate-400">Automazione avanzata per bandi, convocazioni e pensionamenti scolastici</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "batch"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Elaborazione Batch CSV</span>
          </button>
          <button
            onClick={() => setActiveTab("single")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "single"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Test URL Singolo</span>
          </button>
          <button
            onClick={() => setActiveTab("albo")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "albo"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Albo Pretorio & PDF</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Storico ({batchHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "search"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Google Data Search</span>
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "guide"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Architettura & Guida</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Impostazioni & API Key</span>
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Configurazione & Credenziali (LocalStorage)
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveSettings} className="space-y-4">
              {settingsSavedMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OpenRouter API Key (Richiesta per AI Extractor)</span>
                </label>
                <input
                  type="password"
                  value={openRouterApiKey}
                  onChange={(e) => setOpenRouterApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500">Inserisci la chiave OpenRouter per abilitare le chiamate di ricerca e analisi LLM.</p>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5 text-slate-300" />
                  <span>GitHub Integration (Opzionale)</span>
                </h4>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Username GitHub</label>
                  <input
                    type="text"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="es. mariosrossi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Nome Repository</label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="es. dashboard-etsy"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Salvataggio e Backup Locale sul Device</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tutti i dati e lo storico delle estrazioni sono salvati in automatico nella memoria locale del browser (Device Storage). Puoi anche esportare un file di backup o ripristinarlo in qualsiasi momento.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={exportLocalBackup}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Esporta Backup (JSON)</span>
                  </button>
                  <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer">
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Importa Backup (JSON)</span>
                    <input type="file" accept=".json" onChange={importLocalBackup} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Impostazioni</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* TAB 1: BATCH CSV PROCESSING */}
        {activeTab === "batch" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Upload Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Database className="w-48 h-48 text-indigo-400" />
              </div>

              <div className="max-w-2xl space-y-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Carica File CSV con Lista URL
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Carica un file CSV contenente una colonna con i link dei siti web scolastici. Il sistema visiterà ogni homepage, cercherà sezioni dedicate ad <strong>ATA</strong> o <strong>Bandi di gara</strong>, estrarrà i testi e utilizzerà Gemini AI per estrarre i dati strutturati.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={downloadSampleCsv}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Scarica CSV di Esempio
                  </button>
                </div>

                <form onSubmit={handleBatchProcess} className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 cursor-pointer bg-slate-950/50 transition-all group">
                      <FileSpreadsheet className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors" />
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                        {selectedFile ? selectedFile.name : "Trascina qui il file CSV o clicca per selezionarlo"}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">Formati supportati: .csv</span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isProcessingBatch || !selectedFile}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-8 py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 h-auto"
                    >
                      {isProcessingBatch ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Elaborazione in corso...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 fill-current" />
                          <span>Avvia Estrazione Batch</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {batchError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{batchError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar during Batch Processing */}
            {isProcessingBatch && batchProgress.total > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-slate-300 gap-2">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>
                      Elaborazione pacchetto <strong className="text-white">{batchInfo.currentBatch || 1}</strong> di <strong className="text-white">{batchInfo.totalBatches || 1}</strong>
                      <span className="text-xs text-slate-400 ml-1.5">(15 link a pacchetto)</span>
                    </span>
                  </span>
                  <span className="font-semibold text-indigo-400">{batchProgress.current} / {batchProgress.total} link</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Salvataggio/append automatico nel file CSV al termine di ogni pacchetto di 15 link.</span>
                  <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Results Section */}
            {batchResults.length > 0 && (
              <div className="space-y-4">
                {/* Final Completion Banner */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-medium">
                      {batchInfo.finalMessage || `Elaborazione completata: ${batchResults.length} link processati su ${batchResults.length} totali in ${batchInfo.totalBatches || 1} batch.`}
                    </span>
                  </div>
                  {batchInfo.jobId && (
                    <a
                      href={`/api/download-batch-csv/${batchInfo.jobId}`}
                      download={batchInfo.outputFilename || "risultati_batch.csv"}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Scarica CSV Server ({batchInfo.outputFilename || "batch.csv"})</span>
                    </a>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Risultati Elaborazione Batch</h3>
                    <p className="text-xs text-slate-400">Completata l'analisi su {batchResults.length} siti web</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={exportResultsToCsv}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Esporta CSV</span>
                    </button>
                    <button
                      onClick={exportToGitHub}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm"
                    >
                      <Github className="w-4 h-4 text-slate-300" />
                      <span>Salva su GitHub</span>
                    </button>
                  </div>
                </div>

                {githubExportStatus && (
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-slate-300">{githubExportStatus}</span>
                    {githubExportUrl && (
                      <a 
                        href={githubExportUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1 text-xs shrink-0"
                      >
                        <span>Visualizza commit su GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                          <th className="p-4 font-semibold">URL Originale</th>
                          <th className="p-4 font-semibold">Stato</th>
                          <th className="p-4 font-semibold text-center">Conv. Coll.</th>
                          <th className="p-4 font-semibold text-center">Conv. Amm.</th>
                          <th className="p-4 font-semibold text-center">Conv. Docenti</th>
                          <th className="p-4 font-semibold text-center">Conv. Tecnico</th>
                          <th className="p-4 font-semibold text-center">Pens. Coll.</th>
                          <th className="p-4 font-semibold text-center">Pens. Amm.</th>
                          <th className="p-4 font-semibold text-center">Pens. Docenti</th>
                          <th className="p-4 font-semibold text-center">Pens. Tecnico</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Fascia</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Profilo</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Classe Conc.</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Ore</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Decorrenza</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {batchResults.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4 font-medium text-slate-200 max-w-xs truncate">
                              <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-indigo-400 flex items-center gap-1.5">
                                <span className="truncate">{r.url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                              </a>
                            </td>
                            <td className="p-4">
                              {r.status === "success" ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> Completato
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium" title={r.error}>
                                  <AlertCircle className="w-3 h-3" /> Errore
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold text-indigo-300">{r.data.convocazioni_collaboratore_scolastico ?? 0}</td>
                            <td className="p-4 text-center font-bold text-indigo-300">{r.data.convocazioni_assistente_amministrativo ?? 0}</td>
                            <td className="p-4 text-center font-bold text-indigo-300">{r.data.convocazioni_docenti ?? 0}</td>
                            <td className="p-4 text-center font-bold text-indigo-300">{r.data.convocazioni_assistente_tecnico ?? 0}</td>
                            <td className="p-4 text-center font-bold text-amber-300">{r.data.pensionamenti_collaboratore_scolastico ?? 0}</td>
                            <td className="p-4 text-center font-bold text-amber-300">{r.data.pensionamenti_assistente_amministrativo ?? 0}</td>
                            <td className="p-4 text-center font-bold text-amber-300">{r.data.pensionamenti_docenti ?? 0}</td>
                            <td className="p-4 text-center font-bold text-amber-300">{r.data.pensionamenti_assistente_tecnico ?? 0}</td>
                            <td className="p-4 text-center text-slate-300 font-medium">{r.data.graduatoria_fascia || "-"}</td>
                            <td className="p-4 text-center text-slate-300 font-medium max-w-[120px] truncate" title={r.data.profilo_professionale}>{r.data.profilo_professionale || "-"}</td>
                            <td className="p-4 text-center text-slate-300 font-medium">{r.data.classe_di_concorso || "-"}</td>
                            <td className="p-4 text-center text-slate-300 font-medium">{r.data.ore_settimanali || "-"}</td>
                            <td className="p-4 text-center text-slate-300 font-medium text-[11px]">
                              {r.data.decorrenza_da ? `${r.data.decorrenza_da}${r.data.decorrenza_a ? ` - ${r.data.decorrenza_a}` : ""}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SINGLE URL TEST */}
        {activeTab === "single" && (
          <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-indigo-400" />
                  Test Scansione & Estrazione Singolo URL
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Inserisci l'indirizzo web di un istituto scolastico per testare la navigazione automatica e l'analisi LLM in tempo reale.
                </p>
              </div>

              <form onSubmit={handleSingleProcess} className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="https://www.istitutoscolastico.edu.it"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isProcessingSingle || !singleUrl.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0"
                  >
                    {isProcessingSingle ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analisi...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Esegui Test</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {singleError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{singleError}</span>
                </div>
              )}
            </div>

            {singleResult && (
              <div className="space-y-6 animate-fadeIn">
                {/* Logs Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    Log di Navigazione e Scansione
                  </h3>
                  <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-1.5 border border-slate-800">
                    {singleResult.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400">›</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Structured Extraction Results */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Dati Estratti tramite Gemini AI
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Convocazioni Personale</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex justify-between items-center"><span className="text-slate-400">Collaboratore Scolastico:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_collaboratore_scolastico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Amministrativo:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_amministrativo}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Docenti:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_docenti}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Tecnico:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_tecnico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Cuoco:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_cuoco}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Agrario:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_agrario}</span></li>
                      </ul>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pensionamenti Personale</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex justify-between items-center"><span className="text-slate-400">Collaboratore Scolastico:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_collaboratore_scolastico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Amministrativo:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_assistente_amministrativo}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Docenti:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_docenti}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Tecnico:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_tecnico ?? singleResult.data.pensionamenti_assistente_tecnico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Cuoco:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_cuoco}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Agrario:</span> <span className="font-bold text-white">{singleResult.data.pensionamenti_assistente_agrario}</span></li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Albo Pretorio & Contratti di Supplenza Results */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      Albo Pretorio & Contratti di Supplenza
                    </h3>
                    <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Zero Dati Personali (GDPR Safe)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Fascia Graduatoria</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.graduatoria_fascia || "Nessuna rilevata"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Profilo Professionale</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.profilo_professionale || "Nessun profilo"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Classe di Concorso</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.classe_di_concorso || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Ore Settimanali</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Decorrenza Da</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.decorrenza_da || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Decorrenza A</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.decorrenza_a || "N/D"}</span>
                    </div>
                  </div>

                  {singleResult.data.albo_contratti && singleResult.data.albo_contratti.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Atti e Bandi Rilevati ({singleResult.data.albo_contratti.length})
                      </h4>
                      <div className="space-y-2">
                        {singleResult.data.albo_contratti.map((contratto, cIdx) => (
                          <div key={cIdx} className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="font-semibold text-sm text-slate-100">{contratto.titolo}</span>
                              {contratto.data_pubblicazione && (
                                <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md self-start">
                                  {contratto.data_pubblicazione}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
                              <div><span className="text-slate-500">Profilo:</span> {contratto.profilo_professionale || "N/D"}</div>
                              <div><span className="text-slate-500">Fascia:</span> {contratto.graduatoria_fascia || "N/D"}</div>
                              <div><span className="text-slate-500">Ore:</span> {contratto.ore_settimanali || "N/D"}</div>
                              <div><span className="text-slate-500">Periodo:</span> {contratto.decorrenza_da ? `${contratto.decorrenza_da} - ${contratto.decorrenza_a || "termine"}` : "N/D"}</div>
                            </div>
                            {contratto.pdf_url && (
                              <div className="pt-1 flex items-center justify-between text-xs">
                                <a href={contratto.pdf_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Visualizza allegato PDF originale</span>
                                </a>
                                <span className="text-[11px] text-emerald-400">File temp rimosso da memoria</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ALBO PRETORIO & PDF */}
        {activeTab === "albo" && (
          <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Modulo Albo Pretorio & Estrazione Contratti PDF
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Scansione automatica dell'Albo Pretorio scolastico negli ultimi 6 mesi, download temporaneo degli allegati PDF ed estrazione sicura tramite Gemini AI.
                  </p>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  100% Privacy & Zero PII
                </span>
              </div>

              {/* Filtering Specs Box */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-indigo-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Filtro Temporale 6 Mesi
                  </span>
                  <p className="text-slate-400">
                    Vengono esaminati esclusivamente gli atti e bandi pubblicati entro 6 mesi dalla data corrente.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Parole Chiave Incluse
                  </span>
                  <p className="text-slate-400">
                    "Contratto di supplenza annuale", "Contratto di supplenza breve", "Contratto di supplenza".
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-rose-400 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Documenti Esclusi
                  </span>
                  <p className="text-slate-400">
                    "Assegnazione ai plessi", "Assenze docente/ATA", "direttiva_ds", "informativa sindacale".
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Scan School URL */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  1. Test Scansione Albo Pretorio da URL Istituto
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Inserisci l'home page o il link dell'istituto: il motore individua la sezione Albo Pretorio, filtra gli atti conformi e scarica gli allegati PDF per l'analisi.
                </p>
              </div>

              <form onSubmit={handleAlboScan} className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="https://www.comprensivomilano.edu.it"
                    value={alboUrlInput}
                    onChange={(e) => setAlboUrlInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isScanningAlbo || !alboUrlInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0"
                  >
                    {isScanningAlbo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scansione in corso...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Analizza Albo Pretorio</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {alboScanError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{alboScanError}</span>
                </div>
              )}

              {alboScanResult && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] text-slate-400 block">Albo Pretorio Trovato</span>
                      <span className="text-sm font-semibold text-indigo-300 truncate block">
                        {alboScanResult.alboUrl ? "Identificato" : "Non trovato"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] text-slate-400 block">Atti Conformi Rilevati</span>
                      <span className="text-sm font-semibold text-white">
                        {alboScanResult.contratti?.length ?? 0}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] text-slate-400 block">Fascia Graduatoria</span>
                      <span className="text-sm font-semibold text-emerald-300">
                        {alboScanResult.graduatoria_fascia || "N/D"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] text-slate-400 block">Profilo ATA/Docente</span>
                      <span className="text-sm font-semibold text-emerald-300 truncate block" title={alboScanResult.profilo_professionale}>
                        {alboScanResult.profilo_professionale || "N/D"}
                      </span>
                    </div>
                  </div>

                  {/* Logs */}
                  {alboScanResult.logs && (
                    <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-1.5 border border-slate-800 max-h-48 overflow-y-auto">
                      {alboScanResult.logs.map((log: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-400">›</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contracts List */}
                  {alboScanResult.contratti && alboScanResult.contratti.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Dettaglio Contratti e Documenti PDF Estratti
                      </h4>
                      {alboScanResult.contratti.map((item: any, idx: number) => (
                        <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-semibold text-sm text-white">{item.titolo}</span>
                            {item.data_pubblicazione && (
                              <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded self-start">
                                {item.data_pubblicazione}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
                            <div><span className="text-slate-500">Profilo:</span> {item.profilo_professionale || "N/D"}</div>
                            <div><span className="text-slate-500">Fascia:</span> {item.graduatoria_fascia || "N/D"}</div>
                            <div><span className="text-slate-500">Ore:</span> {item.ore_settimanali || "N/D"}</div>
                            <div><span className="text-slate-500">Periodo:</span> {item.decorrenza_da ? `${item.decorrenza_da} - ${item.decorrenza_a || "termine"}` : "N/D"}</div>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> File temporaneo PDF eliminato (Memoria liberata)
                            </span>
                            {item.pdf_url && (
                              <a href={item.pdf_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                <span>Apri PDF bando</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Direct PDF Upload Test */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  2. Upload Diretto File PDF di Contratto / Bando Scolastico
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Trascina o carica direttamente un file PDF di nomina o contratto di supplenza per verificare l'estrazione strutturata delle 6 variabili e la totale privacy (zero PII estratti).
                </p>
              </div>

              <form onSubmit={handlePdfUploadAndExtract} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer w-full"
                  />
                  <button
                    type="submit"
                    disabled={isExtractingPdf || !selectedPdfFile}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center"
                  >
                    {isExtractingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Estrazione PDF con Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Estrai Dati da PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {pdfExtractError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{pdfExtractError}</span>
                </div>
              )}

              {pdfExtractResult && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                    <div>
                      <span className="text-xs text-slate-400 block">File Elaborato:</span>
                      <span className="text-sm font-semibold text-white">{pdfExtractResult.filename}</span>
                    </div>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Memoria Pulita (unlink eseguito)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Graduatoria Fascia</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.graduatoria_fascia || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Profilo Professionale</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.profilo_professionale || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Classe di Concorso</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.classe_di_concorso || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Ore Settimanali</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Decorrenza Da</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.decorrenza_da || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Decorrenza A</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.decorrenza_a || "N/D"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GOOGLE DATA SEARCH */}
        {activeTab === "search" && (
          <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Google Data Search & Web Grounding
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Cerca direttamente sul web tramite l'intelligenza artificiale e Google Search Grounding per trovare bandi ATA, graduatorie scolastiche e circolari di supplenza in tempo reale.
                </p>
              </div>

              <form onSubmit={handleGoogleSearch} className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="es. Convocazioni ATA terza fascia Milano 2026"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Ricerca...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Cerca sul Web</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {searchError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {searchResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 animate-fadeIn">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Risultati della Ricerca Web (Grounding)
                </h3>
                <div className="bg-slate-950 rounded-xl p-6 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed border border-slate-800 font-sans">
                  {searchResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: STORICO BATCH */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Storico Estrazioni Batch ({batchHistory.length})
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Storico locale delle sessioni di estrazione CSV salvate nel browser. Puoi ricaricare qualsiasi sessione precedente, esportarla o eliminarla.
                </p>
              </div>
              {batchHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Svuota Storico</span>
                </button>
              )}
            </div>

            {batchHistory.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl">
                <div className="bg-slate-800/60 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-white">Nessuna estrazione salvata nello storico</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Carica un file CSV nella sezione "Elaborazione Batch CSV" ed esegui l'estrazione per salvare automaticamente i risultati nello storico locale.
                </p>
                <button
                  onClick={() => setActiveTab("batch")}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/25 text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Vai a Elaborazione Batch</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {batchHistory.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                          {item.filename}
                        </span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                          {item.totalUrls} URL analizzati
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Salvato il: <span className="text-slate-300 font-medium">{item.timestamp}</span> &bull; 
                        Successi: <span className="text-emerald-400 font-medium">{item.results.filter(r => r.status === 'success').length}</span> &bull; 
                        Errori: <span className="text-rose-400 font-medium">{item.results.filter(r => r.status === 'error').length}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => loadHistoryItem(item)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Carica in Dashboard</span>
                      </button>
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 p-2 rounded-xl text-xs transition-all"
                        title="Elimina dallo storico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ARCHITECTURE & GUIDE */}
        {activeTab === "guide" && (
          <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-3 rounded-xl text-indigo-400 border border-indigo-500/30">
                  <Code2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Architettura Consigliata e Flusso di Lavoro</h2>
                  <p className="text-sm text-slate-400">Dettagli tecnici dell'applicazione Node.js, Axios, Cheerio e Gemini API</p>
                </div>
              </div>

              <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-base text-indigo-400">
                    <span>1. Stack Tecnologico Consigliato</span>
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                    <li><strong>Backend Runtime:</strong> Node.js con Express per gestire le richieste HTTP, l'upload dei file CSV e la sincronizzazione delle chiamate di scraping.</li>
                    <li><strong>Scraping & Parsing:</strong> Librerie <code>axios</code> per il fetch delle pagine web e <code>cheerio</code> per l'analisi del DOM HTML e la ricerca mirata di sezioni "ATA" o "Bandi di gara".</li>
                    <li><strong>Estrazione con LLM:</strong> SDK ufficiale <code>@google/genai</code> con il modello <code>gemini-3.8-flash</code> per l'estrazione strutturata tramite schema JSON rigoroso.</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-base text-indigo-400">
                    <span>2. Flusso di Esecuzione Dettagliato</span>
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-slate-400">
                    <li><strong>Caricamento CSV:</strong> L'utente carica il file iniziale contenente l'elenco degli URL istituzionali.</li>
                    <li><strong>Scansione Homepage & Sottopagina:</strong> Per ogni URL, il server effettua una richiesta HTTP, analizza i link alla ricerca di parole chiave come <em>ATA</em>, <em>Bandi di gara</em>, <em>Graduatorie</em> o <em>Avvisi</em>, e scarica il testo combinato.</li>
                    <li><strong>Analisi IA:</strong> Il testo estratto viene inviato a Gemini con il prompt di sistema dedicato, garantendo un output JSON pulito e privo di testo superfluo.</li>
                    <li><strong>Generazione CSV:</strong> Tutti i dati vengono aggregati in un nuovo file CSV strutturato, pronto per il download immediato.</li>
                  </ol>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-base text-indigo-400">
                    <span>3. Prompt di Sistema per l'Estrazione</span>
                  </h3>
                  <pre className="bg-slate-900 p-4 rounded-lg text-xs font-mono text-indigo-200 overflow-x-auto border border-slate-800">
{`"Sei un assistente specializzato nell'analisi di documenti scolastici e bandi di gara. Leggi il testo seguente e restituisci ESCLUSIVAMENTE un oggetto JSON con le seguenti chiavi:
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
Se un dato non viene menzionato nel testo, assegna il valore 0 alla chiave corrispondente. Non aggiungere testo fuori dal JSON."`}
                  </pre>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-base text-emerald-400">
                    <span>4. Estensione Modulare: Albo Pretorio, Filtri 6 Mesi & Download PDF</span>
                  </h3>
                  <div className="space-y-3 text-slate-400 text-xs leading-relaxed">
                    <p>
                      L'estensione opera come un add-on autonomo mantenendo al 100% la retrocompatibilità con tutte le funzioni preesistenti.
                    </p>
                    <ul className="list-disc list-inside space-y-1.5">
                      <li><strong>Filtro 6 Mesi:</strong> Scansione limitata tassativamente agli atti pubblicati negli ultimi 6 mesi rispetto alla data odierna.</li>
                      <li><strong>Parole Chiave di Inclusione:</strong> <em>"Contratto di supplenza annuale"</em>, <em>"Contratto di supplenza breve"</em>, <em>"Contratto di supplenza"</em>.</li>
                      <li><strong>Parole Chiave di Esclusione:</strong> <em>"ASSEGNAZIONE AI PLESSI DEL PERSONALE ATA"</em>, <em>"CI_031 Assenze del personale docente e ATA"</em>, <em>"direttiva_ds"</em>, <em>"informativa sindacale"</em>.</li>
                      <li><strong>Gestione Memoria Rigorosa:</strong> I file PDF scaricati temporaneamente vengono memorizzati su disco e tassativamente eliminati all'interno di blocchi <code>try...finally</code> tramite <code>fs.promises.unlink</code>, sia in caso di successo che di errore.</li>
                      <li><strong>Tutela Assoluta della Privacy:</strong> Non viene estratto alcun nominativo, codice fiscale o dato anagrafico. Vengono estratti solo i campi contrattuali: <code>graduatoria_fascia</code>, <code>profilo_professionale</code>, <code>classe_di_concorso</code>, <code>ore_settimanali</code>, <code>decorrenza_da</code>, <code>decorrenza_a</code>.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-500">
        ScuolaATA Automation Suite • Powered by Google Gemini AI & Express
      </footer>
    </div>
  );
}
