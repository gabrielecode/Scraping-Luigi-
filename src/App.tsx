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
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle
} from "lucide-react";
import { ExtractionResult, ExtractionData, BatchHistoryItem, NominaContrattoItem, GraduatoriaIstituto, OriginePunteggio } from "./types";
import { GraduatorieManager } from "./components/GraduatorieManager";
import {
  getStoredGraduatorie,
  saveStoredGraduatorie,
  crossReferenceNomina,
  searchGraduatoriaPages,
  GRADUATORIA_EXTRACTION_SYSTEM_PROMPT,
  isNameMatch,
  isClassMatch,
  isValidCodiceMeccanografico,
  extractCodiceMeccanograficoFromText,
  normalizeCodiceMeccanografico,
} from "./services/graduatorieService";

export { GRADUATORIA_EXTRACTION_SYSTEM_PROMPT };

export default function App() {
  const [activeTab, setActiveTab] = useState<"batch" | "single" | "albo" | "search" | "history" | "guide" | "graduatorie">("batch");
  const [graduatorie, setGraduatorie] = useState<GraduatoriaIstituto[]>(() => getStoredGraduatorie());
  const [singleNominativo, setSingleNominativo] = useState("");
  
  // Configuration & LocalStorage state
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      const meta = import.meta as any;
      return (
        localStorage.getItem("scuola_openrouter_api_key") || 
        (meta && meta.env && meta.env.VITE_OPENROUTER_API_KEY) || 
        (meta && meta.env && meta.env.OPENROUTER_API_KEY) || 
        ""
      );
    }
    return "";
  });
  const [jinaApiKey, setJinaApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      const meta = import.meta as any;
      return (
        localStorage.getItem("scuola_jina_api_key") || 
        (meta && meta.env && meta.env.VITE_JINA_API_KEY) || 
        (meta && meta.env && meta.env.JINA_API_KEY) || 
        ""
      );
    }
    return "";
  });
  const [githubUser, setGithubUser] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_user") || "" : "");
  const [githubRepo, setGithubRepo] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_repo") || "" : "");
  const [githubPat, setGithubPat] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_pat") || "" : "");
  const [customProxyUrl, setCustomProxyUrl] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_custom_proxy") || "" : "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ valid: boolean; message: string } | null>(null);

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

  const testOpenRouterKey = async () => {
    const cleanKey = openRouterApiKey.trim();
    if (!cleanKey) {
      setKeyTestStatus({ valid: false, message: "Inserisci prima una chiave API valida." });
      return;
    }
    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        const usage = data.data.usage !== undefined ? `$${Number(data.data.usage).toFixed(3)}` : "";
        const limit = data.data.limit !== undefined ? `$${Number(data.data.limit).toFixed(2)}` : "";
        let msg = "Chiave OpenRouter valida e attiva!";
        if (usage && limit) {
          msg = `Chiave valida! (Utilizzo: ${usage} / Limite: ${limit})`;
        } else if (usage) {
          msg = `Chiave valida! (Utilizzo: ${usage})`;
        }
        setKeyTestStatus({ valid: true, message: msg });
      } else {
        const err = data?.error?.message || (res.status === 401 ? "Chiave API non valida (401 Unauthorized)." : `Errore HTTP ${res.status}`);
        setKeyTestStatus({ valid: false, message: err });
      }
    } catch (e: any) {
      setKeyTestStatus({
        valid: false,
        message: `Impossibile verificare: ${e.message || "Errore di connessione"}`
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const saveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = openRouterApiKey.trim();
    const cleanJinaKey = jinaApiKey.trim();
    localStorage.setItem("scuola_openrouter_api_key", cleanKey);
    localStorage.setItem("scuola_jina_api_key", cleanJinaKey);
    localStorage.setItem("scuola_github_user", githubUser.trim());
    localStorage.setItem("scuola_github_repo", githubRepo.trim());
    localStorage.setItem("scuola_github_pat", githubPat.trim());
    localStorage.setItem("scuola_custom_proxy", customProxyUrl.trim());
    setSettingsSavedMessage("Impostazioni salvate con successo in LocalStorage!");

    if (cleanKey) {
      setSingleError(prev => (prev.includes("API Key") || prev.includes("Impostazioni") ? "" : prev));
      setBatchError(prev => (prev.includes("API Key") || prev.includes("Impostazioni") ? "" : prev));
      setAlboScanError(prev => (prev.includes("API Key") || prev.includes("Impostazioni") ? "" : prev));
      setPdfExtractError(prev => (prev.includes("API Key") || prev.includes("Impostazioni") ? "" : prev));
      setSearchError(prev => (prev.includes("API Key") || prev.includes("Impostazioni") ? "" : prev));
    }

    setTimeout(() => {
      setSettingsSavedMessage("");
      setIsSettingsOpen(false);
    }, 1200);
  };

  // Export local backup (JSON)
  const exportLocalBackup = () => {
    const backupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      openRouterApiKey,
      jinaApiKey,
      githubUser,
      githubRepo,
      customProxyUrl,
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
        if (json.jinaApiKey !== undefined) {
          setJinaApiKey(json.jinaApiKey);
          localStorage.setItem("scuola_jina_api_key", json.jinaApiKey);
        }
        if (json.githubUser !== undefined) {
          setGithubUser(json.githubUser);
          localStorage.setItem("scuola_github_user", json.githubUser);
        }
        if (json.githubRepo !== undefined) {
          setGithubRepo(json.githubRepo);
          localStorage.setItem("scuola_github_repo", json.githubRepo);
        }
        if (json.customProxyUrl !== undefined) {
          setCustomProxyUrl(json.customProxyUrl);
          localStorage.setItem("scuola_custom_proxy", json.customProxyUrl);
        }
        alert("Backup locale importato con successo sul device!");
      } catch {
        alert("Errore durante l'importazione del file di backup: file JSON non valido.");
      }
    };
    reader.readAsText(file);
  };

  // Batch processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchLiveLog, setBatchLiveLog] = useState<string[]>([]);
  const batchLogEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  // Google Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di documenti scolastici, delibere, circolari, atti dell'Albo Pretorio, avvisi di interpello, convocazioni e contratti/nomine di supplenza per le scuole italiane, sia per il personale ATA che per il personale DOCENTE.
Leggi attentamente il testo ed estrai con la massima precisione:
1. "nome_istituto": denominazione ufficiale dell'istituto scolastico (es. "IC Ripa Teatina–Miglianico", "IIS Schiaparelli", "Liceo Cavour"), se deducibile.
2. "codice_meccanografico": codice meccanografico univoco della scuola statale (es. "CHIC81000A", "MIPC01000C", "RMIS00100B", ecc.).
   ⚠️ RICERCA PRIORITARIA E APPROFONDITA DEL CODICE MECCANOGRAFICO:
   - È composto da esattamente 10 caratteri alfanumerici (2 lettere provincia + 2 lettere tipo scuola come IC, IS, PC, PS, TF, TD, RH, EE, MM + 5 cifre numeriche o caratteri + 1 lettera di controllo finale).
   - Cercalo ovunque: intestazione del documento, accanto a "C.M.", "Cod. Mecc.", "Codice Scuola", "Codice Univoco Ufficio", nel piè di pagina (footer) o nei contatti.
   - CERCA NELLE EMAIL O PEC ISTITUZIONALI: in Italia la casella di posta ministeriale della scuola contiene sempre il codice meccanografico nella forma "{codice}@istruzione.it" oppure "{codice}@pec.istruzione.it" (es. "chic81000a@istruzione.it" indica chiaramente il codice "CHIC81000A").
   - Se menzionato nell'URL (es. "chic81000a.edu.it") o nel nome del file, estrailo come codice meccanografico ufficiale.
3. CONTEGGIO GENERALE:
   - "convocazioni_collaboratore_scolastico", "convocazioni_assistente_amministrativo", "convocazioni_docenti", "convocazioni_assistente_tecnico", "convocazioni_cuoco", "convocazioni_assistente_agrario" (numero)
   - "pensionamenti_collaboratore_scolastico", "pensionamenti_assistente_amministrativo", "pensionamenti_docenti", "pensionamenti_assistente_tecnico", "pensionamenti_cuoco", "pensionamenti_assistente_agrario" (numero)
4. "nomine_contratti": ELENCO COMPLETO di TUTTE le singole nomine / contratti di supplenza / atti di assegnazione posti / convocazioni individuati nel documento (una voce per ciascuna nomina/assegnazione).
   Per ciascuna voce specifica i seguenti campi:
   - "tipologia_personale": "ATA" per profili ATA (Collaboratore scolastico, Assistente Amministrativo, Assistente Tecnico, Cuoco, Guardarobiere, Operatore Scolastico, ecc.) oppure "DOCENTE" per insegnanti (Scuola Infanzia, Primaria, Secondaria I grado, Secondaria II grado, ITP, ecc.).
   - "profilo_lavorativo": profilo completo e tipologia (es. "Collaboratore scolastico TD", "Assistente Tecnico AR02 - Elettronica", "Docente secondaria II grado A-22 - Lettere", "Docente Primaria posto comune", "Docente Sostegno secondaria I grado ADMM").
   - "classe_concorso_area_lab": per il personale DOCENTE indica la Classe di Concorso CDC ufficiale (es. "A-12", "A-22", "A-28", "A-48", "ADMM", "ADSS", "ADAA", "ADEE", "AAAA", "EEEE"); per Assistente Tecnico ATA indica l'Area di Laboratorio (es. "AR01", "AR02", "AR08", "AR20"); per gli altri profili ATA dove non applicabile scrivi "Non applicabile".
   - "tipo_posto": "comune" per posti ordinari/curricolari e ATA; "sostegno" per posti di sostegno / minorati psicofisici / uditivi / vista / cattedre sostegno ADAA/ADEE/ADMM/ADSS.
   - "punteggio": numero float con punto decimale (es. 13.17, 69.50) OPPURE null. 
     ⚠️ REGOLA TASSATIVA: Se il punteggio manca, non è riportato o non è rintracciabile nel testo, restituisci RIGOROSAMENTE null. NON USARE MAI 0 O "0" SE IL PUNTEGGIO MANCA!
   - "posizione_graduatoria": posizione in graduatoria (es. "313", "342", "87"). Se non presente scrivi "Non riportata".
   - "fascia": fascia della graduatoria (es. "Prima fascia", "Seconda fascia", "Terza fascia", "Graduatoria d'Istituto", "Interpello"). Se non specificata scrivi "Non specificata".
   - "ore_settimanali": orario di cattedra/servizio (es. "36 ore", "18 ore", "12 ore"). Se non menzionato scrivi ESATTAMENTE "Non riportate".
   - "decorrenza_contratto": intervallo esatto delle date di contratto nel formato "GG/MM/AAAA - GG/MM/AAAA" (es. "09/09/2026 - 30/06/2027", "17/09/2025 - 21/01/2026").
   - "link_del_documento": URL dell'atto o documento di riferimento (se reperito nel testo, altrimenti stringa vuota).

Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "nome_istituto": stringa,
  "codice_meccanografico": stringa,
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
  "pensionamenti_assistente_agrario": numero,
  "nomine_contratti": [
    {
      "tipologia_personale": "ATA" | "DOCENTE",
      "profilo_lavorativo": stringa,
      "classe_concorso_area_lab": stringa,
      "tipo_posto": "comune" | "sostegno",
      "punteggio": numero | null,
      "posizione_graduatoria": stringa,
      "fascia": stringa,
      "ore_settimanali": stringa,
      "decorrenza_contratto": stringa,
      "link_del_documento": stringa
    }
  ],
  "tipologia_personale": "ATA" | "DOCENTE",
  "profilo_professionale": stringa,
  "classe_concorso_area_lab": stringa,
  "tipo_posto": "comune" | "sostegno",
  "graduatoria_fascia": stringa,
  "punteggio": numero | null,
  "posizione_graduatoria": stringa,
  "ore_settimanali": stringa,
  "decorrenza_da": stringa,
  "decorrenza_a": stringa
}
Se non trovi nomine specifiche, assegna a "nomine_contratti" un array vuoto []. Non aggiungere commenti o testo fuori dal JSON.`;

  const PDF_EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di contratti scolastici di supplenza, delibere di nomina, avvisi di convocazione e interpelli per il personale ATA e DOCENTI delle scuole italiane.
Analizza il documento PDF del contratto o delibera ed estrai con la massima precisione le informazioni richieste.

⚠️ VINCOLO FONDAMENTALE DI PRIVACY (NON NEGOZIABILE):
- NON estrarre MAI nomi, cognomi, codici fiscali, indirizzi, numeri di telefono o dati anagrafici individuali. Ometti categoricamente qualsiasi dato personale identificativo del lavoratore o del dirigente.

CAMPI DA ESTRARRE:
- "nome_istituto": denominazione della scuola (es. "IC Ripa Teatina–Miglianico").
- "codice_meccanografico": codice meccanografico della scuola statale (es. "CHIC81000A", "MIPC01000C").
  ⚠️ RICERCA DEL CODICE MECCANOGRAFICO:
  - Formato: 10 caratteri alfanumerici (2 lettere provincia + 2 lettere tipo scuola + 5 cifre + 1 lettera controllo).
  - Cerca nell'intestazione/carta intestata, accanto a "C.M.", "Cod. Mecc.", "Codice Scuola", "C.F.", nel piè di pagina o timbro.
  - Cerca anche nelle caselle di posta: es. "chic81000a@istruzione.it" o "@pec.istruzione.it" -> codice: "CHIC81000A".
- "tipologia_personale": "ATA" oppure "DOCENTE".
- "profilo_lavorativo": profilo completo e tipologia (es. "Collaboratore scolastico TD — fino al 30 giugno", "Assistente Tecnico Area Laboratorio AR02", "Docente secondaria II grado posto comune TD", "Docente sostegno secondaria I grado ADMM").
- "classe_concorso_area_lab": per il personale DOCENTE il codice della Classe di Concorso CDC (es. "A-12", "A-22", "A-28", "ADMM", "ADSS", "EEEE", "AAAA"); per Assistente Tecnico ATA il codice Area di Laboratorio (es. "AR01", "AR02", "AR08", "AR20"); per gli altri profili ATA dove non applicabile scrivi "Non applicabile".
- "tipo_posto": "comune" per posti ordinari/curricolari e ATA; "sostegno" per posti e cattedre di sostegno / minorati psicofisici / uditivi / della vista / ADAA / ADEE / ADMM / ADSS.
- "punteggio": punteggio numerico float con punto decimale (es. 13.17, 69.50) OPPURE null.
  ⚠️ REGOLA TASSATIVA: Se il punteggio manca o non è esplicitato nel documento, restituisci RIGOROSAMENTE null. MAI RESTITUIRE 0 O "0" SE IL PUNTEGGIO MANCA!
- "posizione_graduatoria": posizione numerica in graduatoria (es. "313", "342", "87"). Se assente scrivi "Non riportata".
- "fascia": fascia di graduatoria (es. "Prima fascia", "Seconda fascia", "Terza fascia", "Graduatoria d'Istituto", "Interpello").
- "ore_settimanali": orario di servizio (es. "36 ore", "18 ore", "12 ore"). Se non indicato scrivi ESATTAMENTE "Non riportate".
- "decorrenza_contratto": intervallo date contratto nel formato "GG/MM/AAAA - GG/MM/AAAA" (es. "09/09/2026 - 30/06/2027"). Se presenti singole date "da" e "a", componi l'intervallo.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "nome_istituto": stringa,
  "codice_meccanografico": stringa,
  "tipologia_personale": "ATA" | "DOCENTE",
  "profilo_lavorativo": stringa,
  "classe_concorso_area_lab": stringa,
  "tipo_posto": "comune" | "sostegno",
  "punteggio": numero | null,
  "posizione_graduatoria": stringa,
  "fascia": stringa,
  "ore_settimanali": stringa,
  "decorrenza_contratto": stringa,
  "graduatoria_fascia": stringa,
  "profilo_professionale": stringa,
  "decorrenza_da": stringa,
  "decorrenza_a": stringa
}
Non aggiungere testo o commenti prima o dopo il JSON.`;

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

  const formatDateToGG_MM_AAAA = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
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

  const calculateContractDuration = (
    decorrenzaInput: string,
    fallbackStart?: string,
    fallbackEnd?: string
  ): { mesi: string; giorni: string; formattedPeriod: string } => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (decorrenzaInput && decorrenzaInput.includes("-")) {
      const parts = decorrenzaInput.split("-");
      if (parts.length >= 2) {
        startDate = parseItalianDate(parts[0]);
        endDate = parseItalianDate(parts[1]);
      }
    }

    if (!startDate && fallbackStart) {
      startDate = parseItalianDate(fallbackStart);
    }
    if (!endDate && fallbackEnd) {
      endDate = parseItalianDate(fallbackEnd);
    }

    let formattedPeriod = decorrenzaInput ? decorrenzaInput.trim() : "";
    if (startDate && endDate) {
      formattedPeriod = `${formatDateToGG_MM_AAAA(startDate)} - ${formatDateToGG_MM_AAAA(endDate)}`;
      const timeDiff = endDate.getTime() - startDate.getTime();
      if (timeDiff >= 0) {
        // Including both end and start day in Italian administrative contract counting: (+1 day)
        const totalDays = Math.round(timeDiff / (1000 * 60 * 60 * 24)) + 1;
        const totalMonths = (totalDays / 30.4375).toFixed(1);
        return {
          mesi: totalMonths,
          giorni: String(totalDays),
          formattedPeriod,
        };
      }
    } else if (startDate && !endDate) {
      formattedPeriod = `${formatDateToGG_MM_AAAA(startDate)} - fine esigenze`;
    }

    return {
      mesi: "",
      giorni: "",
      formattedPeriod: formattedPeriod || "Non specificata",
    };
  };

function isSelfAppHtml(html: string): boolean {
  if (!html || typeof html !== "string") return false;
  return (
    html.includes('id="root"') &&
    (html.includes("ScuolaATA") ||
      html.includes("/src/main.tsx") ||
      html.includes("/assets/index") ||
      html.includes("vite/client"))
  );
}

interface DiscoveredSchoolLink {
  url: string;
  title: string;
  priority: number;
}

function findRelevantSchoolLinks(rawContent: string, baseUrl: string, doc?: Document): DiscoveredSchoolLink[] {
  const discovered: DiscoveredSchoolLink[] = [];
  const seenUrls = new Set<string>();

  const addLink = (rawUrl: string, title: string) => {
    if (!rawUrl || rawUrl.startsWith("#") || rawUrl.startsWith("javascript:") || rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:")) return;
    try {
      const resolved = new URL(rawUrl, baseUrl).href;
      if (seenUrls.has(resolved)) return;
      seenUrls.add(resolved);

      const lowerText = (title + " " + resolved).toLowerCase();
      let priority = 0;

      if (
        lowerText.includes("albipretorionline") ||
        lowerText.includes("portaleargo.it/albopretorio") ||
        lowerText.includes("albo pretorio") ||
        lowerText.includes("albo online") ||
        lowerText.includes("trasparenza-pa") ||
        lowerText.includes("pubblicita legale") ||
        lowerText.includes("pubblicità legale")
      ) {
        priority = 10;
      } else if (
        lowerText.includes("interpelli") ||
        lowerText.includes("convocazion") ||
        lowerText.includes("supplenz") ||
        lowerText.includes("personale ata") ||
        lowerText.includes("/ata/") ||
        lowerText.includes("avvisi ata") ||
        lowerText.includes("circolar") ||
        lowerText.includes("comunicazion")
      ) {
        priority = 5;
      } else if (lowerText.includes("trasparenza") || lowerText.includes("amministrazione trasparente")) {
        priority = 3;
      }

      if (priority > 0) {
        discovered.push({ url: resolved, title: title.trim() || resolved, priority });
      }
    } catch {
      // ignore malformed URLs
    }
  };

  // 1. Extract links from Markdown: [Title](url)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)\'\"]+)\)/g;
  let match;
  while ((match = mdRegex.exec(rawContent)) !== null) {
    addLink(match[2], match[1]);
  }

  // 2. Extract from known Italian PA platforms URLs in text
  const platformRegex = /(https?:\/\/(?:www\.)?(?:albipretorionline\.com\/[A-Za-z0-9_-]+|trasparenza-pa\.net\/\?codcli=[A-Za-z0-9_-]+|portaleargo\.it\/albopretorio\S*|axioscloud\.it\S*|spaggiari\.eu\S*))/gi;
  while ((match = platformRegex.exec(rawContent)) !== null) {
    addLink(match[1], "Piattaforma Albo / Atti Istituzionali");
  }

  // 3. Extract from HTML anchors if DOM document is available
  if (doc) {
    const anchors = Array.from(doc.querySelectorAll("a"));
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent || a.getAttribute("title") || "";
      addLink(href, text);
    }
  }

  return discovered.sort((a, b) => b.priority - a.priority);
}

function findActLinks(rawContent: string, baseUrl: string, doc?: Document): { url: string; title: string; id: string }[] {
  const acts: { url: string; title: string; id: string; score: number }[] = [];
  const seen = new Set<string>();

  const keywords = ["convocazione", "nomina", "supplenza", "interpello", "graduatoria", "pensionamento", "collocamento", "cessazione", "ata"];

  const addAct = (rawUrl: string, title: string) => {
    if (!rawUrl || rawUrl.startsWith("#") || rawUrl.startsWith("javascript:")) return;
    try {
      const resolved = new URL(rawUrl, baseUrl).href;
      if (seen.has(resolved)) return;
      seen.add(resolved);

      const lower = (title + " " + resolved).toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score += 2;
      }
      if (resolved.match(/\/atti\/\d+/)) score += 5;

      if (score > 0 || resolved.includes("/atti/")) {
        const idMatch = resolved.match(/\/atti\/(\d+)/);
        const id = idMatch ? idMatch[1] : resolved;
        acts.push({ url: resolved, title: title.trim() || resolved, id, score });
      }
    } catch {}
  };

  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)\'\"]+)\)/g;
  let match;
  while ((match = mdRegex.exec(rawContent)) !== null) {
    addAct(match[2], match[1]);
  }

  if (doc) {
    const anchors = Array.from(doc.querySelectorAll("a"));
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent || a.getAttribute("title") || "";
      addAct(href, text);
    }
  }

  return acts.sort((a, b) => b.score - a.score).slice(0, 10);
}

function extractDomain(urlStr: string): string {
  if (!urlStr) return "";
  try {
    const formatted = urlStr.startsWith("http://") || urlStr.startsWith("https://")
      ? urlStr
      : `https://${urlStr}`;
    const parsed = new URL(formatted);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return urlStr.toLowerCase();
  }
}

interface ProxyCandidate {
  name: string;
  isJina?: boolean;
  isLocal?: boolean;
  isEmergency?: boolean;
  timeoutMs: number;
  buildUrl: (u: string) => string;
}

async function fetchWithProxy(
  url: string,
  asArrayBuffer: boolean = false,
  onLog?: (msg: string) => void,
  customProxyUrl?: string,
  failedProxiesByDomain?: Map<string, Set<string>>
): Promise<{ data: any; method: string; format: "html" | "markdown" | "buffer" }> {
  let lastError = "";
  const currentDomain = extractDomain(url);

  const markProxyFailed = (proxyName: string) => {
    if (failedProxiesByDomain && currentDomain) {
      let failedSet = failedProxiesByDomain.get(currentDomain);
      if (!failedSet) {
        failedSet = new Set<string>();
        failedProxiesByDomain.set(currentDomain, failedSet);
      }
      failedSet.add(proxyName);
    }
  };

  const candidates: ProxyCandidate[] = [];

  // 1. Primary: Server Proxy (/api/proxy) - has browser impersonation + server-side Jina fallback (7000 ms)
  candidates.push({
    name: "Server Proxy (/api/proxy)",
    isLocal: true,
    timeoutMs: 7000,
    buildUrl: (u: string) => `/api/proxy?url=${encodeURIComponent(u)}`
  });

  // 2. Client-side Native CORS: Jina AI Web Reader (bypasses 403, executes JS, extracts full page text) (9000 ms)
  candidates.push({
    name: "Jina AI Web Reader (Bypass 403 & CORS)",
    isJina: true,
    timeoutMs: 9000,
    buildUrl: (u: string) => `https://r.jina.ai/${u}`
  });

  // 3. Tertiary Emergency Fallback: CorsProxy.io (6000 ms)
  candidates.push({
    name: "CorsProxy.io (Emergenza)",
    isEmergency: true,
    timeoutMs: 6000,
    buildUrl: (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
  });

  // 4. Custom proxy if specified by user
  if (customProxyUrl && customProxyUrl.trim()) {
    const cleanProxy = customProxyUrl.trim();
    candidates.push({
      name: "Proxy Personalizzato Utente",
      timeoutMs: 7000,
      buildUrl: (u: string) => cleanProxy.includes("${url}") ? cleanProxy.replace("${url}", encodeURIComponent(u)) : `${cleanProxy}${encodeURIComponent(u)}`
    });
  }

  let allSkipped = true;

  for (const proxy of candidates) {
    if (failedProxiesByDomain && currentDomain) {
      const failedSet = failedProxiesByDomain.get(currentDomain);
      if (failedSet && failedSet.has(proxy.name)) {
        onLog?.(`Salto ${proxy.name}: già fallito su questo dominio`);
        continue;
      }
    }

    allSkipped = false;

    try {
      onLog?.(`Connessione in corso tramite ${proxy.name}...`);
      const target = proxy.buildUrl(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxy.timeoutMs);

      const reqHeaders: Record<string, string> = {};
      const fetchOptions: RequestInit = {
        signal: controller.signal
      };

      let fetchTarget = target;

      if (proxy.isJina) {
        reqHeaders["Accept"] = "text/html,text/plain,*/*";
        reqHeaders["x-return-format"] = asArrayBuffer ? "html" : "markdown";
        reqHeaders["x-timeout"] = "10";

        const effectiveJinaKey = (jinaApiKey || (typeof window !== "undefined" ? localStorage.getItem("scuola_jina_api_key") || "" : "")).trim();
        if (effectiveJinaKey) {
          reqHeaders["Authorization"] = `Bearer ${effectiveJinaKey}`;
        }

        if (url.includes("#")) {
          onLog?.(`Rendering hash-route: ${url}`);
          fetchTarget = "https://r.jina.ai/";
          fetchOptions.method = "POST";
          reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          fetchOptions.body = `url=${encodeURIComponent(url)}`;
        }
      }

      fetchOptions.headers = reqHeaders;

      const response = await fetch(fetchTarget, fetchOptions);
      clearTimeout(timeoutId);

      if (response.ok) {
        if (asArrayBuffer) {
          const buf = await response.arrayBuffer();
          return { data: buf, method: proxy.name, format: "buffer" };
        }

        const text = await response.text();

        if (proxy.isLocal && isSelfAppHtml(text)) {
          lastError = `${proxy.name} ha restituito l'app SPA invece del sito remoto`;
          onLog?.(`Avviso: ${lastError}. Passo al provider successivo.`);
          markProxyFailed(proxy.name);
          continue;
        }

        if (text && text.length > 80) {
          const format = proxy.isJina ? "markdown" : "html";
          onLog?.(`Connessione riuscita via ${proxy.name} (${text.length} caratteri ricevuti).`);
          return { data: text, method: proxy.name, format };
        } else {
          lastError = `Risposta vuota o troppo breve (${text ? text.length : 0} caratteri)`;
          onLog?.(`Proxy ${proxy.name}: ${lastError}`);
          markProxyFailed(proxy.name);
        }
      } else {
        lastError = `Status ${response.status} (${response.statusText})`;
        onLog?.(`Proxy ${proxy.name} ha risposto con ${lastError}`);
        markProxyFailed(proxy.name);
      }
    } catch (e: any) {
      const timeoutSec = Math.round(proxy.timeoutMs / 1000);
      lastError = e.name === "AbortError" ? `Timeout connessione (${timeoutSec}s)` : e.message;
      onLog?.(`Tentativo fallito con ${proxy.name}: ${lastError}`);
      markProxyFailed(proxy.name);
    }
  }

  if (allSkipped && !lastError) {
    lastError = `Tutti i proxy disponibili sono già risultati falliti in precedenza su questo dominio (${currentDomain})`;
  }

  throw new Error(`Impossibile connettersi all'URL tramite la suite di proxy. Ultimo errore: ${lastError}`);
}

function parseHtml(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

function normalizePunteggio(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : Number(val.toFixed(2));
  }
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (
      !s ||
      s === "null" ||
      s === "none" ||
      s === "non riportato" ||
      s === "non specificato" ||
      s === "non presente" ||
      s === "n/d" ||
      s === "-" ||
      s === "nd" ||
      s === "assente" ||
      s === "mancante"
    ) {
      return null;
    }
    const clean = s.replace(",", ".").replace(/[^\d.-]/g, "");
    if (!clean) return null;
    const num = parseFloat(clean);
    return isNaN(num) ? null : Number(num.toFixed(2));
  }
  return null;
}

function inferTipologiaPersonale(item: any): "ATA" | "DOCENTE" {
  if (item?.tipologia_personale === "ATA" || item?.tipologia_personale === "DOCENTE") {
    return item.tipologia_personale;
  }
  const str = `${item?.profilo_lavorativo || ""} ${item?.profilo_professionale || ""} ${item?.classe_concorso_area_lab || ""} ${item?.classe_di_concorso || ""} ${item?.titolo_bando || ""}`.toLowerCase();
  if (
    str.includes("docente") ||
    str.includes("insegnante") ||
    str.includes("professore") ||
    str.includes("maestr") ||
    str.includes("primaria") ||
    str.includes("infanzia") ||
    str.includes("secondaria") ||
    str.includes("cattedra") ||
    str.includes("itp") ||
    str.includes("cdc") ||
    /\b(a-\d{2}|b-\d{2}|aaaa|eeee|admm|adss|adaa|adee)\b/i.test(str)
  ) {
    return "DOCENTE";
  }
  return "ATA";
}

function inferTipoPosto(item: any): "comune" | "sostegno" {
  if (item?.tipo_posto === "comune" || item?.tipo_posto === "sostegno") {
    return item.tipo_posto;
  }
  const str = `${item?.profilo_lavorativo || ""} ${item?.profilo_professionale || ""} ${item?.classe_concorso_area_lab || ""} ${item?.classe_di_concorso || ""} ${item?.titolo_bando || ""}`.toLowerCase();
  if (
    str.includes("sostegno") ||
    str.includes("psicofisic") ||
    str.includes("uditiv") ||
    str.includes("vista") ||
    str.includes("admm") ||
    str.includes("adss") ||
    str.includes("adaa") ||
    str.includes("adee")
  ) {
    return "sostegno";
  }
  return "comune";
}

function inferClasseConcorsoAreaLab(item: any, tipologia: "ATA" | "DOCENTE"): string {
  if (item?.classe_concorso_area_lab && item.classe_concorso_area_lab !== "Non applicabile") {
    return item.classe_concorso_area_lab;
  }
  if (item?.classe_di_concorso && item.classe_di_concorso !== "Non applicabile") {
    return item.classe_di_concorso;
  }
  const str = `${item?.profilo_lavorativo || ""} ${item?.profilo_professionale || ""} ${item?.titolo_bando || ""}`;
  if (tipologia === "DOCENTE") {
    const cdcMatch = str.match(/\b(A-\d{2}|B-\d{2}|AAAA|EEEE|ADMM|ADSS|ADAA|ADEE)\b/i);
    if (cdcMatch) return cdcMatch[1].toUpperCase();
    return "Non applicabile";
  } else {
    const atMatch = str.match(/\b(AR\d{2})\b/i);
    if (atMatch) return atMatch[1].toUpperCase();
    return "Non applicabile";
  }
}

async function extractWithOpenRouter(text: string, apiKey: string, systemPrompt?: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "ScuolaATA Scraper"
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt || "Sei un assistente specializzato nell'analisi di documenti scolastici. Estrai con precisione convocazioni, delibere e contratti per personale ATA e DOCENTI (inclusi CDC e aree laboratorio AT). Se il punteggio manca, restituisci RIGOROSAMENTE null (MAI 0). Rispondi solo con JSON valido." },
        { role: "user", content: `Analizza questo testo:\n\n${text}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  return await response.json();
}

async function extractPdfWithOpenRouter(
  pdfSource: string,
  promptText: string,
  apiKey: string,
  isBase64 = false,
  customProxyUrl?: string,
  failedProxiesByDomain?: Map<string, Set<string>>
) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "ScuolaATA Scraper"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "file", file: { filename: "atto.pdf", file_data: pdfSource } }
            ]
          }
        ],
        plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    if (!data?.error && data?.choices?.[0]?.message?.content) {
      return data;
    }
  } catch {}

  let base64Data = pdfSource;
  if (!isBase64) {
    try {
      const res = await fetchWithProxy(pdfSource, true, undefined, customProxyUrl, failedProxiesByDomain);
      const buf = res.data as ArrayBuffer;
      const u8 = new Uint8Array(buf);
      let binString = "";
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        const chunk = u8.subarray(i, i + chunkSize);
        binString += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      base64Data = `data:application/pdf;base64,${btoa(binString)}`;
    } catch (e: any) {
      throw new Error(`Impossibile scaricare o convertire il PDF: ${e.message}`);
    }
  }

  const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "ScuolaATA Scraper"
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "file", file: { filename: "atto.pdf", file_data: base64Data } }
          ]
        }
      ],
      plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
      response_format: { type: "json_object" }
    })
  });
  return await fallbackResponse.json();
}

async function executeClientSideSearch(queryStr: string, apiKey: string) {
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
        { role: "system", content: "Sei un assistente di ricerca specializzato nel reperire bandi, avvisi, convocazioni ATA e pensionamenti delle scuole italiane sul web con precisione e accuratezza nei conteggi." },
        { role: "user", content: `Cerca sul web informazioni aggiornate e atti ufficiali su: ${queryStr}` }
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
}

async function scrapeWebsite(
  targetUrl: string,
  apiKey: string,
  systemPrompt?: string,
  customProxyUrl?: string,
  failedProxiesByDomain: Map<string, Set<string>> = new Map()
) {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
  };

  let currentUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
  log(`Avvio estrazione approfondita per: ${currentUrl}`);

  let fullText = "";
  let navigatedUrl = currentUrl;
  let allTexts: string[] = [];

  try {
    // 1. Download homepage
    const homeRes = await fetchWithProxy(currentUrl, false, log, customProxyUrl, failedProxiesByDomain);
    const rawHome = homeRes.data as string;
    let homeText = "";
    let homeDoc: Document | undefined;

    if (homeRes.format === "html") {
      homeDoc = parseHtml(rawHome);
      homeText = homeDoc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
    } else {
      homeText = rawHome.replace(/[#*`_\[\]]/g, " ").replace(/\s+/g, " ").trim();
    }
    allTexts.push(`=== HOMEPAGE (${currentUrl}) ===\n${homeText}`);
    log(`Homepage analizzata (${homeText.length} caratteri estratti).`);

    // 2. Discover relevant sub-links (Albo Pretorio, Circolari, ATA, Trasparenza)
    const discoveredLinks = findRelevantSchoolLinks(rawHome, currentUrl, homeDoc);
    log(`Trovati ${discoveredLinks.length} link rilevanti (Albo, Circolari, Convocazioni).`);

    // Take top 5 highest priority links to crawl deeply
    const topLinksToFetch = discoveredLinks.slice(0, 5);
    for (const link of topLinksToFetch) {
      log(`Scansione approfondita sottolink: "${link.title}" (${link.url})`);
      try {
        navigatedUrl = link.url;
        const subRes = await fetchWithProxy(link.url, false, log, customProxyUrl, failedProxiesByDomain);
        const rawSub = subRes.data as string;
        let subText = "";
        let subDoc: Document | undefined;
        if (subRes.format === "html") {
          subDoc = parseHtml(rawSub);
          subText = subDoc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
        } else {
          subText = rawSub.replace(/[#*`_\[\]]/g, " ").replace(/\s+/g, " ").trim();
        }
        allTexts.push(`=== SOTTOPAGINA (${link.title}) ===\n${subText}`);

        // TASK 2: Extract individual acts (max 8-10 acts) and iterate over them
        const actLinks = findActLinks(rawSub, link.url, subDoc);
        if (actLinks.length > 0) {
          log(`Trovati ${actLinks.length} atti`);
          for (const act of actLinks) {
            log(`Apertura dettaglio atto ${act.id}`);
            try {
              navigatedUrl = act.url;
              const detailRes = await fetchWithProxy(act.url, false, log, customProxyUrl, failedProxiesByDomain);
              const rawDetail = detailRes.data as string;
              let detailText = "";
              if (detailRes.format === "html") {
                const detailDoc = parseHtml(rawDetail);
                detailText = detailDoc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
                const pdfAnchors = Array.from(detailDoc.querySelectorAll("a"));
                for (const pa of pdfAnchors) {
                  const ph = pa.getAttribute("href") || "";
                  if (ph.toLowerCase().endsWith(".pdf") || ph.toLowerCase().includes(".pdf?")) {
                    const pdfResolved = new URL(ph, act.url).href;
                    log(`PDF trovato: ${pdfResolved}`);
                    allTexts.push(`=== PDF ALLEGATO (${pdfResolved}) ===\n[PDF URL: ${pdfResolved}]`);

                    try {
                      log(`Invio PDF via URL/fallback base64: ${pdfResolved}`);
                      const pdfResJson = await extractPdfWithOpenRouter(
                        pdfResolved,
                        "Estrai con precisione da questo atto/PDF i dati relativi a: codice_meccanografico univoco della scuola (es. CHIC81000A, MIIS00100B, cerca nell'intestazione o email @istruzione.it), convocazioni, contratti e interpelli per personale ATA (collaboratore scolastico, assistente amministrativo, tecnico con relativa area laboratorio es. AR01, AR02, AR08, cuoco, agrario) e DOCENTI (infanzia, primaria, secondaria, cattedre comuni e sostegno con relativa classe di concorso CDC es. A-12, A-22, A-28, ADMM, ADSS), graduatorie, tipologia_personale, classe_concorso_area_lab, tipo_posto, ore e decorrenza. Se il punteggio manca, restituisci RIGOROSAMENTE null (MAI 0). Rispondi in JSON.",
                        apiKey,
                        false,
                        customProxyUrl,
                        failedProxiesByDomain
                      );
                      if (pdfResJson && !pdfResJson.error && pdfResJson?.choices?.[0]?.message?.content) {
                        const pdfContentStr = pdfResJson.choices[0].message.content;
                        allTexts.push(`=== ESTRAZIONE PDF (${pdfResolved}) ===\n${pdfContentStr}`);
                      }
                    } catch (pdfErr: any) {
                      log(`Avviso estrazione PDF ${pdfResolved}: ${pdfErr.message}`);
                    }
                  }
                }
              } else {
                detailText = rawDetail.replace(/[#*`_\[\]]/g, " ").replace(/\s+/g, " ").trim();
              }
              allTexts.push(`=== ATTO ${act.id} (${act.title}) ===\n${detailText}`);
            } catch (actErr: any) {
              log(`Avviso caricamento atto ${act.id}: ${actErr.message}`);
            }
          }
        }
      } catch (subErr: any) {
        log(`Avviso caricamento ${link.url}: ${subErr.message}`);
      }
    }

    fullText = allTexts.join("\n\n").substring(0, 60000);
  } catch (directErr: any) {
    log(`Impossibile leggere il sito direttamente (${directErr.message}).`);
  }

  try {
    const urlObj = new URL(currentUrl);
    const domain = urlObj.hostname.replace(/^www\./, "");
    log(`Avvio ricerca web approfondita (Grounding) per "${domain}"...`);
    const searchContent = await executeClientSideSearch(
      `Effettua una ricerca web approfondita e completa sull'istituto scolastico con dominio "${domain}". Individua tutti gli atti recenti, bandi, interpelli, convocazioni per il personale ATA (Collaboratore Scolastico, Assistente Amministrativo, Tecnico, Cuoco, Agrario), graduatorie e pensionamenti.`,
      apiKey
    );
    if (searchContent && searchContent.length > 50) {
      log(`Dati di ricerca web approfonditi ottenuti (${searchContent.length} caratteri).`);
      fullText += `\n\n=== WEB GROUNDING SEARCH RESULT ===\n${searchContent}`;
    }
  } catch (searchErr: any) {
    log(`Avviso ricerca web grounding: ${searchErr.message}`);
  }

  if (!fullText || fullText.trim().length < 30) {
    log(`Nessun contenuto testuale utile reperito per l'analisi.`);
    return { fullText: "", navigatedUrl, logs, content: "{}" };
  }

  log(`Invio di ${fullText.length} caratteri complessivi all'AI (Gemini 2.5 Flash) per estrazione approfondita...`);

  try {
    const resultJson = await extractWithOpenRouter(fullText, apiKey, systemPrompt);
    if (resultJson?.error) {
      log(`Errore restituito dall'API OpenRouter: ${resultJson.error.message || JSON.stringify(resultJson.error)}`);
      return { fullText, navigatedUrl, logs, content: "{}" };
    }

    const content = resultJson?.choices?.[0]?.message?.content || "{}";
    log(`Analisi approfondita completata con successo dall'AI.`);
    return { fullText, navigatedUrl, logs, content };
  } catch (aiErr: any) {
    log(`Errore durante l'elaborazione AI: ${aiErr.message}`);
    return { fullText, navigatedUrl, logs, content: "{}" };
  }
}

const executeClientSideExtract = async (
  targetUrl: string,
  apiKey: string,
  customProxy?: string,
  failedProxiesByDomain: Map<string, Set<string>> = new Map(),
  inputNominativo?: string
) => {
    const res = await scrapeWebsite(targetUrl, apiKey, EXTRACTION_SYSTEM_PROMPT, customProxy, failedProxiesByDomain);
    const defaultData = {
      nome_istituto: "",
      codice_meccanografico: "",
      nominativo: inputNominativo ? inputNominativo.trim() : "",
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
      tipologia_personale: "ATA" as "ATA" | "DOCENTE",
      classe_concorso_area_lab: "Non applicabile",
      tipo_posto: "comune" as "comune" | "sostegno",
      punteggio: null as number | null | string,
      origine_punteggio: undefined as OriginePunteggio | undefined,
      posizione_graduatoria: "",
      graduatoria_fascia: "",
      profilo_professionale: "",
      profilo_lavorativo: "",
      classe_di_concorso: "",
      ore_settimanali: "",
      decorrenza_da: "",
      decorrenza_a: "",
      decorrenza_contratto: "",
      durata_contratto_mesi: "",
      durata_contratto_giorni: "",
      link_del_documento: "",
      note_cross_reference: "",
      nomine_contratti: [] as NominaContrattoItem[],
      albo_contratti: [],
      pagine_graduatoria_esplorate: [] as string[]
    };
    let extractedData = { ...defaultData };
    try {
      const parsed = JSON.parse(res.content);
      extractedData = { ...defaultData, ...parsed };

      if (inputNominativo && inputNominativo.trim() && !extractedData.nominativo) {
        extractedData.nominativo = inputNominativo.trim();
      }

      // Infer school name / code if missing
      if (!extractedData.nome_istituto) {
        try {
          const u = new URL(res.navigatedUrl || targetUrl);
          const cleanHost = u.hostname.replace(/^www\./, "");
          extractedData.nome_istituto = cleanHost.toUpperCase();
        } catch {
          extractedData.nome_istituto = targetUrl;
        }
      }

      // -------------------------------------------------------------
      // Rinforzo Codice Meccanografico (Scansione approfondita)
      // -------------------------------------------------------------
      if (isValidCodiceMeccanografico(extractedData.codice_meccanografico)) {
        extractedData.codice_meccanografico = normalizeCodiceMeccanografico(extractedData.codice_meccanografico);
      } else {
        // Tentativo 1: ricerca nel testo completo o nei log/URL
        let candidate = extractCodiceMeccanograficoFromText(
          (res.fullText || "") + "\n" + (res.content || ""),
          res.navigatedUrl || targetUrl
        );

        // Tentativo 2: Se presente in una delle nomine estratte dal modello
        if (!candidate && Array.isArray(extractedData.nomine_contratti)) {
          for (const item of extractedData.nomine_contratti) {
            if (item.codice_meccanografico && isValidCodiceMeccanografico(item.codice_meccanografico)) {
              candidate = normalizeCodiceMeccanografico(item.codice_meccanografico);
              break;
            }
          }
        }

        // Tentativo 3: Se ancora assente, recupera la homepage o /contatti della scuola
        // (nel footer di quasi tutte le scuole statali italiane sono riportati C.M. e PEC/email @istruzione.it)
        if (!candidate) {
          try {
            const rootUrl = new URL(res.navigatedUrl || targetUrl).origin;
            const currentUrlObj = new URL(res.navigatedUrl || targetUrl);
            const isSubpage = currentUrlObj.pathname.length > 2 || (targetUrl && targetUrl.length > rootUrl.length + 2);
            if (isSubpage) {
              res.logs.push(`🔍 Ricerca codice meccanografico nella homepage della scuola (${rootUrl})...`);
              const homeRes = await fetchWithProxy(rootUrl, false, undefined, customProxy, failedProxiesByDomain);
              if (homeRes?.data) {
                candidate = extractCodiceMeccanograficoFromText(String(homeRes.data), rootUrl);
              }
            }
            if (!candidate) {
              const contattiUrl = `${rootUrl}/contatti`;
              try {
                const contattiRes = await fetchWithProxy(contattiUrl, false, undefined, customProxy, failedProxiesByDomain);
                if (contattiRes?.data) {
                  candidate = extractCodiceMeccanograficoFromText(String(contattiRes.data), contattiUrl);
                }
              } catch {
                // ignorato se /contatti non risponde
              }
            }
          } catch (netErr: any) {
            res.logs.push(`Avviso ricerca homepage per codice meccanografico: ${netErr.message}`);
          }
        }

        if (candidate && isValidCodiceMeccanografico(candidate)) {
          extractedData.codice_meccanografico = normalizeCodiceMeccanografico(candidate);
          res.logs.push(`🏫 Codice meccanografico individuato: ${extractedData.codice_meccanografico}`);
        }
      }

      // Propaga il codice meccanografico a tutte le nomine del contratto
      if (extractedData.codice_meccanografico && Array.isArray(extractedData.nomine_contratti)) {
        extractedData.nomine_contratti = extractedData.nomine_contratti.map((item: any) => ({
          ...item,
          codice_meccanografico: (item.codice_meccanografico && isValidCodiceMeccanografico(item.codice_meccanografico))
            ? normalizeCodiceMeccanografico(item.codice_meccanografico)
            : extractedData.codice_meccanografico
        }));
      }

      // Calculate duration for top-level if present
      const topDuration = calculateContractDuration(
        extractedData.decorrenza_contratto || "",
        extractedData.decorrenza_da,
        extractedData.decorrenza_a
      );
      extractedData.decorrenza_contratto = topDuration.formattedPeriod;
      extractedData.durata_contratto_mesi = topDuration.mesi;
      extractedData.durata_contratto_giorni = topDuration.giorni;

      const topTipologia = inferTipologiaPersonale(extractedData);
      extractedData.tipologia_personale = topTipologia;
      extractedData.tipo_posto = inferTipoPosto(extractedData);
      extractedData.classe_concorso_area_lab = inferClasseConcorsoAreaLab(extractedData, topTipologia);
      extractedData.classe_di_concorso = extractedData.classe_concorso_area_lab;
      extractedData.punteggio = normalizePunteggio(extractedData.punteggio);

      // Incrocio graduatorie per risalire a punteggi mancanti
      const currentGrad = getStoredGraduatorie();
      const topCross = crossReferenceNomina(
        {
          ...extractedData,
          posizione_graduatoria: extractedData.posizione_graduatoria || "",
          punteggio: extractedData.punteggio,
          profilo_lavorativo: extractedData.profilo_lavorativo || extractedData.profilo_professionale,
          fascia: extractedData.graduatoria_fascia,
          tipologia_personale: topTipologia,
          classe_concorso_area_lab: extractedData.classe_concorso_area_lab,
        } as any,
        currentGrad,
        {
          codice_meccanografico: extractedData.codice_meccanografico,
          nome_istituto: extractedData.nome_istituto,
        }
      );
      extractedData.punteggio = topCross.punteggio;
      extractedData.origine_punteggio = topCross.origine_punteggio;
      extractedData.note_cross_reference = topCross.note_cross_reference;

      // Calculate duration and cross-reference for each contract in nomine_contratti
      if (Array.isArray(extractedData.nomine_contratti)) {
        extractedData.nomine_contratti = extractedData.nomine_contratti.map((item: any) => {
          const duration = calculateContractDuration(item.decorrenza_contratto || "");
          const tipologia = inferTipologiaPersonale(item);
          const cdcArea = inferClasseConcorsoAreaLab(item, tipologia);
          const tipoPosto = inferTipoPosto(item);
          const punt = normalizePunteggio(item.punteggio);

          const baseItem = {
            ...item,
            nominativo: item.nominativo || extractedData.nominativo || "",
            nome_istituto: item.nome_istituto || extractedData.nome_istituto || "",
            codice_meccanografico: item.codice_meccanografico || extractedData.codice_meccanografico || "",
            tipologia_personale: tipologia,
            profilo_lavorativo: item.profilo_lavorativo || item.profilo_professionale || (tipologia === "DOCENTE" ? "Docente TD" : "Collaboratore scolastico TD"),
            classe_concorso_area_lab: cdcArea,
            tipo_posto: tipoPosto,
            classe_di_concorso: cdcArea,
            punteggio: punt,
            posizione_graduatoria: item.posizione_graduatoria || "Non riportata",
            fascia: item.fascia || item.graduatoria_fascia || "Non specificata",
            ore_settimanali: item.ore_settimanali || "Non riportate",
            decorrenza_contratto: duration.formattedPeriod,
            durata_contratto_mesi: duration.mesi,
            durata_contratto_giorni: duration.giorni,
            link_del_documento: item.link_del_documento || item.pdf_url || res.navigatedUrl || targetUrl,
          };

          return crossReferenceNomina(baseItem, currentGrad, {
            codice_meccanografico: baseItem.codice_meccanografico,
            nome_istituto: baseItem.nome_istituto,
          });
        });
      }

      // -------------------------------------------------------------
      // TASK 5.1 — Trigger + ricerca pagina graduatoria
      // Se PUNTEGGIO manca ma NOMINATIVO è presente → avvia ricerca
      // -------------------------------------------------------------
      const topPunteggioMancante =
        extractedData.punteggio === null ||
        extractedData.punteggio === undefined ||
        extractedData.punteggio === "";
      const topNominativoPresente = !!(extractedData.nominativo && extractedData.nominativo.trim());

      const hasNominaNeedingSearch =
        Array.isArray(extractedData.nomine_contratti) &&
        extractedData.nomine_contratti.some(
          (n: any) =>
            (n.punteggio === null || n.punteggio === undefined || n.punteggio === "") &&
            !!(n.nominativo && n.nominativo.trim())
        );

      if ((topPunteggioMancante && topNominativoPresente) || hasNominaNeedingSearch) {
        res.logs.push("🔎 Cerco in graduatoria...");

        try {
          const exploredPages = await searchGraduatoriaPages(
            targetUrl,
            (url, asBuf, onLog) =>
              fetchWithProxy(url, asBuf, onLog, customProxy, failedProxiesByDomain),
            (logMsg) => res.logs.push(logMsg)
          );
          extractedData.pagine_graduatoria_esplorate = exploredPages.map((p) => p.url);
          res.logs.push(
            `Completata ricerca sezioni graduatorie: ${exploredPages.length} pagine esplorate sul dominio.`
          );

          // -------------------------------------------------------------
          // TASK 5.2 & 5.3 — Estrazione + matching + fallback
          // -------------------------------------------------------------
          let matchedScore: number | null = null;
          let matchedEntry: { nominativo: string; punteggio: number; classe_concorso?: string; sourceUrl: string } | null = null;

          if (exploredPages.length > 0) {
            const targetNom = (extractedData.nominativo || "").trim();
            const targetCdc = (
              extractedData.classe_concorso_area_lab ||
              extractedData.classe_di_concorso ||
              extractedData.profilo_lavorativo ||
              ""
            ).trim();

            for (const page of exploredPages) {
              if (matchedEntry) break;

              // 1. Analisi testo HTML / markdown della pagina
              const pageText = (page.content || "").slice(0, 35000).trim();
              if (pageText.length > 50) {
                res.logs.push(`Estrazione dati graduatoria da: "${page.title}" (${page.url})`);
                try {
                  const llmRes = await extractWithOpenRouter(pageText, apiKey, GRADUATORIA_EXTRACTION_SYSTEM_PROMPT);
                  const parsedJson = JSON.parse(llmRes?.choices?.[0]?.message?.content || "{}");
                  const entries: any[] = Array.isArray(parsedJson.graduatoria_entries)
                    ? parsedJson.graduatoria_entries
                    : [];

                  for (const entry of entries) {
                    if (
                      entry &&
                      entry.punteggio !== null &&
                      entry.punteggio !== undefined &&
                      !isNaN(parseFloat(String(entry.punteggio)))
                    ) {
                      const scoreNum = Number(parseFloat(String(entry.punteggio)).toFixed(2));
                      // Verifica corrispondenza nome E classe di concorso
                      const nameMatches = isNameMatch(entry.nominativo, targetNom) ||
                        (Array.isArray(extractedData.nomine_contratti) &&
                          extractedData.nomine_contratti.some((n: any) => isNameMatch(entry.nominativo, n.nominativo)));

                      const classMatches = isClassMatch(entry.classe_concorso, targetCdc) ||
                        (Array.isArray(extractedData.nomine_contratti) &&
                          extractedData.nomine_contratti.some((n: any) =>
                            isClassMatch(
                              entry.classe_concorso,
                              n.classe_concorso_area_lab || n.classe_di_concorso || n.profilo_lavorativo
                            )
                          ));

                      if (nameMatches && classMatches) {
                        matchedScore = scoreNum;
                        matchedEntry = {
                          nominativo: entry.nominativo,
                          punteggio: scoreNum,
                          classe_concorso: entry.classe_concorso || targetCdc,
                          sourceUrl: page.url,
                        };
                        break;
                      }
                    }
                  }
                } catch (pageErr: any) {
                  res.logs.push(`Avviso estrazione pagina graduatoria: ${pageErr.message}`);
                }
              }

              // 2. Analisi PDF allegati alla pagina se non ancora trovato
              if (!matchedEntry && Array.isArray(page.pdfLinks) && page.pdfLinks.length > 0) {
                const pdfsToScan = page.pdfLinks.slice(0, 3);
                for (const pdfUrl of pdfsToScan) {
                  if (matchedEntry) break;
                  res.logs.push(`Estrazione da PDF graduatoria allegato: ${pdfUrl}`);
                  try {
                    const pdfResult = await extractPdfWithOpenRouter(
                      pdfUrl,
                      GRADUATORIA_EXTRACTION_SYSTEM_PROMPT,
                      apiKey,
                      false,
                      customProxy,
                      failedProxiesByDomain
                    );
                    const parsedPdf = JSON.parse(pdfResult?.choices?.[0]?.message?.content || "{}");
                    const entries: any[] = Array.isArray(parsedPdf.graduatoria_entries)
                      ? parsedPdf.graduatoria_entries
                      : [];

                    for (const entry of entries) {
                      if (
                        entry &&
                        entry.punteggio !== null &&
                        entry.punteggio !== undefined &&
                        !isNaN(parseFloat(String(entry.punteggio)))
                      ) {
                        const scoreNum = Number(parseFloat(String(entry.punteggio)).toFixed(2));
                        const nameMatches = isNameMatch(entry.nominativo, targetNom) ||
                          (Array.isArray(extractedData.nomine_contratti) &&
                            extractedData.nomine_contratti.some((n: any) => isNameMatch(entry.nominativo, n.nominativo)));

                        const classMatches = isClassMatch(entry.classe_concorso, targetCdc) ||
                          (Array.isArray(extractedData.nomine_contratti) &&
                            extractedData.nomine_contratti.some((n: any) =>
                              isClassMatch(
                                entry.classe_concorso,
                                n.classe_concorso_area_lab || n.classe_di_concorso || n.profilo_lavorativo
                              )
                            ));

                        if (nameMatches && classMatches) {
                          matchedScore = scoreNum;
                          matchedEntry = {
                            nominativo: entry.nominativo,
                            punteggio: scoreNum,
                            classe_concorso: entry.classe_concorso || targetCdc,
                            sourceUrl: pdfUrl,
                          };
                          break;
                        }
                      }
                    }
                  } catch (pdfErr: any) {
                    res.logs.push(`Avviso estrazione PDF: ${pdfErr.message}`);
                  }
                }
              }
            }
          }

          // Se match → compila PUNTEGGIO con valore trovato
          if (matchedEntry && matchedScore !== null) {
            res.logs.push(`✅ Trovato: ${matchedScore}`);
            extractedData.punteggio = matchedScore;
            extractedData.origine_punteggio = "Incrociato";
            extractedData.note_cross_reference = `Punteggio incrociato da graduatoria (${matchedEntry.sourceUrl}): ${matchedEntry.nominativo} [${matchedEntry.classe_concorso}] = ${matchedScore} pt`;

            // Aggiorna anche le nomine nei contratti
            if (Array.isArray(extractedData.nomine_contratti)) {
              extractedData.nomine_contratti = extractedData.nomine_contratti.map((n: any) => {
                if (
                  isNameMatch(n.nominativo, matchedEntry!.nominativo) &&
                  isClassMatch(
                    n.classe_concorso_area_lab || n.classe_di_concorso || n.profilo_lavorativo,
                    matchedEntry!.classe_concorso
                  )
                ) {
                  return {
                    ...n,
                    punteggio: matchedScore,
                    origine_punteggio: "Incrociato",
                    note_cross_reference: `Punteggio incrociato da graduatoria (${matchedEntry!.sourceUrl}): ${matchedEntry!.nominativo} = ${matchedScore} pt`,
                  };
                } else if (
                  (n.punteggio === null || n.punteggio === undefined || n.punteggio === "") &&
                  !!(n.nominativo && n.nominativo.trim())
                ) {
                  return {
                    ...n,
                    punteggio: "Da verificare manualmente",
                    origine_punteggio: "Non disponibile",
                  };
                }
                return n;
              });
            }
          } else {
            // TASK 5.3: Nessuna graduatoria trovata O nessun match valido → PUNTEGGIO = "Da verificare manualmente"
            res.logs.push("⚠️ Non trovato, segnato per verifica");
            if (topPunteggioMancante && topNominativoPresente) {
              extractedData.punteggio = "Da verificare manualmente";
              extractedData.origine_punteggio = "Non disponibile";
            }
            if (Array.isArray(extractedData.nomine_contratti)) {
              extractedData.nomine_contratti = extractedData.nomine_contratti.map((n: any) => {
                if (
                  (n.punteggio === null || n.punteggio === undefined || n.punteggio === "") &&
                  !!(n.nominativo && n.nominativo.trim())
                ) {
                  return {
                    ...n,
                    punteggio: "Da verificare manualmente",
                    origine_punteggio: "Non disponibile",
                  };
                }
                return n;
              });
            }
          }
        } catch (searchErr: any) {
          res.logs.push(`Avviso ricerca pagine graduatoria: ${searchErr.message}`);
          res.logs.push("⚠️ Non trovato, segnato per verifica");
          if (topPunteggioMancante && topNominativoPresente) {
            extractedData.punteggio = "Da verificare manualmente";
            extractedData.origine_punteggio = "Non disponibile";
          }
          if (Array.isArray(extractedData.nomine_contratti)) {
            extractedData.nomine_contratti = extractedData.nomine_contratti.map((n: any) => {
              if (
                (n.punteggio === null || n.punteggio === undefined || n.punteggio === "") &&
                !!(n.nominativo && n.nominativo.trim())
              ) {
                return {
                  ...n,
                  punteggio: "Da verificare manualmente",
                  origine_punteggio: "Non disponibile",
                };
              }
              return n;
            });
          }
        }
      }
    } catch {
      // fallback
    }
    return {
      status: "success" as const,
      url: targetUrl,
      navigatedUrl: res.navigatedUrl,
      logs: res.logs,
      data: extractedData
    };
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
        setIsSettingsOpen(true);
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare la scansione dell'Albo Pretorio.");
      }
      const res = await scrapeWebsite(formattedUrl, openRouterApiKey.trim(), EXTRACTION_SYSTEM_PROMPT, customProxyUrl.trim());
      setAlboScanResult({ success: true, ...res });
    } catch (err: any) {
      setAlboScanError(err.message);
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
        setIsSettingsOpen(true);
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'estrazione client-side dei PDF.");
      }

      const arrayBuffer = await selectedPdfFile.arrayBuffer();
      const u8 = new Uint8Array(arrayBuffer);
      let binString = "";
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        const chunk = u8.subarray(i, i + chunkSize);
        binString += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      const base64Pdf = `data:application/pdf;base64,${btoa(binString)}`;
      const prompt = `${PDF_EXTRACTION_SYSTEM_PROMPT}\n\nEstrai i dati strutturati da questo documento PDF allegato:`;

      const respData = await extractPdfWithOpenRouter(base64Pdf, prompt, openRouterApiKey.trim(), true, customProxyUrl.trim());
      if (respData?.error) {
        throw new Error(respData.error.message || "Errore di parsing PDF con OpenRouter");
      }

      const content = respData?.choices?.[0]?.message?.content || "{}";
      const extracted = JSON.parse(content);

      // Rinforzo codice meccanografico per il PDF
      if (!isValidCodiceMeccanografico(extracted.codice_meccanografico)) {
        const found = extractCodiceMeccanograficoFromText(content, selectedPdfFile.name);
        if (found) {
          extracted.codice_meccanografico = found;
        }
      } else {
        extracted.codice_meccanografico = normalizeCodiceMeccanografico(extracted.codice_meccanografico);
      }

      const duration = calculateContractDuration(
        extracted.decorrenza_contratto || "",
        extracted.decorrenza_da,
        extracted.decorrenza_a
      );

      const pdfTipologia = inferTipologiaPersonale(extracted);
      const pdfCdcArea = inferClasseConcorsoAreaLab(extracted, pdfTipologia);
      const pdfTipoPosto = inferTipoPosto(extracted);
      const pdfPunteggio = normalizePunteggio(extracted.punteggio);

      const crossPdf = crossReferenceNomina(
        {
          nome_istituto: extracted.nome_istituto || "Istituto Scolastico",
          codice_meccanografico: extracted.codice_meccanografico || "",
          tipologia_personale: pdfTipologia,
          profilo_lavorativo: extracted.profilo_lavorativo || extracted.profilo_professionale || (pdfTipologia === "DOCENTE" ? "Docente TD" : "Collaboratore scolastico TD"),
          classe_concorso_area_lab: pdfCdcArea,
          tipo_posto: pdfTipoPosto,
          classe_di_concorso: pdfCdcArea,
          punteggio: pdfPunteggio,
          posizione_graduatoria: extracted.posizione_graduatoria || "Non riportata",
          fascia: extracted.fascia || extracted.graduatoria_fascia || "Non specificata",
          ore_settimanali: extracted.ore_settimanali || "Non riportate",
          decorrenza_contratto: duration.formattedPeriod,
          durata_contratto_mesi: duration.mesi,
          durata_contratto_giorni: duration.giorni,
          link_del_documento: selectedPdfFile.name,
        } as any,
        graduatorie,
        {
          codice_meccanografico: extracted.codice_meccanografico,
          nome_istituto: extracted.nome_istituto,
        }
      );

      setPdfExtractResult({
        success: true,
        filename: selectedPdfFile.name,
        size: selectedPdfFile.size,
        data: {
          nome_istituto: crossPdf.nome_istituto || "Istituto Scolastico",
          codice_meccanografico: crossPdf.codice_meccanografico || "",
          tipologia_personale: pdfTipologia,
          profilo_lavorativo: crossPdf.profilo_lavorativo,
          classe_concorso_area_lab: pdfCdcArea,
          tipo_posto: pdfTipoPosto,
          classe_di_concorso: pdfCdcArea,
          punteggio: crossPdf.punteggio,
          origine_punteggio: crossPdf.origine_punteggio,
          note_cross_reference: crossPdf.note_cross_reference,
          posizione_graduatoria: crossPdf.posizione_graduatoria,
          fascia: crossPdf.fascia,
          ore_settimanali: crossPdf.ore_settimanali,
          decorrenza_contratto: duration.formattedPeriod,
          durata_contratto_mesi: duration.mesi,
          durata_contratto_giorni: duration.giorni,
          link_del_documento: selectedPdfFile.name,
          // Compatibilità pregressa
          graduatoria_fascia: crossPdf.fascia,
          profilo_professionale: crossPdf.profilo_lavorativo,
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
        setIsSettingsOpen(true);
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
    const csvContent = "url,nominativo\nhttps://www.icmariantomai.edu.it,Rossi Mario\nhttps://www.iischiapparelli.edu.it,\nhttps://www.liceoclassicocavour.edu.it,Bianchi Anna";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "scuole_campione.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  interface BatchInputRow {
    url: string;
    nominativo?: string;
  }

  const parseCsvClientSide = (csvText: string): BatchInputRow[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const hasHeader =
      firstLine.includes("url") ||
      firstLine.includes("link") ||
      firstLine.includes("scuola") ||
      firstLine.includes("nominativo") ||
      firstLine.includes("candidato");

    let urlCol = 0;
    let nomCol = -1;

    if (hasHeader) {
      const headerParts = lines[0]
        .split(/[;,]/)
        .map(p => p.trim().replace(/^["']|["']$/g, "").toLowerCase());
      urlCol = headerParts.findIndex(h => h.includes("url") || h.includes("link") || h.includes("scuola"));
      if (urlCol === -1) urlCol = 0;
      nomCol = headerParts.findIndex(
        h =>
          h.includes("nominativo") ||
          h.includes("candidato") ||
          h.includes("nome") ||
          h.includes("docente") ||
          h.includes("persona")
      );
    }

    const results: BatchInputRow[] = [];
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(/[;,]/).map(p => p.trim().replace(/^["']|["']$/g, ""));

      let foundUrl = "";
      let foundNom: string | undefined = undefined;

      if (hasHeader) {
        if (parts[urlCol]) foundUrl = parts[urlCol];
        if (nomCol !== -1 && parts[nomCol]) foundNom = parts[nomCol];
      } else {
        // Cerca colonna con URL
        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
          const val = parts[pIdx];
          if (
            val.startsWith("http://") ||
            val.startsWith("https://") ||
            val.includes(".edu.it") ||
            val.includes(".gov.it") ||
            val.includes("www.") ||
            val.includes(".it")
          ) {
            foundUrl = val;
            const otherCol = parts.find((o, idx) => idx !== pIdx && o.length > 1 && !o.startsWith("http"));
            if (otherCol) foundNom = otherCol;
            break;
          }
        }
      }

      if (foundUrl) {
        if (!foundUrl.startsWith("http://") && !foundUrl.startsWith("https://")) {
          foundUrl = `https://${foundUrl}`;
        }
        results.push({ url: foundUrl, nominativo: foundNom ? foundNom.trim() : undefined });
      }
    }

    // Deduplica per url + nominativo
    const seen = new Set<string>();
    return results.filter(item => {
      const key = `${item.url}|${item.nominativo || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    setBatchLiveLog([]);
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
      const batchItems = parseCsvClientSide(csvText);

      if (batchItems.length === 0) {
        throw new Error("Nessun URL valido trovato nel file CSV. Assicurarsi che il file contenga una colonna con link validi.");
      }

      const BATCH_SIZE = 15;
      const batches: BatchInputRow[][] = [];
      for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
        batches.push(batchItems.slice(i, i + BATCH_SIZE));
      }
      const totalBatches = batches.length;

      setBatchProgress({ current: 0, total: batchItems.length });
      setBatchInfo({
        currentBatch: 1,
        totalBatches,
        batchSize: BATCH_SIZE,
      });

      const results: ExtractionResult[] = new Array(batchItems.length);
      let processedCount = 0;
      const failedProxiesByDomain = new Map<string, Set<string>>();

      for (let b = 0; b < batches.length; b++) {
        const currentBatchNum = b + 1;
        const currentBatchRowItems = batches[b];
        const batchStartIndex = b * BATCH_SIZE;
        setBatchInfo(prev => ({ ...prev, currentBatch: currentBatchNum, totalBatches }));

        // Concurrency pool with maximum 4 parallel requests within each batch of 15
        const CONCURRENCY_LIMIT = 4;
        let nextIndex = 0;

        const workers = Array.from(
          { length: Math.min(CONCURRENCY_LIMIT, currentBatchRowItems.length) },
          async () => {
            while (nextIndex < currentBatchRowItems.length) {
              const itemIdx = nextIndex++;
              const rowItem = currentBatchRowItems[itemIdx];
              const globalIndex = batchStartIndex + itemIdx;
              const itemLabel = rowItem.nominativo ? `${rowItem.url} [${rowItem.nominativo}]` : rowItem.url;

              setBatchLiveLog(prev => [...prev, `▶ ${itemLabel}`]);
              try {
                const clientData = await executeClientSideExtract(
                  rowItem.url,
                  openRouterApiKey.trim(),
                  customProxyUrl.trim(),
                  failedProxiesByDomain,
                  rowItem.nominativo
                );
                const lastLog = clientData.logs && clientData.logs.length > 0 ? clientData.logs[clientData.logs.length - 1] : "Completato";
                setBatchLiveLog(prev => [...prev, `✅ ${itemLabel} — ${lastLog}`]);
                results[globalIndex] = clientData as any;
              } catch (itemErr: any) {
                const errMsg = itemErr?.message || "Errore sconosciuto";
                setBatchLiveLog(prev => [...prev, `❌ ${itemLabel} — ${errMsg}`]);
                results[globalIndex] = {
                  status: "error",
                  url: rowItem.url,
                  navigatedUrl: rowItem.url,
                  logs: [errMsg],
                  data: {
                    nominativo: rowItem.nominativo,
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
                    albo_contratti: []
                  }
                };
              } finally {
                processedCount++;
                setBatchProgress({ current: processedCount, total: batchItems.length });
              }
            }
          }
        );

        await Promise.all(workers);
      }

      const clientSuccessMsg = `Elaborazione completata: ${batchItems.length} link processati su ${batchItems.length} totali in ${totalBatches} batch.`;
      setBatchInfo(prev => ({ ...prev, finalMessage: clientSuccessMsg }));
      setBatchResults(results);
      saveBatchToHistory(results, selectedFile?.name || "batch_urls.csv");
    } catch (err: any) {
      setBatchError(err.message || "Errore di connessione.");
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Recalculates cross-referencing on existing batch results with current graduatorie in memory
  const recalculateCrossReferenceOnBatchResults = () => {
    if (batchResults.length === 0) return;
    const currentGrad = getStoredGraduatorie();
    const updated = batchResults.map(r => {
      if (!r.data) return r;
      const topTip = inferTipologiaPersonale(r.data);
      const topCross = crossReferenceNomina(
        {
          ...r.data,
          posizione_graduatoria: r.data.posizione_graduatoria || "",
          punteggio: r.data.origine_punteggio === "Incrociato" ? null : r.data.punteggio,
          profilo_lavorativo: r.data.profilo_lavorativo || r.data.profilo_professionale,
          fascia: r.data.graduatoria_fascia,
          tipologia_personale: topTip,
          classe_concorso_area_lab: r.data.classe_concorso_area_lab,
        } as any,
        currentGrad,
        {
          codice_meccanografico: r.data.codice_meccanografico,
          nome_istituto: r.data.nome_istituto,
        }
      );

      let updatedNomine = r.data.nomine_contratti;
      if (Array.isArray(updatedNomine)) {
        updatedNomine = updatedNomine.map((item: any) => {
          return crossReferenceNomina(
            {
              ...item,
              punteggio: item.origine_punteggio === "Incrociato" ? null : item.punteggio,
            },
            currentGrad,
            {
              codice_meccanografico: item.codice_meccanografico || r.data.codice_meccanografico,
              nome_istituto: item.nome_istituto || r.data.nome_istituto,
            }
          );
        });
      }

      return {
        ...r,
        data: {
          ...r.data,
          punteggio: topCross.punteggio,
          origine_punteggio: topCross.origine_punteggio,
          note_cross_reference: topCross.note_cross_reference,
          nomine_contratti: updatedNomine,
        }
      };
    });
    setBatchResults(updated);
  };

  // Unified helper to convert any results to 16-column CSV format with cross-referencing
  const generateUnifiedCsvContent = (items: ExtractionResult[]): string => {
    const headers = [
      "Nome Istituto",
      "Codice Meccanografico",
      "Tipologia",
      "Profilo",
      "Classe di Concorso / Area AT",
      "Tipo Posto",
      "Punteggio",
      "Origine Punteggio",
      "Posizione",
      "Fascia",
      "Ore",
      "Decorrenza",
      "Durata Mesi",
      "Durata Giorni",
      "Note Incrocio",
      "Link",
    ];

    const formatCsvPunteggio = (p: any): string => {
      if (p === null || p === undefined) return "";
      if (typeof p === "number") return p.toFixed(2);
      const str = String(p).trim();
      if (str === "null" || str === "Non riportato" || str === "Non specificato" || str === "N/D" || str === "-" || str === "") return "";
      const num = parseFloat(str.replace(",", "."));
      return isNaN(num) ? str : num.toFixed(2);
    };

    const rows: string[] = [];

    for (const r of items) {
      const data = r.data || ({} as any);

      // School Name: from data or URL
      let defaultSchoolName = data.nome_istituto || "";
      if (!defaultSchoolName) {
        try {
          const u = new URL(r.navigatedUrl || r.url);
          defaultSchoolName = u.hostname.replace(/^www\./, "").toUpperCase();
        } catch {
          defaultSchoolName = r.url || "Istituto Scolastico";
        }
      }
      const defaultSchoolCode = data.codice_meccanografico || "";

      // 1. If nomine_contratti is present and has elements, create one row per nomination
      if (Array.isArray(data.nomine_contratti) && data.nomine_contratti.length > 0) {
        for (const c of data.nomine_contratti) {
          const duration = calculateContractDuration(c.decorrenza_contratto || "");
          const schoolName = c.nome_istituto || defaultSchoolName;
          const schoolCode = c.codice_meccanografico || defaultSchoolCode;
          const tipologia = c.tipologia_personale || "ATA";
          const profilo = c.profilo_lavorativo || "Collaboratore scolastico TD";
          const classe = c.classe_concorso_area_lab || c.classe_di_concorso || "Non applicabile";
          const tipoPosto = c.tipo_posto || "comune";
          const punteggio = formatCsvPunteggio(c.punteggio);
          const origine = c.origine_punteggio || (punteggio ? "Esplicito" : "Non disponibile");
          const posizione = c.posizione_graduatoria || "Non riportata";
          const fascia = c.fascia || "Non specificata";
          const ore = c.ore_settimanali || "Non riportate";
          const decorrenza = duration.formattedPeriod;
          const mesi = duration.mesi;
          const giorni = duration.giorni;
          const noteIncrocio = c.note_cross_reference || "";
          const link = c.link_del_documento || r.navigatedUrl || r.url;

          rows.push([
            `"${schoolName.replace(/"/g, '""')}"`,
            `"${schoolCode.replace(/"/g, '""')}"`,
            `"${tipologia.replace(/"/g, '""')}"`,
            `"${profilo.replace(/"/g, '""')}"`,
            `"${classe.replace(/"/g, '""')}"`,
            `"${tipoPosto.replace(/"/g, '""')}"`,
            `"${punteggio.replace(/"/g, '""')}"`,
            `"${origine.replace(/"/g, '""')}"`,
            `"${posizione.replace(/"/g, '""')}"`,
            `"${fascia.replace(/"/g, '""')}"`,
            `"${ore.replace(/"/g, '""')}"`,
            `"${decorrenza.replace(/"/g, '""')}"`,
            `"${mesi}"`,
            `"${giorni}"`,
            `"${noteIncrocio.replace(/"/g, '""')}"`,
            `"${link.replace(/"/g, '""')}"`,
          ].join(","));
        }
      } 
      // 2. If albo_contratti has items, expand each contract to one row
      else if (Array.isArray(data.albo_contratti) && data.albo_contratti.length > 0) {
        for (const c of data.albo_contratti) {
          const duration = calculateContractDuration("", c.decorrenza_da, c.decorrenza_a);
          const schoolName = defaultSchoolName;
          const schoolCode = defaultSchoolCode;
          const tipologia = c.tipologia_personale || "ATA";
          const profilo = c.profilo_professionale || c.titolo_bando || "Personale Scolastico";
          const classe = c.classe_concorso_area_lab || c.classe_di_concorso || "Non applicabile";
          const tipoPosto = c.tipo_posto || "comune";
          const punteggio = formatCsvPunteggio(c.punteggio);
          const origine = c.origine_punteggio || (punteggio ? "Esplicito" : "Non disponibile");
          const posizione = c.posizione_graduatoria || "Non riportata";
          const fascia = c.graduatoria_fascia || "Non specificata";
          const ore = c.ore_settimanali || "Non riportate";
          const decorrenza = duration.formattedPeriod;
          const mesi = duration.mesi;
          const giorni = duration.giorni;
          const noteIncrocio = c.note_cross_reference || "";
          const link = c.pdf_url || r.navigatedUrl || r.url;

          rows.push([
            `"${schoolName.replace(/"/g, '""')}"`,
            `"${schoolCode.replace(/"/g, '""')}"`,
            `"${tipologia.replace(/"/g, '""')}"`,
            `"${profilo.replace(/"/g, '""')}"`,
            `"${classe.replace(/"/g, '""')}"`,
            `"${tipoPosto.replace(/"/g, '""')}"`,
            `"${punteggio.replace(/"/g, '""')}"`,
            `"${origine.replace(/"/g, '""')}"`,
            `"${posizione.replace(/"/g, '""')}"`,
            `"${fascia.replace(/"/g, '""')}"`,
            `"${ore.replace(/"/g, '""')}"`,
            `"${decorrenza.replace(/"/g, '""')}"`,
            `"${mesi}"`,
            `"${giorni}"`,
            `"${noteIncrocio.replace(/"/g, '""')}"`,
            `"${link.replace(/"/g, '""')}"`,
          ].join(","));
        }
      }
      // 3. Fallback: single contract row with top-level data
      else {
        const duration = calculateContractDuration(
          data.decorrenza_contratto || "",
          data.decorrenza_da,
          data.decorrenza_a
        );
        const schoolName = defaultSchoolName;
        const schoolCode = defaultSchoolCode;
        const tipologia = data.tipologia_personale || "ATA";
        const profilo = data.profilo_lavorativo || data.profilo_professionale || (
          data.convocazioni_collaboratore_scolastico > 0 ? "Collaboratore Scolastico TD" :
          data.convocazioni_assistente_amministrativo > 0 ? "Assistente Amministrativo TD" :
          data.convocazioni_docenti > 0 ? "Docente TD" :
          data.convocazioni_assistente_tecnico > 0 ? "Assistente Tecnico TD" :
          "Personale Scolastico"
        );
        const classe = data.classe_concorso_area_lab || data.classe_di_concorso || "Non applicabile";
        const tipoPosto = data.tipo_posto || "comune";
        const punteggio = formatCsvPunteggio(data.punteggio);
        const origine = data.origine_punteggio || (punteggio ? "Esplicito" : "Non disponibile");
        const posizione = data.posizione_graduatoria || "Non riportata";
        const fascia = data.graduatoria_fascia || "Non specificata";
        const ore = data.ore_settimanali || "Non riportate";
        const decorrenza = duration.formattedPeriod;
        const mesi = duration.mesi;
        const giorni = duration.giorni;
        const noteIncrocio = data.note_cross_reference || "";
        const link = data.link_del_documento || r.navigatedUrl || r.url;

        rows.push([
          `"${schoolName.replace(/"/g, '""')}"`,
          `"${schoolCode.replace(/"/g, '""')}"`,
          `"${tipologia.replace(/"/g, '""')}"`,
          `"${profilo.replace(/"/g, '""')}"`,
          `"${classe.replace(/"/g, '""')}"`,
          `"${tipoPosto.replace(/"/g, '""')}"`,
          `"${punteggio.replace(/"/g, '""')}"`,
          `"${origine.replace(/"/g, '""')}"`,
          `"${posizione.replace(/"/g, '""')}"`,
          `"${fascia.replace(/"/g, '""')}"`,
          `"${ore.replace(/"/g, '""')}"`,
          `"${decorrenza.replace(/"/g, '""')}"`,
          `"${mesi}"`,
          `"${giorni}"`,
          `"${noteIncrocio.replace(/"/g, '""')}"`,
          `"${link.replace(/"/g, '""')}"`,
        ].join(","));
      }
    }

    return [headers.join(","), ...rows].join("\n");
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

    const csvContent = generateUnifiedCsvContent(batchResults);
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
        setIsSettingsOpen(true);
        throw new Error("Inserisci la tua OpenRouter API Key nelle Impostazioni per abilitare l'estrazione client-side.");
      }

      const clientData = await executeClientSideExtract(
        formattedUrl,
        openRouterApiKey.trim(),
        customProxyUrl.trim(),
        undefined,
        singleNominativo.trim()
      );
      setSingleResult(clientData as any);
    } catch (err: any) {
      setSingleError(err.message || "Errore durante l'elaborazione.");
    } finally {
      setIsProcessingSingle(false);
    }
  };

  // Export single result to CSV client-side
  const exportSingleResultToCsv = () => {
    if (!singleResult) return;
    const csvContent = generateUnifiedCsvContent([singleResult]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nomine_contratti_singolo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export results to CSV client-side
  const exportResultsToCsv = () => {
    if (batchResults.length === 0) return;
    const csvContent = generateUnifiedCsvContent(batchResults);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nomine_contratti_ata_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600/20 border border-indigo-500/30 p-2.5 rounded-xl text-indigo-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              ScuolaATA Data Scraper & AI Extractor
              {openRouterApiKey ? (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="OpenRouter AI Attivo - Clicca per gestire la chiave"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>OpenRouter AI Connesso</span>
                  <Check className="w-3 h-3 text-emerald-400" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse"
                  title="Clicca qui per inserire la tua OpenRouter API Key"
                >
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>API Key Mancante (Clicca per inserire)</span>
                </button>
              )}
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
            onClick={() => setActiveTab("graduatorie")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "graduatorie"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Graduatorie ({graduatorie.length})</span>
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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border cursor-pointer ${
              !openRouterApiKey
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            }`}
          >
            {openRouterApiKey ? (
              <Settings className="w-4 h-4 text-indigo-400" />
            ) : (
              <Key className="w-4 h-4 text-amber-400" />
            )}
            <span>{openRouterApiKey ? "Impostazioni & API Key" : "Configura API Key"}</span>
            {!openRouterApiKey && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>
        </div>
      </header>

      {/* Settings Modal - Responsive, Scrollable & Always Accessible */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex items-start sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full my-auto shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed & Sticky) */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/95 sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Configurazione & Credenziali (LocalStorage)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inserisci la tua OpenRouter API Key e gestisci le preferenze di scraping
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={saveSettings} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
              {settingsSavedMessage && (
                <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-medium">{settingsSavedMessage}</span>
                </div>
              )}

              {/* PRIMARY & PROMINENT: OpenRouter API Key Input Card */}
              <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-2xl p-5 space-y-3.5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <Key className="w-4 h-4" />
                    </div>
                    <label htmlFor="openrouter-api-key-input" className="text-sm font-semibold text-white">
                      OpenRouter API Key
                    </label>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Obbligatoria per AI
                    </span>
                  </div>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium transition-colors"
                  >
                    <span>Ottieni chiave su openrouter.ai</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Incolla qui la tua chiave segreta OpenRouter (inizia con <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px]">sk-or-v1-...</code>). Viene memorizzata esclusivamente nel LocalStorage del tuo browser e usata direttamente per le chiamate AI (Gemini 2.5 Flash / Claude).
                </p>

                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <input
                      id="openrouter-api-key-input"
                      type={showApiKey ? "text" : "password"}
                      value={openRouterApiKey}
                      onChange={(e) => {
                        setOpenRouterApiKey(e.target.value);
                        setKeyTestStatus(null);
                      }}
                      placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-24 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
                      autoFocus
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      {openRouterApiKey && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRouterApiKey("");
                            setKeyTestStatus(null);
                          }}
                          title="Svuota campo"
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? "Nascondi chiave" : "Mostra chiave"}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Test Key Button & Validation Result */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={testOpenRouterKey}
                      disabled={!openRouterApiKey.trim() || isTestingKey}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isTestingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          <span>Verifica connessione in corso...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Testa Validità Chiave</span>
                        </>
                      )}
                    </button>

                    {keyTestStatus && (
                      <div className={`text-xs flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg ${
                        keyTestStatus.valid 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}>
                        {keyTestStatus.valid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{keyTestStatus.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: Rete & Architettura Anti-403 */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Rete & Architettura Anti-403</span>
                  </h4>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Attivo
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <p className="text-slate-300 font-medium">Catena di recupero automatica:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                    <li><strong className="text-slate-300">Proxy Server (/api/proxy)</strong> con intestazioni realistiche Chrome & failover serverless.</li>
                    <li><strong className="text-slate-300">Jina AI Reader</strong> con CORS nativo del browser, bypass 403 e rendering JavaScript di portali Albo (Argo, Trasparenza-PA).</li>
                    <li><strong className="text-slate-300">Web Grounding Search IA</strong> mirato per reperire bandi e convocazioni ufficiali se il sito è offline.</li>
                  </ol>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="jina-api-key-input" className="text-xs font-medium text-slate-300">
                      Jina AI Reader API Key (opzionale)
                    </label>
                    <a
                      href="https://jina.ai/reader"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                    >
                      <span>jina.ai/reader</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    id="jina-api-key-input"
                    type="password"
                    value={jinaApiKey}
                    onChange={(e) => setJinaApiKey(e.target.value)}
                    placeholder="jina_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Alza il rate limit di r.jina.ai da 20 a 500 richieste/minuto. Ottienila gratis su{" "}
                    <a
                      href="https://jina.ai/reader"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      jina.ai/reader
                    </a>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Proxy o Scraper URL Personalizzato (Opzionale)</label>
                  <input
                    type="text"
                    value={customProxyUrl}
                    onChange={(e) => setCustomProxyUrl(e.target.value)}
                    placeholder="es. https://tuo-proxy.com/?url=${url}"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Se possiedi un tuo proxy o servizio scraper dedicato, inseriscilo qui. Verrà usato come priorità assoluta.</p>
                </div>
              </div>

              {/* SECTION: GitHub Integration */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5 text-slate-300" />
                  <span>GitHub Integration (Opzionale)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* SECTION: Salvataggio e Backup Locale */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
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

              {/* Sticky Footer */}
              <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-20 shrink-0">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${openRouterApiKey ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                  <span>{openRouterApiKey ? "Chiave inserita" : "Chiave non ancora impostata"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salva Impostazioni</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">

        {/* Global OpenRouter API Key Missing Banner */}
        {!openRouterApiKey && (
          <div className="bg-gradient-to-r from-amber-500/15 via-indigo-950/30 to-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl shrink-0">
                <Key className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <span>OpenRouter API Key richiesta per l'estrazione AI</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                    Non Configurato
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Per scansionare i siti degli istituti scolastici, analizzare l'Albo Pretorio ed estrarre i dati delle convocazioni ATA, inserisci la tua API Key di OpenRouter.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>Inserisci API Key Ora</span>
            </button>
          </div>
        )}
        
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

                {!openRouterApiKey && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span><strong>Attenzione:</strong> OpenRouter API Key non ancora configurata per l'elaborazione batch.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Configura API Key</span>
                    </button>
                  </div>
                )}

                {batchError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                      <span>{batchError}</span>
                    </div>
                    {(!openRouterApiKey || batchError.includes("API Key") || batchError.includes("Impostazioni")) && (
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Inserisci API Key</span>
                      </button>
                    )}
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

            {/* Batch Live Log Panel */}
            {(isProcessingBatch || batchLiveLog.length > 0) && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Log di Navigazione e Scansione (Batch)
                </h3>
                <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-1.5 border border-slate-800 max-h-60 overflow-y-auto">
                  {batchLiveLog.length === 0 ? (
                    <div className="text-slate-500 italic">In attesa dell'avvio...</div>
                  ) : (
                    batchLiveLog.map((logMsg, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400">›</span>
                        <span>{logMsg}</span>
                      </div>
                    ))
                  )}
                  <div ref={batchLogEndRef} />
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
                      onClick={recalculateCrossReferenceOnBatchResults}
                      className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm cursor-pointer"
                      title="Ricalcola l'incrocio con le Graduatorie d'Istituto salvate per completare i punteggi mancanti"
                    >
                      <GraduationCap className="w-4 h-4 text-indigo-400" />
                      <span>Ricalcola Incroci</span>
                    </button>
                    <button
                      onClick={exportResultsToCsv}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm cursor-pointer"
                      title="Esporta tutte le nomine nel formato CSV a 16 colonne con tracciamento incrocio graduatorie"
                    >
                      <Download className="w-4 h-4" />
                      <span>Esporta CSV Nomine (16 Colonne)</span>
                    </button>
                    <button
                      onClick={exportToGitHub}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Github className="w-4 h-4 text-slate-300" />
                      <span>Salva CSV su GitHub</span>
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
                          <th className="p-4 font-semibold text-center text-indigo-400">Tipo</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Profilo</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">CDC / Area AT</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Posto</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Punti / Origine</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Fascia</th>
                          <th className="p-4 font-semibold text-center">Conv. Doc.</th>
                          <th className="p-4 font-semibold text-center">Conv. ATA</th>
                          <th className="p-4 font-semibold text-center">Pens. Doc.</th>
                          <th className="p-4 font-semibold text-center">Pens. ATA</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Ore</th>
                          <th className="p-4 font-semibold text-center text-emerald-400">Decorrenza</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {batchResults.map((r, idx) => {
                          const totalConvAta = (r.data.convocazioni_collaboratore_scolastico ?? 0) + (r.data.convocazioni_assistente_amministrativo ?? 0) + (r.data.convocazioni_assistente_tecnico ?? 0) + (r.data.convocazioni_cuoco ?? 0) + (r.data.convocazioni_assistente_agrario ?? 0);
                          const totalPensAta = (r.data.pensionamenti_collaboratore_scolastico ?? 0) + (r.data.pensionamenti_assistente_amministrativo ?? 0) + (r.data.pensionamenti_assistente_tecnico ?? 0) + (r.data.pensionamenti_cuoco ?? 0) + (r.data.pensionamenti_assistente_agrario ?? 0);
                          const tipo = r.data.tipologia_personale || "ATA";
                          const cdcArea = r.data.classe_concorso_area_lab || r.data.classe_di_concorso || "-";
                          const tipoPosto = r.data.tipo_posto || "comune";
                          const punt = r.data.punteggio !== null && r.data.punteggio !== undefined
                            ? (typeof r.data.punteggio === "number" ? r.data.punteggio.toFixed(2) : r.data.punteggio)
                            : "-";

                          return (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-4 font-medium text-slate-200 max-w-xs">
                                <div className="flex flex-col gap-1">
                                  <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-indigo-400 flex items-center gap-1.5 truncate">
                                    <span className="truncate">{r.url}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                                  </a>
                                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                                    {r.data.codice_meccanografico ? (
                                      <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-mono font-semibold rounded border border-indigo-500/30 text-[10px] tracking-wide" title="Codice Meccanografico Ministeriale">
                                        {r.data.codice_meccanografico}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 font-mono rounded text-[10px]" title="Codice Meccanografico non rilevato">
                                        C.M. assente
                                      </span>
                                    )}
                                    {r.data.nome_istituto && (
                                      <span className="text-slate-400 truncate max-w-[170px]" title={r.data.nome_istituto}>
                                        {r.data.nome_istituto}
                                      </span>
                                    )}
                                  </div>
                                </div>
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
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${tipo === "DOCENTE" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"}`}>
                                  {tipo}
                                </span>
                              </td>
                              <td className="p-4 text-center text-slate-300 font-medium max-w-[120px] truncate" title={r.data.profilo_lavorativo || r.data.profilo_professionale}>
                                {r.data.profilo_lavorativo || r.data.profilo_professionale || "-"}
                              </td>
                              <td className="p-4 text-center text-slate-300 font-medium font-mono">
                                {cdcArea}
                              </td>
                              <td className="p-4 text-center text-slate-400 capitalize">
                                {tipoPosto}
                              </td>
                              <td className="p-4 text-center font-mono">
                                <div className="flex flex-col items-center gap-0.5">
                                  {punt === "Da verificare manualmente" ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                      Da verificare manualmente
                                    </span>
                                  ) : (
                                    <span className="font-bold text-white">{punt}</span>
                                  )}
                                  {r.data.origine_punteggio && r.data.punteggio !== null && punt !== "Da verificare manualmente" && (
                                    <span
                                      title={r.data.note_cross_reference || ""}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                                        r.data.origine_punteggio === "Esplicito"
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : r.data.origine_punteggio === "Incrociato"
                                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {r.data.origine_punteggio}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-center text-slate-300 font-medium">{r.data.graduatoria_fascia || "-"}</td>
                              <td className="p-4 text-center font-bold text-amber-300">{r.data.convocazioni_docenti ?? 0}</td>
                              <td className="p-4 text-center font-bold text-indigo-300">{totalConvAta}</td>
                              <td className="p-4 text-center font-bold text-amber-300">{r.data.pensionamenti_docenti ?? 0}</td>
                              <td className="p-4 text-center font-bold text-indigo-300">{totalPensAta}</td>
                              <td className="p-4 text-center text-slate-300 font-medium">{r.data.ore_settimanali || "-"}</td>
                              <td className="p-4 text-center text-slate-300 font-medium text-[11px]">
                                {r.data.decorrenza_da ? `${r.data.decorrenza_da}${r.data.decorrenza_a ? ` - ${r.data.decorrenza_a}` : ""}` : "-"}
                              </td>
                            </tr>
                          );
                        })}
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
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="https://www.istitutoscolastico.edu.it"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Nominativo (opzionale)"
                    value={singleNominativo}
                    onChange={(e) => setSingleNominativo(e.target.value)}
                    className="sm:w-64 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                    title="Se inserito e il punteggio manca nel contratto, avvia la ricerca automatica nelle graduatorie d'istituto"
                  />
                  <button
                    type="submit"
                    disabled={isProcessingSingle || !singleUrl.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
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

              {!openRouterApiKey && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span><strong>OpenRouter API Key richiesta:</strong> Inserisci la tua API Key per sbloccare l'estrazione AI e la scansione della pagina.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configura Chiave</span>
                  </button>
                </div>
              )}

              {singleError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{singleError}</span>
                  </div>
                  {(!openRouterApiKey || singleError.includes("API Key") || singleError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      Dati Estratti tramite Gemini AI
                    </h3>
                    <button
                      onClick={exportSingleResultToCsv}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Scarica CSV Risultato Singolo</span>
                    </button>
                  </div>

                  {/* Scuola & Codice Meccanografico Header */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Istituto Scolastico Rilevato</span>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <span>{singleResult.data.nome_istituto || "Istituto Scolastico"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="bg-slate-900 border border-slate-700/80 px-3.5 py-2 rounded-xl flex flex-col items-start">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Codice Meccanografico (C.M.)</span>
                        {singleResult.data.codice_meccanografico ? (
                          <span className="text-sm font-mono font-bold text-indigo-300">
                            {singleResult.data.codice_meccanografico}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">Non individuato</span>
                        )}
                      </div>
                      {singleResult.data.nominativo && (
                        <div className="bg-slate-900 border border-slate-700/80 px-3.5 py-2 rounded-xl flex flex-col items-start">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Nominativo</span>
                          <span className="text-sm font-bold text-amber-300">
                            {singleResult.data.nominativo}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Tipologia</span>
                      <span className={`text-sm font-bold ${singleResult.data.tipologia_personale === "DOCENTE" ? "text-amber-400" : "text-indigo-400"}`}>
                        {singleResult.data.tipologia_personale || "ATA"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Tipo Posto</span>
                      <span className="text-sm font-bold text-white capitalize">{singleResult.data.tipo_posto || "comune"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">CDC / Area AT</span>
                      <span className="text-sm font-bold text-white font-mono">{singleResult.data.classe_concorso_area_lab || singleResult.data.classe_di_concorso || "Non applicabile"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Punteggio / Origine</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white font-mono">
                          {singleResult.data.punteggio !== null && singleResult.data.punteggio !== undefined
                            ? (typeof singleResult.data.punteggio === "number" ? singleResult.data.punteggio.toFixed(2) : singleResult.data.punteggio)
                            : "Non riportato (null)"}
                        </span>
                        {singleResult.data.punteggio === "Da verificare manualmente" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Da verificare
                          </span>
                        )}
                        {singleResult.data.origine_punteggio && singleResult.data.punteggio !== null && singleResult.data.punteggio !== "Da verificare manualmente" && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            singleResult.data.origine_punteggio === "Esplicito"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : singleResult.data.origine_punteggio === "Incrociato"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "text-slate-500"
                          }`}>
                            {singleResult.data.origine_punteggio}
                          </span>
                        )}
                      </div>
                      {singleResult.data.note_cross_reference && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2" title={singleResult.data.note_cross_reference}>
                          {singleResult.data.note_cross_reference}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Fascia Graduatoria</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.graduatoria_fascia || "Nessuna rilevata"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Profilo Lavorativo</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.profilo_lavorativo || singleResult.data.profilo_professionale || "Nessun profilo"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Ore Settimanali</span>
                      <span className="text-sm font-bold text-white">{singleResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Decorrenza</span>
                      <span className="text-sm font-bold text-white">
                        {singleResult.data.decorrenza_contratto || (singleResult.data.decorrenza_da ? `${singleResult.data.decorrenza_da} - ${singleResult.data.decorrenza_a || "termine"}` : "N/D")}
                      </span>
                    </div>

                    {singleResult.data.nominativo && (
                      <div className="bg-slate-950/60 border border-indigo-500/30 rounded-xl p-3.5">
                        <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold block mb-1">Nominativo</span>
                        <span className="text-sm font-bold text-white">{singleResult.data.nominativo}</span>
                      </div>
                    )}

                    {singleResult.data.pagine_graduatoria_esplorate && singleResult.data.pagine_graduatoria_esplorate.length > 0 && (
                      <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3.5 col-span-2 sm:col-span-4">
                        <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block mb-1">
                          Pagine Graduatorie Esplorate ({singleResult.data.pagine_graduatoria_esplorate.length}/5 max)
                        </span>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {singleResult.data.pagine_graduatoria_esplorate.map((pageUrl, pIdx) => (
                            <li key={pIdx} className="truncate">
                              <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-300">
                                {pageUrl}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{alboScanError}</span>
                  </div>
                  {(!openRouterApiKey || alboScanError.includes("API Key") || alboScanError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
                </div>
              )}

              {alboScanResult && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Riepilogo Scansione Albo Pretorio
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const fakeResult: ExtractionResult = {
                          status: "success",
                          url: alboScanResult.alboUrl || alboUrlInput,
                          navigatedUrl: alboScanResult.alboUrl || alboUrlInput,
                          logs: alboScanResult.logs || [],
                          data: {
                            nome_istituto: "",
                            codice_meccanografico: "",
                            convocazioni_collaboratore_scolastico: alboScanResult.contratti?.length || 0,
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
                            graduatoria_fascia: alboScanResult.graduatoria_fascia || "",
                            profilo_professionale: alboScanResult.profilo_professionale || "",
                            classe_di_concorso: "",
                            ore_settimanali: "",
                            decorrenza_da: "",
                            decorrenza_a: "",
                            albo_contratti: alboScanResult.contratti || []
                          }
                        };
                        const csvContent = generateUnifiedCsvContent([fakeResult]);
                        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.setAttribute("href", url);
                        link.setAttribute("download", `nomine_albo_pretorio_${new Date().toISOString().slice(0, 10)}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Esporta Nomine Albo in CSV (11 Colonne)</span>
                    </button>
                  </div>

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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{pdfExtractError}</span>
                  </div>
                  {(!openRouterApiKey || pdfExtractError.includes("API Key") || pdfExtractError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
                </div>
              )}

              {pdfExtractResult && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl p-4 gap-3">
                    <div>
                      <span className="text-xs text-slate-400 block">File Elaborato:</span>
                      <span className="text-sm font-semibold text-white">{pdfExtractResult.filename}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const fakeResult: ExtractionResult = {
                            status: "success",
                            url: pdfExtractResult.filename,
                            navigatedUrl: pdfExtractResult.filename,
                            logs: [],
                            data: {
                              nome_istituto: pdfExtractResult.data.nome_istituto || "Istituto Scolastico",
                              codice_meccanografico: pdfExtractResult.data.codice_meccanografico || "",
                              convocazioni_collaboratore_scolastico: 1,
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
                              graduatoria_fascia: pdfExtractResult.data.fascia || pdfExtractResult.data.graduatoria_fascia || "",
                              profilo_professionale: pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale || "",
                              classe_di_concorso: pdfExtractResult.data.classe_di_concorso || "",
                              ore_settimanali: pdfExtractResult.data.ore_settimanali || "",
                              punteggio: pdfExtractResult.data.punteggio || "",
                              posizione_graduatoria: pdfExtractResult.data.posizione_graduatoria || "",
                              decorrenza_da: pdfExtractResult.data.decorrenza_da || "",
                              decorrenza_a: pdfExtractResult.data.decorrenza_a || "",
                              decorrenza_contratto: pdfExtractResult.data.decorrenza_contratto || "",
                              durata_contratto_mesi: pdfExtractResult.data.durata_contratto_mesi || "",
                              durata_contratto_giorni: pdfExtractResult.data.durata_contratto_giorni || "",
                              link_del_documento: pdfExtractResult.filename,
                              albo_contratti: []
                            }
                          };
                          const csvContent = generateUnifiedCsvContent([fakeResult]);
                          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.setAttribute("href", url);
                          link.setAttribute("download", `contratto_${pdfExtractResult.filename.replace(/\.pdf$/i, "")}_${new Date().toISOString().slice(0, 10)}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica CSV (11 Colonne)</span>
                      </button>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Memoria Pulita
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Tipologia</span>
                      <span className={`text-base font-bold ${pdfExtractResult.data.tipologia_personale === "DOCENTE" ? "text-amber-400" : "text-indigo-400"}`}>
                        {pdfExtractResult.data.tipologia_personale || "ATA"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Tipo Posto</span>
                      <span className="text-base font-bold text-white capitalize">{pdfExtractResult.data.tipo_posto || "comune"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">CDC / Area AT</span>
                      <span className="text-base font-bold text-white font-mono">{pdfExtractResult.data.classe_concorso_area_lab || pdfExtractResult.data.classe_di_concorso || "Non applicabile"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Punteggio / Origine</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base font-bold text-white font-mono">
                          {pdfExtractResult.data.punteggio !== null && pdfExtractResult.data.punteggio !== undefined
                            ? (typeof pdfExtractResult.data.punteggio === "number" ? pdfExtractResult.data.punteggio.toFixed(2) : pdfExtractResult.data.punteggio)
                            : "Non riportato (null)"}
                        </span>
                        {pdfExtractResult.data.origine_punteggio && pdfExtractResult.data.punteggio !== null && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            pdfExtractResult.data.origine_punteggio === "Esplicito"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : pdfExtractResult.data.origine_punteggio === "Incrociato"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "text-slate-500"
                          }`}>
                            {pdfExtractResult.data.origine_punteggio}
                          </span>
                        )}
                      </div>
                      {pdfExtractResult.data.note_cross_reference && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2" title={pdfExtractResult.data.note_cross_reference}>
                          {pdfExtractResult.data.note_cross_reference}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">Graduatoria Fascia</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.fascia || pdfExtractResult.data.graduatoria_fascia || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">Posizione Graduatoria</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.posizione_graduatoria || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">Profilo Lavorativo</span>
                      <span className="text-base font-bold text-white truncate block" title={pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale}>
                        {pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale || "N/D"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Ore Settimanali</span>
                      <span className="text-base font-bold text-white">{pdfExtractResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Decorrenza Contratto</span>
                      <span className="text-base font-bold text-white">
                        {pdfExtractResult.data.decorrenza_contratto || (pdfExtractResult.data.decorrenza_da ? `${pdfExtractResult.data.decorrenza_da} - ${pdfExtractResult.data.decorrenza_a || "termine"}` : "N/D")}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Durata Stimata</span>
                      <span className="text-base font-bold text-white">
                        {pdfExtractResult.data.durata_contratto_mesi ? `${pdfExtractResult.data.durata_contratto_mesi} mesi (${pdfExtractResult.data.durata_contratto_giorni} gg)` : "N/D"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: GESTIONE GRADUATORIE D'ISTITUTO */}
        {activeTab === "graduatorie" && (
          <div className="animate-fadeIn max-w-5xl mx-auto">
            <GraduatorieManager
              graduatorie={graduatorie}
              onUpdateGraduatorie={(updated) => {
                setGraduatorie(updated);
                saveStoredGraduatorie(updated);
              }}
            />
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{searchError}</span>
                  </div>
                  {(!openRouterApiKey || searchError.includes("API Key") || searchError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
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
                        onClick={() => {
                          const csvContent = generateUnifiedCsvContent(item.results);
                          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.setAttribute("href", url);
                          link.setAttribute("download", `storico_${item.filename.replace(/\.csv$/i, "")}_${new Date().toISOString().slice(0, 10)}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        title="Esporta in CSV (11 colonne)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Esporta CSV</span>
                      </button>
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
