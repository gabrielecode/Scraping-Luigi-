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
  Save,
  Github,
  Globe
} from "lucide-react";
import { ExtractionResult, ExtractionData } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"batch" | "single" | "search" | "guide">("batch");
  
  // Configuration & LocalStorage state
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => localStorage.getItem("scuola_openrouter_api_key") || "");
  const [githubUser, setGithubUser] = useState(() => localStorage.getItem("scuola_github_user") || "");
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem("scuola_github_repo") || "");
  const [githubPat, setGithubPat] = useState(() => localStorage.getItem("scuola_github_pat") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");

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

  // Batch processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
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
    } catch (err: any) {
      logs.push(`Impossibile leggere il sito direttamente (${err.message}). Utilizzo OpenRouter Web Search.`);
    }

    const prompt = `Sei un assistente specializzato nell'analisi di documenti scolastici e bandi di gara. Analizza il seguente testo estratto dal sito ${targetUrl}:\n\n${pageText}\n\nRestituisci ESCLUSIVAMENTE un oggetto JSON con le seguenti chiavi (numeriche, se non menzionate metti 0):
{
  "convocazioni_collaboratore_scolastico": 0,
  "convocazioni_assistente_amministrativo": 0,
  "convocazioni_docenti": 0,
  "convocazioni_assistente_tecnico": 0,
  "convocazioni_cuoco": 0,
  "convocazioni_assistente_agrario": 0,
  "pensionamenti_collaboratore_scolastico": 0,
  "pensionamenti_assistente_amministrativo": 0,
  "pensionamenti_docenti": 0,
  "pensionamenti_assistente_tecnico": 0,
  "pensionamenti_cuoco": 0,
  "pensionamenti_assistente_agrario": 0
}`;

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
        plugins: [{ id: "web" }],
        response_format: { type: "json_object" }
      })
    });

    const respData = await response.json();
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

    const respData = await response.json();
    return respData?.choices?.[0]?.message?.content || "Nessun risultato trovato.";
  };

  const handleGoogleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setSearchResult("");

    try {
      const res = await fetch("/api/google-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openRouterApiKey.trim() ? { "x-openrouter-key": openRouterApiKey.trim() } : {})
        },
        body: JSON.stringify({ query: searchQuery.trim() })
      });

      if (res.status === 405 || res.status === 404 || !res.ok) {
        if (!openRouterApiKey.trim()) {
          throw new Error("Errore backend (405/404 Vercel static mode). Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare la ricerca client-side.");
        }
        const resultText = await executeClientSideSearch(searchQuery.trim(), openRouterApiKey.trim());
        setSearchResult(resultText);
        return;
      }

      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error(`Risposta server non valida (${res.status}): ${textRes.substring(0, 100)}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Errore durante la ricerca web.");
      }

      setSearchResult(data.result);
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

  // Handle batch CSV upload & processing with polling
  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setBatchError("Si prega di selezionare un file CSV.");
      return;
    }

    setBatchError("");
    setIsProcessingBatch(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: 0 });
    setGithubExportStatus("");
    setGithubExportUrl("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/process-csv", {
        method: "POST",
        headers: {
          ...(openRouterApiKey.trim() ? { "x-openrouter-key": openRouterApiKey.trim() } : {})
        },
        body: formData,
      });

      if (response.status === 405 || response.status === 404 || !response.ok) {
        if (!openRouterApiKey.trim()) {
          throw new Error("Errore backend (405/404 Vercel static mode). Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'elaborazione client-side.");
        }

        const csvText = await selectedFile.text();
        const lines = csvText.split(/\r?\n/).map(l => l.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        const urls = lines.filter(l => l.startsWith("http") || l.includes(".it"));
        const results: ExtractionResult[] = [];
        setBatchProgress({ current: 0, total: urls.length });

        for (let i = 0; i < urls.length; i++) {
          const u = urls[i];
          try {
            const resData = await executeClientSideExtract(u.startsWith("http") ? u : `https://${u}`, openRouterApiKey.trim());
            results.push(resData);
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
              }
            });
          }
          setBatchProgress({ current: i + 1, total: urls.length });
        }

        setBatchResults(results);
        setIsProcessingBatch(false);
        return;
      }

      const textRes = await response.text();
      let initData;
      try {
        initData = JSON.parse(textRes);
      } catch {
        throw new Error(`Risposta server non valida (${response.status}): ${textRes.substring(0, 100)}`);
      }

      if (!initData.success || !initData.jobId) {
        throw new Error(initData.error || "Errore avvio elaborazione batch.");
      }

      const jobId = initData.jobId;
      const pollInterval = 1500;
      let isDone = false;

      while (!isDone) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        const statusRes = await fetch(`/api/batch-status/${jobId}`);
        const statusText = await statusRes.text();
        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch {
          continue;
        }

        if (!statusRes.ok || !statusData.success) {
          throw new Error(statusData.error || "Errore durante il controllo dello stato del job.");
        }

        const job = statusData.job;
        setBatchProgress({ current: job.current, total: job.total });

        if (job.status === "completed") {
          setBatchResults(job.results);
          isDone = true;
          setIsProcessingBatch(false);
        } else if (job.status === "error") {
          throw new Error(job.error || "Errore riscontrato durante l'elaborazione dei job.");
        }
      }
    } catch (err: any) {
      setBatchError(err.message || "Errore di connessione al server.");
      setIsProcessingBatch(false);
    }
  };

  // Export results to GitHub securely via server-side endpoint
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
      "Pens. Coll. Scolastico", "Pens. Assistente Amm.", "Pens. Docenti", "Pens. Assistente Tecnico", "Pens. Cuoco", "Pens. Assistente Agrario"
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
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const filePath = `risultati-scuole-ata-${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      const res = await fetch("/api/export-github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-pat": githubPat.trim()
        },
        body: JSON.stringify({
          owner: githubUser.trim(),
          repo: githubRepo.trim(),
          path: filePath,
          content: csvContent,
          message: `Export risultati ScuolaATA ${new Date().toISOString().slice(0, 10)}`
        })
      });

      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error(`Risposta server non valida (${res.status}): ${textRes.substring(0, 100)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Errore durante l'esportazione su GitHub.");
      }

      setGithubExportStatus("Esportazione completata con successo su GitHub!");
      setGithubExportUrl(data.commitUrl);
    } catch (err: any) {
      setGithubExportStatus(`Errore GitHub: ${err.message}`);
    }
  };

  // Handle single URL test
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
      const response = await fetch("/api/extract-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openRouterApiKey.trim() ? { "x-openrouter-key": openRouterApiKey.trim() } : {})
        },
        body: JSON.stringify({ url: formattedUrl }),
      });

      if (response.status === 405 || response.status === 404 || !response.ok) {
        if (!openRouterApiKey.trim()) {
          throw new Error("Errore backend (405/404 Vercel static mode). Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'estrazione client-side.");
        }
        const clientData = await executeClientSideExtract(formattedUrl, openRouterApiKey.trim());
        setSingleResult(clientData);
        return;
      }

      const textRes = await response.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error(`Risposta server non valida (${response.status}): ${textRes.substring(0, 100)}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Errore durante l'estrazione.");
      }

      setSingleResult({
        url: data.url,
        navigatedUrl: data.navigatedUrl,
        status: "success",
        logs: data.logs,
        data: data.data,
      });
    } catch (err: any) {
      setSingleError(err.message || "Errore durante la richiesta.");
    } finally {
      setIsProcessingSingle(false);
    }
  };

  // Export results to CSV
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
      "Pens. Assistente Agrario"
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
                <div className="flex justify-between text-sm text-slate-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    Elaborazione asincrona in corso...
                  </span>
                  <span className="font-semibold text-indigo-400">{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Results Section */}
            {batchResults.length > 0 && (
              <div className="space-y-4">
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
                      <span>Scarica CSV</span>
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
              </div>
            )}
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
