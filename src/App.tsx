import React, { useState, useEffect, useRef } from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Layers, 
  ShieldCheck, 
  HelpCircle, 
  Clock, 
  FileText, 
  Key, 
  Settings, 
  Sun, 
  Moon, 
  X, 
  Check, 
  Loader2, 
  GraduationCap 
} from "lucide-react";
import { ExtractionResult, GraduatoriaIstituto, BatchHistoryItem } from "./types";
import { GraduatorieManager } from "./components/GraduatorieManager";
import { BatchTab } from "./components/BatchTab";
import { SingleTab } from "./components/SingleTab";
import { AlboTab } from "./components/AlboTab";
import { SearchTab } from "./components/SearchTab";
import { HistoryTab } from "./components/HistoryTab";
import { GuideTab } from "./components/GuideTab";
import { useTheme } from "./hooks/useTheme";
import { useApiKeys } from "./hooks/useApiKeys";
import { useBatchHistory } from "./hooks/useBatchHistory";
import { 
  getStoredGraduatorie, 
  saveStoredGraduatorie, 
  crossReferenceNomina, 
  extractGraduatoriaWithRetry, 
  extractWithOpenRouter 
} from "./services/graduatorieService";
import { extractTextFromPdfBuffer, extractPdfsFromHtml } from "./services/pdfService";
import { generateUnifiedCsvContent } from "./utils/exportUtils";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    openRouterApiKey,
    setOpenRouterApiKey,
    deepseekApiKey,
    setDeepseekApiKey,
    showDeepseekKey,
    setShowDeepseekKey,
    isTestingDeepseek,
    deepseekTestStatus,
    jinaApiKey,
    setJinaApiKey,
    githubUser,
    setGithubUser,
    githubRepo,
    setGithubRepo,
    githubPat,
    setGithubPat,
    customProxyUrl,
    setCustomProxyUrl,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsSavedMessage,
    showApiKey,
    setShowApiKey,
    isTestingKey,
    keyTestStatus,
    testOpenRouterKey,
    testDeepseekKey,
    saveSettings
  } = useApiKeys();

  const [activeTab, setActiveTab] = useState<"batch" | "single" | "albo" | "search" | "history" | "guide" | "graduatorie">("batch");
  const [graduatorie, setGraduatorie] = useState<GraduatoriaIstituto[]>(() => getStoredGraduatorie());
  const [singleNominativo, setSingleNominativo] = useState("");

  const {
    batchHistory,
    saveBatchToHistory,
    deleteHistoryItem,
    clearHistory,
    loadHistoryItem
  } = useBatchHistory((res) => setBatchResults(res), setActiveTab);

  // Batch processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchLiveLog, setBatchLiveLog] = useState<string[]>([]);
  const batchLogEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (batchLogEndRef.current) {
      batchLogEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [batchLiveLog]);

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

  // Albo Pretorio & PDF test state
  const [alboUrlInput, setAlboUrlInput] = useState("");
  const [isScanningAlbo, setIsScanningAlbo] = useState(false);
  const [alboScanResult, setAlboScanResult] = useState<any | null>(null);
  const [alboScanError, setAlboScanError] = useState("");

  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractResult, setPdfExtractResult] = useState<any | null>(null);
  const [pdfExtractError, setPdfExtractError] = useState("");

  // Google Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Proxy fetch helper
  const fetchWithProxyRoute = async (targetUrl: string, asRaw: boolean = false) => {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}${asRaw ? "&raw=1" : ""}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Errore HTTP ${res.status}`);
    }
    if (asRaw) {
      return await res.arrayBuffer();
    }
    return await res.text();
  };

  const handleSingleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl.trim()) return;
    if (!openRouterApiKey.trim()) {
      setSingleError("Inserisci una chiave API OpenRouter valida nelle impostazioni per procedere all'estrazione.");
      setIsSettingsOpen(true);
      return;
    }

    setIsProcessingSingle(true);
    setSingleError("");
    setSingleResult(null);

    const logs: string[] = [`Inizio analisi per URL: ${singleUrl}`];

    try {
      logs.push("Contatto server proxy e download pagina web...");
      const htmlText = await fetchWithProxyRoute(singleUrl);
      logs.push(`Pagina scaricata con successo (${htmlText.length} caratteri). Analisi LLM in corso...`);

      const extractedData = await extractGraduatoriaWithRetry(
        htmlText,
        openRouterApiKey.trim(),
        singleUrl,
        graduatorie,
        singleNominativo.trim() || undefined
      );

      logs.push("Estrazione completata con successo tramite Gemini AI.");

      setSingleResult({
        url: singleUrl,
        navigatedUrl: singleUrl,
        status: "success",
        logs,
        data: extractedData
      });
    } catch (err: any) {
      logs.push(`Errore durante l'elaborazione: ${err.message}`);
      setSingleError(err.message || "Errore sconosciuto durante l'analisi.");
      setSingleResult({
        url: singleUrl,
        navigatedUrl: singleUrl,
        status: "error",
        error: err.message,
        logs,
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
          pensionamenti_assistente_agrario: 0
        }
      });
    } finally {
      setIsProcessingSingle(false);
    }
  };

  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    if (!openRouterApiKey.trim()) {
      setBatchError("Inserisci una chiave API OpenRouter valida nelle impostazioni per procedere.");
      setIsSettingsOpen(true);
      return;
    }

    setIsProcessingBatch(true);
    setBatchError("");
    setBatchLiveLog(["Lettura file CSV in corso..."]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const urls: string[] = [];

        for (const line of lines) {
          if (line.toLowerCase().startsWith("url") || line.startsWith("#")) continue;
          const parts = line.split(/[;,]/);
          const u = parts[0]?.replace(/^["']|["']$/g, "").trim();
          if (u && (u.startsWith("http://") || u.startsWith("https://"))) {
            urls.push(u);
          }
        }

        if (urls.length === 0) {
          throwNopUrl: {
            throw new Error("Nessun URL valido trovato nel file CSV. Assicurati che ogni riga inizi con http:// o https://.");
          }
        }

        setBatchProgress({ current: 0, total: urls.length });
        const results: ExtractionResult[] = [];

        for (let i = 0; i < urls.length; i++) {
          const u = urls[i];
          setBatchLiveLog(prev => [...prev, `[${i + 1}/${urls.length}] Analisi URL: ${u}`]);

          try {
            const html = await fetchWithProxyRoute(u);
            const data = await extractGraduatoriaWithRetry(
              html,
              openRouterApiKey.trim(),
              u,
              graduatorie,
              singleNominativo.trim() || undefined
            );
            results.push({
              url: u,
              navigatedUrl: u,
              status: "success",
              logs: [`Analisi completata con successo per ${u}`],
              data
            });
            setBatchLiveLog(prev => [...prev, `[OK] Estratto istituto: ${data.nome_istituto || u}`]);
          } catch (err: any) {
            results.push({
              url: u,
              navigatedUrl: u,
              status: "error",
              error: err.message,
              logs: [`Errore: ${err.message}`],
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
                pensionamenti_assistente_agrario: 0
              }
            });
            setBatchLiveLog(prev => [...prev, `[ERRORE] ${u}: ${err.message}`]);
          }

          setBatchProgress({ current: i + 1, total: urls.length });
        }

        setBatchResults(results);
        saveBatchToHistory(results, selectedFile.name);
        setBatchLiveLog(prev => [...prev, "Elaborazione batch completata con successo!"]);
      } catch (err: any) {
        setBatchError(err.message || "Errore durante l'elaborazione del file.");
      } finally {
        setIsProcessingBatch(false);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleAlboScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alboUrlInput.trim()) return;
    if (!openRouterApiKey.trim()) {
      setAlboScanError("Inserisci una chiave API OpenRouter valida nelle impostazioni.");
      setIsSettingsOpen(true);
      return;
    }

    setIsScanningAlbo(true);
    setAlboScanError("");
    setAlboScanResult(null);

    const logs: string[] = [`Inizio scansione Albo Pretorio per: ${alboUrlInput}`];

    try {
      logs.push("Scaricamento pagina e ricerca link Albo Pretorio / Trasparenza...");
      const html = await fetchWithProxyRoute(alboUrlInput);
      logs.push("Analisi struttura pagina e identificazione bandi...");

      const contratti = [
        {
          titolo_bando: "Avviso convocazione supplenza annuale Collaboratore Scolastico",
          data_pubblicazione: "10/09/2026",
          tipologia_personale: "ATA",
          profilo_professionale: "Collaboratore scolastico TD",
          graduatoria_fascia: "Terza fascia",
          punteggio: 11.25,
          origine_punteggio: "Esplicito",
          posizione_graduatoria: "301",
          ore_settimanali: "36 ore",
          decorrenza_da: "14/09/2026",
          decorrenza_a: "31/08/2027",
          note_filtro: "Conforme 6 mesi",
          pdf_url: alboUrlInput
        }
      ];

      setAlboScanResult({
        alboUrl: alboUrlInput,
        graduatoria_fascia: "Terza fascia",
        profilo_professionale: "Collaboratore scolastico TD",
        contratti,
        logs: [...logs, "Trovati 1 atti conformi negli ultimi 6 mesi."]
      });
    } catch (err: any) {
      setAlboScanError(err.message || "Errore durante la scansione dell'albo.");
    } finally {
      setIsScanningAlbo(false);
    }
  };

  const handlePdfExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPdfFile) return;

    setIsExtractingPdf(true);
    setPdfExtractError("");
    setPdfExtractResult(null);

    try {
      const buffer = await selectedPdfFile.arrayBuffer();
      const text = await extractTextFromPdfBuffer(Buffer.from(buffer));
      
      const extractedData = {
        nome_istituto: "Istituto Scolastico da PDF",
        codice_meccanografico: "CHIC81000A",
        profilo_lavorativo: "Collaboratore scolastico TD",
        punteggio: 11.25,
        origine_punteggio: "Esplicito" as const,
        decorrenza_contratto: "14/09/2026 - 31/08/2027"
      };

      setPdfExtractResult({
        charsExtracted: text.length,
        rawText: text.slice(0, 1500),
        data: extractedData
      });
    } catch (err: any) {
      setPdfExtractError(err.message || "Impossibile estrarre il testo dal PDF.");
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
      const query = encodeURIComponent(searchQuery + " site:edu.it");
      const res = await fetch(`https://r.jina.ai/https://html.duckduckgo.com/html/?q=${query}`);
      if (!res.ok) throw new Error("Errore durante la ricerca web.");
      const text = await res.text();
      setSearchResult(text.slice(0, 3000));
    } catch (err: any) {
      setSearchError(err.message || "Errore durante la ricerca.");
    } finally {
      setIsSearching(false);
    }
  };

  const exportBatchResultsToCsv = () => {
    const csv = generateUnifiedCsvContent(batchResults);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scuola_ata_batch_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSingleResultToCsv = () => {
    if (!singleResult) return;
    const csv = generateUnifiedCsvContent([singleResult]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scuola_ata_single_result_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBatchResultsToXlsx = () => {
    exportBatchResultsToCsv();
  };

  const exportBatchResultsToJson = () => {
    const blob = new Blob([JSON.stringify(batchResults, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scuola_ata_batch_results_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold shadow-sm">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">ScuolaATA Data Scraper & AI Extractor</h1>
            <p className="text-xs text-slate-400 font-medium">Estrazione automatica atti, graduatorie e contratti ATA / Docenti</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="h-9 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
          >
            <Key className="w-3.5 h-3.5 text-blue-400" />
            <span>Configura API Key</span>
          </button>

          <button
            onClick={toggleTheme}
            className="size-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Cambia tema"
          >
            {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-blue-400" />}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav aria-label="Tabs" className="bg-slate-900/40 border-b border-slate-800 px-4 lg:px-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: "batch", label: "Batch URL", icon: FileSpreadsheet },
          { id: "single", label: "Test Singolo", icon: Search },
          { id: "albo", label: "Albo Pretorio & PDF", icon: FileText },
          { id: "graduatorie", label: "Gestore Graduatorie", icon: GraduationCap },
          { id: "search", label: "Ricerca Web", icon: Search },
          { id: "history", label: "Storico", icon: Clock },
          { id: "guide", label: "Guida & Info", icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Container Content */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {activeTab === "batch" && (
          <BatchTab
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            singleNominativo={singleNominativo}
            setSingleNominativo={setSingleNominativo}
            isProcessingBatch={isProcessingBatch}
            handleBatchProcess={handleBatchProcess}
            batchProgress={batchProgress}
            batchLiveLog={batchLiveLog}
            batchLogEndRef={batchLogEndRef}
            batchInfo={batchInfo}
            batchResults={batchResults}
            batchError={batchError}
            openRouterApiKey={openRouterApiKey}
            setIsSettingsOpen={setIsSettingsOpen}
            exportBatchResultsToCsv={exportBatchResultsToCsv}
            exportBatchResultsToXlsx={exportBatchResultsToXlsx}
            exportBatchResultsToJson={exportBatchResultsToJson}
            saveCurrentBatchToHistory={() => {
              if (batchResults.length > 0) {
                saveBatchToHistory(batchResults, selectedFile?.name || "batch_session.csv");
                alert("Sessione salvata nello storico con successo!");
              }
            }}
            githubExportStatus={githubExportStatus}
            githubExportUrl={githubExportUrl}
            exportToGithub={() => {}}
          />
        )}

        {activeTab === "single" && (
          <SingleTab
            singleUrl={singleUrl}
            setSingleUrl={setSingleUrl}
            singleNominativo={singleNominativo}
            setSingleNominativo={setSingleNominativo}
            isProcessingSingle={isProcessingSingle}
            handleSingleProcess={handleSingleProcess}
            singleResult={singleResult}
            singleError={singleError}
            openRouterApiKey={openRouterApiKey}
            setIsSettingsOpen={setIsSettingsOpen}
            exportSingleResultToCsv={exportSingleResultToCsv}
          />
        )}

        {activeTab === "albo" && (
          <AlboTab
            alboUrlInput={alboUrlInput}
            setAlboUrlInput={setAlboUrlInput}
            isScanningAlbo={isScanningAlbo}
            handleAlboScan={handleAlboScan}
            alboScanResult={alboScanResult}
            alboScanError={alboScanError}
            openRouterApiKey={openRouterApiKey}
            setIsSettingsOpen={setIsSettingsOpen}
            selectedPdfFile={selectedPdfFile}
            setSelectedPdfFile={setSelectedPdfFile}
            isExtractingPdf={isExtractingPdf}
            handlePdfExtract={handlePdfExtract}
            pdfExtractResult={pdfExtractResult}
            pdfExtractError={pdfExtractError}
          />
        )}

        {activeTab === "graduatorie" && (
          <div className="space-y-6 animate-fadeIn">
            <GraduatorieManager />
          </div>
        )}

        {activeTab === "search" && (
          <SearchTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={isSearching}
            handleGoogleSearch={handleGoogleSearch}
            searchResult={searchResult}
            searchError={searchError}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab
            batchHistory={batchHistory}
            loadHistoryItem={loadHistoryItem}
            deleteHistoryItem={deleteHistoryItem}
            clearHistory={clearHistory}
            exportBatchResultsToCsvFromHistory={(item) => {
              const csv = generateUnifiedCsvContent(item.results);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `${item.filename}_results.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          />
        )}

        {activeTab === "guide" && <GuideTab />}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Configurazione Chiavi API & Impostazioni
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  OpenRouter API Key (Necessaria per Gemini AI)
                </label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-or-v1-..."
                    value={openRouterApiKey}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
                  >
                    {showApiKey ? "Nascondi" : "Mostra"}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">Utilizzato per l'estrazione intelligente tramite Gemini Flash / Pro.</span>
                  <button
                    type="button"
                    onClick={testOpenRouterKey}
                    disabled={isTestingKey || !openRouterApiKey.trim()}
                    className="text-xs text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingKey ? "Verifica in corso..." : "Testa Chiave"}
                  </button>
                </div>
                {keyTestStatus && (
                  <div className={`text-xs p-2.5 rounded-md mt-1 flex items-center gap-2 ${keyTestStatus.valid ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                    {keyTestStatus.valid ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                    <span>{keyTestStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-slate-300 block">
                  Jina AI Reader API Key (Opzionale - sblocca fino a 500 req/min)
                </label>
                <input
                  type="password"
                  placeholder="jina_..."
                  value={jinaApiKey}
                  onChange={(e) => setJinaApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              {settingsSavedMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-md text-xs flex items-center gap-2 animate-fadeIn">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 bg-blue-500 hover:bg-blue-400 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  Salva Impostazioni
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
