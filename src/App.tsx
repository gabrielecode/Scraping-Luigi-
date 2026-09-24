import React, { useState, useEffect } from "react";
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
  AlertTriangle,
  Sun,
  Moon
} from "lucide-react";
import { ExtractionResult, ExtractionData, BatchHistoryItem, NominaContrattoItem, GraduatoriaIstituto, OriginePunteggio } from "./types";
import { GraduatorieManager } from "./components/GraduatorieManager";
import {
  getStoredGraduatorie,
  saveStoredGraduatorie,
  crossReferenceNomina,
  searchGraduatoriaPages,
  resolveFromGraduatorie,
  buildGraduatoriaUserPrompt,
  GRADUATORIA_EXTRACTION_SYSTEM_PROMPT,
  extractGraduatoriaWithRetry,
  prefilterGraduatoriaText,
  isNameMatch,
  isClassMatch,
  isValidCodiceMeccanografico,
  extractCodiceMeccanograficoFromText,
  normalizeCodiceMeccanografico,
  safeDecodeURIComponent,
  escapeCsvField,
  cleanFieldString,
  formatCsvCodiceMeccanografico,
  resolveValidDocumentLink,
  isClasseConcorsoPertinent,
  standardizePlaceholder,
} from "./services/graduatorieService";
import {
  extractTextFromPdfBuffer,
  extractPdfsFromHtml,
  extractPunteggioHeuristic,
} from "./services/pdfService";

export { GRADUATORIA_EXTRACTION_SYSTEM_PROMPT };

export default function App() {
  const [activeTab, setActiveTab] = useState<"batch" | "single" | "albo" | "search" | "history" | "guide" | "graduatorie">("batch");
  const [graduatorie, setGraduatorie] = useState<GraduatoriaIstituto[]>(() => getStoredGraduatorie());
  const [singleNominativo, setSingleNominativo] = useState("");
  
  // Theme state (Dark / Light) with LocalStorage and system preference support
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("scuola_theme");
      if (saved === "light" || saved === "dark") return saved;
      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (theme === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
      }
      localStorage.setItem("scuola_theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };
  
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

  // Export local backup (JSON) - esclude credenziali e token sensibili (openRouterApiKey, jinaApiKey, githubPat)
  const exportLocalBackup = () => {
    const backupData = {
      version: 1,
      timestamp: new Date().toISOString(),
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

  // Import local backup (JSON) - credenziali e API key non vengono reimportate
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
   - Se menzionato nell'URL (es. "chic81000a.edu.it") o nel nome del file, estrailo como codice meccanografico ufficiale.
3. CONTEGGIO GENERALE:
   - "convocazioni_collaboratore_scolastico", "convocazioni_assistente_amministrativo", "convocazioni_docenti", "convocazioni_assistente_tecnico", "convocazioni_cuoco", "convocazioni_assistente_agrario" (numero)
   - "pensionamenti_collaboratore_scolastico", "pensionamenti_assistente_amministrativo", "pensionamenti_docenti", "pensionamenti_assistente_tecnico", "pensionamenti_cuoco", "pensionamenti_assistente_agrario" (numero)
4. "nomine_contratti": ELENCO COMPLETO di TUTTE le singole nomine / contratti di supplenza / atti di assegnazione posti / convocazioni individuati nel documento (una voce per ciascuna nomina/assegnazione o convocazione di profilo).
   Per ciascuna voce specifica i seguenti campi:
   - "nominativo": nome e cognome del candidato o lavoratore nominato/individuato (es. "MARIO ROSSI"), se indicato. Se si tratta di un avviso o bando aperto senza nominativi di singoli candidati, lascia stringa vuota "".
   - "tipologia_personale": "ATA" per profili ATA (Collaboratore scolastico, Assistente Amministrativo, Assistente Tecnico, Cuoco, Guardarobiere, Operatore Scolastico, ecc.) oppure "DOCENTE" per insegnanti (Scuola Infanzia, Primaria, Secondaria I grado, Secondaria II grado, ITP, ecc.).
   - "profilo_lavorativo": profilo completo e tipologia (es. "Collaboratore scolastico TD", "Assistente Amministrativo TD", "Assistente Tecnico AR02 - Elettronica", "Docente secondaria II grado A-22 - Lettere", "Docente Primaria posto comune", "Docente Sostegno secondaria I grado ADMM").
   - "classe_concorso_area_lab": per il personale DOCENTE indica la Classe di Concorso CDC ufficiale (es. "A-12", "A-22", "A-28", "A-48", "ADMM", "ADSS", "ADAA", "ADEE", "AAAA", "EEEE"); per Assistente Tecnico ATA indica l'Area di Laboratorio (es. "AR01", "AR02", "AR08", "AR20"); per gli altri profili ATA dove non applicabile scrivi "Non applicabile".
   - "tipo_posto": "comune" per posti ordinari/curricolari e ATA; "sostegno" per posti di sostegno / minorati psicofisici / uditivi / vista / cattedre sostegno ADAA/ADEE/ADMM/ADSS.
   - "punteggio": NUMERO FLOAT DECIMALE (es. 13.17, 11.25, 19.80, 54.5, 112.0) OPPURE null.
     ⚠️ ISTRUZIONI CRITICHE SULL'ESTRAZIONE DEI PUNTEGGI ATA E DOCENTE:
     - "punteggio" deve contenere SOLO ED ESCLUSIVAMENTE IL PUNTEGGIO REALE DEL CANDIDATO (es. punteggio individuale conseguito dal lavoratore/candidato in graduatoria o nel bando o nel contratto di supplenza).
     - SE C'È UN CANDIDATO O LAVORATORE SPECIFICO CON UN PUNTEGGIO (es. "Musella Isabella con punteggio 11,25" o "Mario Rossi punti 13,00"), QUESTO È IL SUO PUNTEGGIO INDIVIDUALE: ESTRAILO RIGOROSAMENTE come float decimale!
     - IMPORTANTE - LE SOGLIE DI CONVOCAZIONE NON VANNO IN PUNTEGGIO: formule generiche come "fino a punteggio 12", "fino a punti 11", "da punti X a punti Y" che NON si riferiscono a un candidato specifico bensì a un limite del bando NON sono il punteggio del candidato e NON devono essere inserite nel campo "punteggio" (in quel caso se non vi sono candidati con punteggi individuali metti null).
     - Nelle graduatorie, bollettini o elenchi con tabelle (es. colonna PUNTI, PT, PUNTEGGIO, VALUTAZIONE), estrai per ogni candidato il proprio punteggio individuale.
     - Converti sempre le virgole in punto decimale (es. "11,25" -> 11.25, "13,17" -> 13.17, "69,50" -> 69.5).
     - Se manca il punteggio individuale reale del candidato/lavoratore, imposta sempre "punteggio": null.
   - "posizione_graduatoria": posizione numerica in graduatoria (es. "1", "15", "301", "313"). Cercala accanto a "posizione", "pos.", "posto", "n.", "collocato al n.". Se assente lascia stringa vuota o "Non disponibile".
   - "fascia": fascia della graduatoria (es. "Terza fascia", "Seconda fascia", "Prima fascia", "Graduatoria d'Istituto", "Graduatoria permanente 24 mesi", "Interpello"). Standardizza "III", "III fascia", "3 fascia", "3^ fascia" -> "Terza fascia"; "II", "II fascia", "2^ fascia" -> "Seconda fascia"; "I", "I fascia", "1^ fascia" -> "Prima fascia". Se non specificata scrivi "Non disponibile".
   - "ore_settimanali": orario di cattedra/servizio (es. "36 ore", "18 ore", "12 ore", "7 ore"). Se non menzionato scrivi ESATTAMENTE "Non disponibile".
   - "decorrenza_contratto": intervallo esatto delle date di contratto nel formato "GG/MM/AAAA - GG/MM/AAAA" (es. "09/09/2026 - 30/06/2027", "14/09/2026 - 31/08/2027", "03/09/2026 - fine esigenze").
   - "link_del_documento": URL dell'atto o documento di riferimento (se reperito nel testo, altrimenti stringa vuota).

⚠️ ESEMPIO IMPORTANTE DI ESTRAZIONE ATA:
Se il testo recita 'La Collaboratrice Scolastica MUSELLA ISABELLA collocata in posizione 301 con punteggio 11,25 nella III fascia delle Graduatorie d’Istituto del Personale ATA, con contratto dal 14/09/2026 al 31/08/2027', devi estrarre nel JSON:
- "nominativo": "MUSELLA ISABELLA"
- "tipologia_personale": "ATA"
- "profilo_lavorativo": "Collaboratore scolastico TD"
- "punteggio": 11.25 (convertito in float decimale con punto!)
- "posizione_graduatoria": "301"
- "fascia": "Terza fascia"
- "decorrenza_contratto": "14/09/2026 - 31/08/2027"

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
      "nominativo": stringa,
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
  "nominativo": stringa,
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

  const PDF_EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di contratti scolastici di supplenza, delibere di nomina, graduatorie, bollettini delle assegnazioni, avvisi di convocazione e interpelli per il personale ATA e DOCENTI delle scuole italiane.
Analizza il documento PDF con la massima accuratezza ed estrai tutti i dati richiesti.

CAMPI DA ESTRARRE:
- "nome_istituto": denominazione della scuola (es. "IC Ripa Teatina–Miglianico").
- "codice_meccanografico": codice meccanografico della scuola statale (es. "CHIC81000A", "MIPC01000C").
  ⚠️ RICERCA DEL CODICE MECCANOGRAFICO:
  - Formato: 10 caratteri alfanumerici (2 lettere provincia + 2 lettere tipo scuola + 5 cifre + 1 lettera controllo).
  - Cerca nell'intestazione/carta intestata, accanto a "C.M.", "Cod. Mecc.", "Codice Scuola", "C.F.", nel piè di pagina o timbro.
  - Cerca anche nelle caselle di posta: es. "chic81000a@istruzione.it" o "@pec.istruzione.it" -> codice: "CHIC81000A".
- "nominativo": nome e cognome del candidato o lavoratore individuato/nominato (es. "MARIO ROSSI"), se presente. Se l'atto è un bando aperto senza nominativi individuali, lascia stringa vuota "".
- "tipologia_personale": "ATA" oppure "DOCENTE".
- "profilo_lavorativo": profilo completo e tipologia (es. "Collaboratore scolastico TD", "Assistente Amministrativo TD", "Assistente Tecnico Area Laboratorio AR02", "Docente secondaria II grado posto comune TD", "Docente sostegno secondaria I grado ADMM").
- "classe_concorso_area_lab": per il personale DOCENTE il codice della Classe di Concorso CDC (es. "A-12", "A-22", "A-28", "ADMM", "ADSS", "EEEE", "AAAA"); per Assistente Tecnico ATA il codice Area di Laboratorio (es. "AR01", "AR02", "AR08", "AR20"); per gli altri profili ATA dove non applicabile scrivi "Non applicabile".
- "tipo_posto": "comune" per posti ordinari/curricolari e ATA; "sostegno" per posti e cattedre di sostegno / minorati psicofisici / uditivi / della vista / ADAA / ADEE / ADMM / ADSS.
- "punteggio": punteggio numerico float con punto decimale (es. 13.17, 11.25, 19.80, 54.5, 112.0) OPPURE null.
  ⚠️ ISTRUZIONI CRITICHE SULL'ESTRAZIONE DEI PUNTEGGI ATA E DOCENTE:
  - "punteggio" deve contenere SOLO ED ESCLUSIVAMENTE IL PUNTEGGIO REALE DEL CANDIDATO (es. punteggio individuale in graduatoria o nel contratto).
  - SE UN ATA O UN DOCENTE È NOMINATO CON UN PUNTEGGIO (es. "MUSELLA ISABELLA... con punteggio 11,25" o "Mario Rossi punti 13.00"), QUESTO È IL SUO PUNTEGGIO INDIVIDUALE E DEVE ESSERE RIGOROSAMENTE ESTRATTO come float decimale!
  - IMPORTANTE - LE SOGLIE DI CONVOCAZIONE NON VANNO IN PUNTEGGIO: formule come "fino a punteggio 12", "fino a punti 11", "da punti X a punti Y" NON sono il punteggio del candidato e NON devono essere inserite nel campo "punteggio". Se nel documento compare solo la soglia di convocazione senza il punteggio individuale del candidato, imposta "punteggio": null.
  - Nelle graduatorie o elenchi con tabella a colonne (es. colonna PUNTI, PT, PUNTEGGIO, VALUTAZIONE), estrai per ciascun candidato il suo punteggio individuale.
  - Converti sempre le virgole in punto decimale (es. "11,25" -> 11.25, "13,17" -> 13.17, "69,50" -> 69.5).
  - Se manca il punteggio individuale reale del lavoratore/candidato, imposta "punteggio": null.
- "posizione_graduatoria": posizione numerica in graduatoria (es. "1", "15", "301", "313"). Cercala accanto a "posizione", "pos.", "posto", "n.". Se assente scrivi "Non disponibile".
- "fascia": fascia di graduatoria (es. "Terza fascia", "Seconda fascia", "Prima fascia", "Graduatoria d'Istituto", "Graduatoria permanente 24 mesi", "Interpello"). Standardizza "III", "III fascia", "3 fascia", "3^ fascia" -> "Terza fascia"; "II", "II fascia", "2^ fascia" -> "Seconda fascia"; "I", "I fascia", "1^ fascia" -> "Prima fascia". Se assente scrivi "Non disponibile".
- "ore_settimanali": orario di servizio (es. "36 ore", "18 ore", "12 ore", "7 ore"). Se non indicato scrivi ESATTAMENTE "Non disponibile".
- "decorrenza_contratto": intervallo date contratto nel formato "GG/MM/AAAA - GG/MM/AAAA" (es. "09/09/2026 - 30/06/2027", "14/09/2026 - 31/08/2027"). Se presenti singole date "da" e "a", componi l'intervallo.
- "nomine_contratti": se il PDF contiene più nomine, assegnazioni o convocazioni distinte (es. tabella o elenco di candidati/posti), includile tutte in questo array rispettando la struttura sopra.

⚠️ ESEMPIO IMPORTANTE DI ESTRAZIONE ATA:
Se il testo recita 'La Collaboratrice Scolastica MUSELLA ISABELLA collocata in posizione 301 con punteggio 11,25 nella III fascia delle Graduatorie d’Istituto del Personale ATA, con contratto dal 14/09/2026 al 31/08/2027', devi estrarre nel JSON:
- "nominativo": "MUSELLA ISABELLA"
- "tipologia_personale": "ATA"
- "profilo_lavorativo": "Collaboratore scolastico TD"
- "punteggio": 11.25 (convertito in float decimale con punto!)
- "posizione_graduatoria": "301"
- "fascia": "Terza fascia"
- "decorrenza_contratto": "14/09/2026 - 31/08/2027"

Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "nome_istituto": stringa,
  "codice_meccanografico": stringa,
  "nominativo": stringa,
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
  "decorrenza_a": stringa,
  "nomine_contratti": [
    {
      "nominativo": stringa,
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
  ]
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
      formattedPeriod: formattedPeriod || "Non disponibile",
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
        lowerText.includes("albo-pretorio") ||
        lowerText.includes("albo-online") ||
        lowerText.includes("/albo/") ||
        lowerText.includes("bacheca") ||
        lowerText.includes("pubblicita legale") ||
        lowerText.includes("pubblicità legale")
      ) {
        priority = 10;
      } else if (
        lowerText.includes("trasparenza") || 
        lowerText.includes("amministrazione trasparente") || 
        lowerText.includes("amministrazione-trasparente") || 
        lowerText.includes("trasparenza-pa") ||
        lowerText.includes("amministrazionetrasparente")
      ) {
        priority = 5;
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
  failedProxiesByDomain?: Map<string, Set<string>>,
  maxPages = 20
) {
  // 1. Priorità assoluta: scarica il buffer binario ed estrai il testo localmente con pdfjs
  // Questo elimina ogni problema di compatibilità del plugin OpenRouter ed estrae tabelle e punteggi al 100%
  if (!isBase64) {
    try {
      const res = await fetchWithProxy(pdfSource, true, undefined, customProxyUrl, failedProxiesByDomain);
      if (res?.data) {
        const buf = res.data as ArrayBuffer;
        const { text: localPdfText } = await extractTextFromPdfBuffer(buf, maxPages);
        if (localPdfText && localPdfText.trim().length > 30) {
          const textRes = await extractWithOpenRouter(localPdfText, apiKey, promptText);
          if (textRes && !textRes.error && textRes.choices?.[0]?.message?.content) {
            return textRes;
          }
        }
      }
    } catch {}
  }

  // 2. Fallback tentativo con plugin nativo file-parser
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

function textContainsName(text: string, name: string): boolean {
  if (!text || !name) return false;
  const cleanText = text.toLowerCase();
  const cleanName = name.toLowerCase().trim();
  if (cleanText.includes(cleanName)) return true;

  // Split name into words (e.g., "Rossi Mario" -> ["rossi", "mario"])
  const words = cleanName.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    // Check if all words are present in the text
    return words.every(word => cleanText.includes(word));
  }
  return false;
}

async function scrapeWebsite(
  targetUrl: string,
  apiKey: string,
  systemPrompt?: string,
  customProxyUrl?: string,
  failedProxiesByDomain: Map<string, Set<string>> = new Map(),
  inputNominativo?: string
) {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
  };

  let currentUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
  log(`Avvio estrazione approfondita per: ${currentUrl}${inputNominativo ? ` (Cercando nominativo: ${inputNominativo})` : ""}`);

  let fullText = "";
  let navigatedUrl = currentUrl;
  let allTexts: string[] = [];

  try {
    // 1. Verifica se l'URL target è un file PDF diretto
    const isDirectPdf =
      currentUrl.toLowerCase().endsWith(".pdf") ||
      currentUrl.toLowerCase().includes(".pdf?") ||
      (currentUrl.toLowerCase().includes("/uploads/") && currentUrl.toLowerCase().includes(".pdf")) ||
      (currentUrl.toLowerCase().includes("/system/files/") && currentUrl.toLowerCase().includes(".pdf"));

    if (isDirectPdf) {
      log(`L'URL specificato è un documento PDF diretto: ${currentUrl}`);
      try {
        const pdfBufRes = await fetchWithProxy(currentUrl, true, log, customProxyUrl, failedProxiesByDomain);
        if (pdfBufRes?.data) {
          const { text: pdfText } = await extractTextFromPdfBuffer(pdfBufRes.data as ArrayBuffer);
          log(`Estratti ${pdfText.length} caratteri dal PDF diretto.`);
          allTexts.push(`=== DOCUMENTO PDF DIRETTO (${currentUrl}) ===\n${pdfText}`);
        }
      } catch (pdfDirErr: any) {
        log(`Errore estrazione PDF diretto: ${pdfDirErr.message}`);
      }
    } else {
      // 1. Download homepage / pagina principale
      const homeRes = await fetchWithProxy(currentUrl, false, log, customProxyUrl, failedProxiesByDomain);
      const rawHome = homeRes.data as string;
      let homeText = "";
      let homeDoc: Document | undefined;

      if (homeRes.format === "html") {
        homeDoc = parseHtml(rawHome);
        homeText = homeDoc.body?.textContent?.replace(/\s+/g, " ").trim() || "";

        // Estrai e analizza gli allegati PDF presenti direttamente nella pagina principale
        const mainPagePdfs = extractPdfsFromHtml(rawHome, currentUrl);
        if (mainPagePdfs.length > 0) {
          log(`Trovati ${mainPagePdfs.length} documenti/allegati nella pagina principale.`);
          const topMainPdfs = mainPagePdfs.slice(0, 4);
          for (const pdfItem of topMainPdfs) {
            log(`Analisi allegato: "${pdfItem.title}" (${pdfItem.url})`);
            try {
              const pBufRes = await fetchWithProxy(pdfItem.url, true, log, customProxyUrl, failedProxiesByDomain);
              if (pBufRes?.data) {
                const { text: pText } = await extractTextFromPdfBuffer(pBufRes.data as ArrayBuffer);
                if (pText && pText.trim().length > 30) {
                  log(`Estratti ${pText.length} caratteri da allegato "${pdfItem.title}"`);
                  
                  // Se stiamo cercando un nominativo specifico, filtra
                  if (inputNominativo && inputNominativo.trim()) {
                    if (textContainsName(pText, inputNominativo)) {
                      log(`🎯 Nominativo cercato "${inputNominativo}" individuato nell'allegato: ${pdfItem.url}`);
                      allTexts.push(`=== DOCUMENTO/GRADUATORIA ALLEGATA "${pdfItem.title}" (${pdfItem.url}) ===\n${pText}`);
                    } else {
                      log(`Filtro: nominativo "${inputNominativo}" non presente nell'allegato. Salto per salvare spazio.`);
                    }
                  } else {
                    allTexts.push(`=== DOCUMENTO/GRADUATORIA ALLEGATA "${pdfItem.title}" (${pdfItem.url}) ===\n${pText}`);
                  }
                }
              }
            } catch (pErr: any) {
              log(`Avviso lettura allegato ${pdfItem.title}: ${pErr.message}`);
            }
          }
        }
      } else {
        homeText = rawHome.replace(/[#*`_\[\]]/g, " ").replace(/\s+/g, " ").trim();
      }
      allTexts.push(`=== HOMEPAGE (${currentUrl}) ===\n${homeText}`);
      log(`Homepage analizzata (${homeText.length} caratteri estratti).`);

      // 2. Discover relevant sub-links (Albo Pretorio, Trasparenza)
      const discoveredLinks = findRelevantSchoolLinks(rawHome, currentUrl, homeDoc);
      log(`Trovati ${discoveredLinks.length} link di sezioni d'interesse (Albo Online / Amministrazione Trasparente).`);

      // Take top 5 highest priority links to crawl deeply
      const topLinksToFetch = discoveredLinks.slice(0, 5);
      for (const link of topLinksToFetch) {
        log(`Scansione approfondita sezione: "${link.title}" (${link.url})`);
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
                    if (ph) {
                      const lowerH = ph.toLowerCase();
                      const lowerT = (pa.textContent || pa.getAttribute("title") || "").toLowerCase();
                      
                      const isPdf = lowerH.endsWith(".pdf") || lowerH.includes(".pdf?") || lowerH.includes(".pdf/") ||
                                    lowerH.includes("download") || lowerH.includes("allegat") || lowerH.includes("attachment") ||
                                    lowerT.includes("pdf") || lowerT.includes("allegato") || lowerT.includes("scarica") || lowerT.includes("visualizza");
                      
                      const isExcluded = lowerH.endsWith(".zip") || lowerH.endsWith(".png") || lowerH.endsWith(".jpg") || lowerH.endsWith(".jpeg") || lowerH.endsWith(".doc") || lowerH.endsWith(".docx") || lowerH.endsWith(".xls") || lowerH.endsWith(".xlsx");

                      if (isPdf && !isExcluded) {
                        const pdfResolved = new URL(ph, act.url).href;
                        log(`Documento allegato trovato: ${pdfResolved}`);

                        // Estrai il testo completo del PDF dell'atto
                        try {
                          const actPdfBuf = await fetchWithProxy(pdfResolved, true, log, customProxyUrl, failedProxiesByDomain);
                          if (actPdfBuf?.data) {
                            const { text: actPdfText } = await extractTextFromPdfBuffer(actPdfBuf.data as ArrayBuffer);
                            if (actPdfText && actPdfText.trim().length > 30) {
                              log(`Estratti ${actPdfText.length} caratteri dal PDF dell'atto ${act.id}`);
                              
                              // Se stiamo cercando un nominativo specifico, verifichiamo se è presente
                              if (inputNominativo && inputNominativo.trim()) {
                                if (textContainsName(actPdfText, inputNominativo)) {
                                  log(`🎯 Nominativo cercato "${inputNominativo}" individuato nel PDF dell'atto: ${pdfResolved}`);
                                  allTexts.push(`=== ATTO ${act.id} TESTO PDF ALLEGATO (${pdfResolved}) ===\n${actPdfText}`);
                                } else {
                                  log(`Filtro: nominativo "${inputNominativo}" non presente nel PDF dell'atto. Salto.`);
                                }
                              } else {
                                allTexts.push(`=== ATTO ${act.id} TESTO PDF ALLEGATO (${pdfResolved}) ===\n${actPdfText}`);
                              }
                            }
                          }
                        } catch (actPdfErr: any) {
                          log(`Avviso lettura buffer PDF atto ${act.id}: ${actPdfErr.message}`);
                        }

                        allTexts.push(`=== PDF ALLEGATO (${pdfResolved}) ===\n[PDF URL: ${pdfResolved}]`);
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
    }

    fullText = allTexts.join("\n\n").substring(0, 150000);
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
    const res = await scrapeWebsite(targetUrl, apiKey, EXTRACTION_SYSTEM_PROMPT, customProxy, failedProxiesByDomain, inputNominativo);
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
    let extractionStatus: "success" | "error" = "success";
    let extractionError: string | undefined = undefined;
    try {
      const parsed = JSON.parse(res.content);
      extractedData = { ...defaultData, ...parsed };

      // PROMOZIONE DEI CAMPI DA NOMINE_CONTRATTI AL LIVELLO ROOT SE VUOTI (ATA & DOCENTI)
      if (Array.isArray(extractedData.nomine_contratti) && extractedData.nomine_contratti.length > 0) {
        const firstNom = extractedData.nomine_contratti[0];
        if (!extractedData.nominativo && firstNom.nominativo) {
          extractedData.nominativo = firstNom.nominativo;
        }
        if (extractedData.punteggio === null || extractedData.punteggio === undefined || extractedData.punteggio === "") {
          if (firstNom.punteggio !== null && firstNom.punteggio !== undefined && firstNom.punteggio !== "") {
            extractedData.punteggio = firstNom.punteggio;
          }
        }
        if (!extractedData.posizione_graduatoria && firstNom.posizione_graduatoria) {
          extractedData.posizione_graduatoria = firstNom.posizione_graduatoria;
        }
        if (!extractedData.graduatoria_fascia && firstNom.fascia) {
          extractedData.graduatoria_fascia = firstNom.fascia;
        }
        if (!extractedData.profilo_lavorativo && firstNom.profilo_lavorativo) {
          extractedData.profilo_lavorativo = firstNom.profilo_lavorativo;
        }
        if (!extractedData.profilo_professionale && firstNom.profilo_lavorativo) {
          extractedData.profilo_professionale = firstNom.profilo_lavorativo;
        }
        if (!extractedData.classe_concorso_area_lab && firstNom.classe_concorso_area_lab) {
          extractedData.classe_concorso_area_lab = firstNom.classe_concorso_area_lab;
        }
        if (!extractedData.tipologia_personale && firstNom.tipologia_personale) {
          extractedData.tipologia_personale = firstNom.tipologia_personale;
        }
        if (!extractedData.tipo_posto && firstNom.tipo_posto) {
          extractedData.tipo_posto = firstNom.tipo_posto;
        }
        if (!extractedData.ore_settimanali && firstNom.ore_settimanali) {
          extractedData.ore_settimanali = firstNom.ore_settimanali;
        }
        if (!extractedData.decorrenza_contratto && firstNom.decorrenza_contratto) {
          extractedData.decorrenza_contratto = firstNom.decorrenza_contratto;
        }
      }

      if (inputNominativo && inputNominativo.trim() && !extractedData.nominativo) {
        extractedData.nominativo = safeDecodeURIComponent(inputNominativo.trim());
      } else if (extractedData.nominativo) {
        extractedData.nominativo = safeDecodeURIComponent(extractedData.nominativo);
      }

      // Infer school name / code if missing (decodifica testi da URL-encoding)
      if (!extractedData.nome_istituto) {
        try {
          const u = new URL(res.navigatedUrl || targetUrl);
          const pathSegments = u.pathname.split("/").filter(Boolean);
          const candidateSegment = pathSegments.slice().reverse().find(s => 
            !/^(index|default|home|page|albo|trasparenza|atti|documenti|bacheca|login|it|en|categoria|category|rubrica|notizie)$/i.test(s) &&
            !/^\d+$/.test(s) &&
            s.length > 2
          );
          if (candidateSegment) {
            extractedData.nome_istituto = safeDecodeURIComponent(candidateSegment).replace(/[-_]/g, " ").trim();
          } else {
            const cleanHost = u.hostname.replace(/^www\./, "");
            extractedData.nome_istituto = safeDecodeURIComponent(cleanHost).toUpperCase();
          }
        } catch {
          extractedData.nome_istituto = safeDecodeURIComponent(targetUrl);
        }
      } else {
        extractedData.nome_istituto = safeDecodeURIComponent(extractedData.nome_istituto);
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
        } else {
          // La ricerca è stata fatta ma non trovata
          extractedData.codice_meccanografico = "Non disponibile";
        }
      }

      // Propaga il codice meccanografico e nome istituto a tutte le nomine del contratto
      if (Array.isArray(extractedData.nomine_contratti)) {
        extractedData.nomine_contratti = extractedData.nomine_contratti.map((item: any) => ({
          ...item,
          nome_istituto: safeDecodeURIComponent(item.nome_istituto || extractedData.nome_istituto || ""),
          codice_meccanografico: (item.codice_meccanografico && isValidCodiceMeccanografico(item.codice_meccanografico))
            ? normalizeCodiceMeccanografico(item.codice_meccanografico)
            : (isValidCodiceMeccanografico(extractedData.codice_meccanografico) ? normalizeCodiceMeccanografico(extractedData.codice_meccanografico) : (extractedData.codice_meccanografico || "Non disponibile"))
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

      // Se il punteggio di primo livello manca o ci sono soglie nel testo, esegui l'analisi euristica
      if (res.fullText) {
        const heuristicScore = extractPunteggioHeuristic(res.fullText, {
          profilo: extractedData.profilo_lavorativo || extractedData.profilo_professionale,
          cdc: extractedData.classe_concorso_area_lab,
          nominativo: extractedData.nominativo,
        });
        if (extractedData.punteggio === null && heuristicScore.punteggio !== null) {
          extractedData.punteggio = heuristicScore.punteggio;
          extractedData.origine_punteggio = "Esplicito";
          extractedData.note_cross_reference = `Punteggio rilevato nel testo: "${heuristicScore.sourcePhrase || heuristicScore.punteggio}"`;
          res.logs.push(`🎯 Punteggio rilevato dal testo: ${heuristicScore.punteggio} (${heuristicScore.sourcePhrase || ""})`);
        }
        if (heuristicScore.sogliaConvocazione !== null && heuristicScore.sogliaConvocazione !== undefined) {
          const sogliaMsg = `Soglia convocazione: ${heuristicScore.sogliaConvocazione}`;
          extractedData.note_cross_reference = extractedData.note_cross_reference
            ? `${extractedData.note_cross_reference} | ${sogliaMsg}`
            : sogliaMsg;
          res.logs.push(`ℹ️ ${sogliaMsg}`);
        }
      }

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
          let punt = normalizePunteggio(item.punteggio);

          // Se manca il punteggio in questa singola nomina o per rilevare soglie di convocazione
          if (res.fullText) {
            const hMatch = extractPunteggioHeuristic(res.fullText, {
              profilo: item.profilo_lavorativo || item.profilo_professionale,
              cdc: cdcArea,
              nominativo: item.nominativo || extractedData.nominativo,
            });
            if (punt === null && hMatch.punteggio !== null) {
              punt = hMatch.punteggio;
              item.origine_punteggio = "Esplicito";
              item.note_cross_reference = `Punteggio rilevato nel testo: "${hMatch.sourcePhrase || punt}"`;
              res.logs.push(`🎯 Punteggio nomina (${item.profilo_lavorativo || "profilo"}): ${punt}`);
            }
            if (hMatch.sogliaConvocazione !== null && hMatch.sogliaConvocazione !== undefined) {
              const sogliaMsg = `Soglia convocazione: ${hMatch.sogliaConvocazione}`;
              item.note_cross_reference = item.note_cross_reference
                ? `${item.note_cross_reference} | ${sogliaMsg}`
                : sogliaMsg;
            }
          }

          const baseItem = {
            ...item,
            nominativo: safeDecodeURIComponent(item.nominativo || extractedData.nominativo || ""),
            nome_istituto: safeDecodeURIComponent(item.nome_istituto || extractedData.nome_istituto || ""),
            codice_meccanografico: item.codice_meccanografico || extractedData.codice_meccanografico || "",
            tipologia_personale: tipologia,
            profilo_lavorativo: safeDecodeURIComponent(item.profilo_lavorativo || item.profilo_professionale || (tipologia === "DOCENTE" ? "Docente TD" : "Collaboratore scolastico TD")),
            classe_concorso_area_lab: standardizePlaceholder(cdcArea, isClasseConcorsoPertinent(tipologia, item.profilo_lavorativo || item.profilo_professionale || "")),
            tipo_posto: tipoPosto,
            classe_di_concorso: standardizePlaceholder(cdcArea, isClasseConcorsoPertinent(tipologia, item.profilo_lavorativo || item.profilo_professionale || "")),
            punteggio: punt,
            posizione_graduatoria: standardizePlaceholder(item.posizione_graduatoria, true),
            fascia: standardizePlaceholder(item.fascia || item.graduatoria_fascia, true),
            ore_settimanali: standardizePlaceholder(item.ore_settimanali, true),
            decorrenza_contratto: standardizePlaceholder(duration.formattedPeriod, true),
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
      // TASK 5 — Risoluzione da graduatorie (resolveFromGraduatorie)
      // -------------------------------------------------------------
      extractedData = await resolveFromGraduatorie(extractedData, {
        apiKey,
        targetUrl,
        customProxy,
        failedProxiesByDomain,
        fetchAiFn: async (promptText, sysPrompt) => {
          return await extractWithOpenRouter(promptText, apiKey, sysPrompt);
        },
        fetchProxyFn: (url, asBuf, onLog) =>
          fetchWithProxy(url, asBuf, onLog, customProxy, failedProxiesByDomain),
        pdfTextExtractor: async (buf, maxP) => {
          const { text, numPages } = await extractTextFromPdfBuffer(buf, maxP || 300);
          return { text: text || "", numPages: numPages || 0 };
        },
        pdfAiFallbackFn: async (pdfUrl, sysPrompt, targetNames) => {
          const userPrompt = buildGraduatoriaUserPrompt(
            "Documento PDF graduatoria allegato.",
            targetNames || []
          );
          return await extractPdfWithOpenRouter(
            pdfUrl,
            `${sysPrompt}\n\n${userPrompt}`,
            apiKey,
            false,
            customProxy,
            failedProxiesByDomain,
            300
          );
        },
        onLog: (logMsg) => res.logs.push(logMsg),
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      res.logs.push(`❌ Errore durante la post-elaborazione: ${errMsg}`);
      extractionStatus = "error";
      extractionError = errMsg;
    }
    return {
      status: extractionStatus,
      url: targetUrl,
      navigatedUrl: res.navigatedUrl,
      logs: res.logs,
      data: extractedData,
      error: extractionError,
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

      // PROMOZIONE DEI CAMPI DA NOMINE_CONTRATTI AL LIVELLO ROOT SE VUOTI (ATA & DOCENTI)
      if (Array.isArray(extracted.nomine_contratti) && extracted.nomine_contratti.length > 0) {
        const firstNom = extracted.nomine_contratti[0];
        if (!extracted.nominativo && firstNom.nominativo) {
          extracted.nominativo = firstNom.nominativo;
        }
        if (extracted.punteggio === null || extracted.punteggio === undefined || extracted.punteggio === "") {
          if (firstNom.punteggio !== null && firstNom.punteggio !== undefined && firstNom.punteggio !== "") {
            extracted.punteggio = firstNom.punteggio;
          }
        }
        if (!extracted.posizione_graduatoria && firstNom.posizione_graduatoria) {
          extracted.posizione_graduatoria = firstNom.posizione_graduatoria;
        }
        if (!extracted.graduatoria_fascia && firstNom.fascia) {
          extracted.graduatoria_fascia = firstNom.fascia;
        }
        if (!extracted.fascia && firstNom.fascia) {
          extracted.fascia = firstNom.fascia;
        }
        if (!extracted.profilo_lavorativo && firstNom.profilo_lavorativo) {
          extracted.profilo_lavorativo = firstNom.profilo_lavorativo;
        }
        if (!extracted.profilo_professionale && firstNom.profilo_lavorativo) {
          extracted.profilo_professionale = firstNom.profilo_lavorativo;
        }
        if (!extracted.classe_concorso_area_lab && firstNom.classe_concorso_area_lab) {
          extracted.classe_concorso_area_lab = firstNom.classe_concorso_area_lab;
        }
        if (!extracted.tipologia_personale && firstNom.tipologia_personale) {
          extracted.tipologia_personale = firstNom.tipologia_personale;
        }
        if (!extracted.tipo_posto && firstNom.tipo_posto) {
          extracted.tipo_posto = firstNom.tipo_posto;
        }
        if (!extracted.ore_settimanali && firstNom.ore_settimanali) {
          extracted.ore_settimanali = firstNom.ore_settimanali;
        }
        if (!extracted.decorrenza_contratto && firstNom.decorrenza_contratto) {
          extracted.decorrenza_contratto = firstNom.decorrenza_contratto;
        }
      }

      // Rinforzo codice meccanografico per il PDF
      if (!isValidCodiceMeccanografico(extracted.codice_meccanografico)) {
        const found = extractCodiceMeccanograficoFromText(content, selectedPdfFile.name);
        if (found) {
          extracted.codice_meccanografico = normalizeCodiceMeccanografico(found);
        } else {
          extracted.codice_meccanografico = "Non disponibile";
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

      const rawPdfName = selectedPdfFile.name;
      const cleanPdfName = safeDecodeURIComponent(rawPdfName);
      const cleanSchoolName = safeDecodeURIComponent(extracted.nome_istituto || "Istituto Scolastico");

      const crossPdf = crossReferenceNomina(
        {
          nome_istituto: cleanSchoolName,
          codice_meccanografico: extracted.codice_meccanografico || "",
          tipologia_personale: pdfTipologia,
          profilo_lavorativo: safeDecodeURIComponent(extracted.profilo_lavorativo || extracted.profilo_professionale || (pdfTipologia === "DOCENTE" ? "Docente TD" : "Collaboratore scolastico TD")),
          classe_concorso_area_lab: standardizePlaceholder(pdfCdcArea, isClasseConcorsoPertinent(pdfTipologia, extracted.profilo_lavorativo || extracted.profilo_professionale || "")),
          tipo_posto: pdfTipoPosto,
          classe_di_concorso: standardizePlaceholder(pdfCdcArea, isClasseConcorsoPertinent(pdfTipologia, extracted.profilo_lavorativo || extracted.profilo_professionale || "")),
          punteggio: pdfPunteggio,
          posizione_graduatoria: standardizePlaceholder(extracted.posizione_graduatoria, true),
          fascia: standardizePlaceholder(extracted.fascia || extracted.graduatoria_fascia, true),
          ore_settimanali: standardizePlaceholder(extracted.ore_settimanali, true),
          decorrenza_contratto: standardizePlaceholder(duration.formattedPeriod, true),
          durata_contratto_mesi: duration.mesi,
          durata_contratto_giorni: duration.giorni,
          link_del_documento: cleanPdfName,
        } as any,
        graduatorie,
        {
          codice_meccanografico: extracted.codice_meccanografico,
          nome_istituto: cleanSchoolName,
        }
      );

      // Processa anche la lista nomine_contratti del singolo PDF
      let processedNomine = extracted.nomine_contratti;
      if (Array.isArray(processedNomine)) {
        processedNomine = processedNomine.map((item: any) => {
          const itemDuration = calculateContractDuration(item.decorrenza_contratto || "");
          const itemTipologia = inferTipologiaPersonale(item);
          const itemCdcArea = inferClasseConcorsoAreaLab(item, itemTipologia);
          const itemTipoPosto = inferTipoPosto(item);
          const itemPunt = normalizePunteggio(item.punteggio);

          const baseItem = {
            ...item,
            nominativo: safeDecodeURIComponent(item.nominativo || extracted.nominativo || ""),
            nome_istituto: safeDecodeURIComponent(item.nome_istituto || extracted.nome_istituto || cleanSchoolName),
            codice_meccanografico: item.codice_meccanografico || extracted.codice_meccanografico || "",
            tipologia_personale: itemTipologia,
            profilo_lavorativo: safeDecodeURIComponent(item.profilo_lavorativo || item.profilo_professionale || (itemTipologia === "DOCENTE" ? "Docente TD" : "Collaboratore scolastico TD")),
            classe_concorso_area_lab: standardizePlaceholder(itemCdcArea, isClasseConcorsoPertinent(itemTipologia, item.profilo_lavorativo || item.profilo_professionale || "")),
            tipo_posto: itemTipoPosto,
            classe_di_concorso: standardizePlaceholder(itemCdcArea, isClasseConcorsoPertinent(itemTipologia, item.profilo_lavorativo || item.profilo_professionale || "")),
            punteggio: itemPunt,
            posizione_graduatoria: standardizePlaceholder(item.posizione_graduatoria, true),
            fascia: standardizePlaceholder(item.fascia || item.graduatoria_fascia, true),
            ore_settimanali: standardizePlaceholder(item.ore_settimanali, true),
            decorrenza_contratto: standardizePlaceholder(itemDuration.formattedPeriod, true),
            durata_contratto_mesi: itemDuration.mesi,
            durata_contratto_giorni: itemDuration.giorni,
            link_del_documento: item.link_del_documento || cleanPdfName,
          };

          return crossReferenceNomina(baseItem, graduatorie, {
            codice_meccanografico: baseItem.codice_meccanografico,
            nome_istituto: baseItem.nome_istituto,
          });
        });
      }

      setPdfExtractResult({
        success: true,
        filename: cleanPdfName,
        size: selectedPdfFile.size,
        data: {
          nome_istituto: safeDecodeURIComponent(crossPdf.nome_istituto || "Istituto Scolastico"),
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
          link_del_documento: cleanPdfName,
          // Compatibilità pregressa
          graduatoria_fascia: crossPdf.fascia,
          profilo_professionale: crossPdf.profilo_lavorativo,
          decorrenza_da: normalizeDateOutput(extracted.decorrenza_da || ""),
          decorrenza_a: normalizeDateOutput(extracted.decorrenza_a || ""),
          nomine_contratti: processedNomine,
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
      const parts = line.split(/[;,]/).map(p => {
        let clean = p.trim();
        while (clean.length >= 2 && clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1).trim();
        }
        return clean.replace(/""/g, '"');
      });

      let foundUrl = "";
      let foundNom: string | undefined = undefined;

      if (hasHeader) {
        if (parts[urlCol]) foundUrl = parts[urlCol];
        if (nomCol !== -1 && parts[nomCol]) foundNom = safeDecodeURIComponent(parts[nomCol]);
      } else {
        // Cerca colonna con URL
        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
          const val = parts[pIdx];
          const isLikelyUrl = !val.includes(" ") && (
            val.startsWith("http://") ||
            val.startsWith("https://") ||
            val.includes(".edu.it") ||
            val.includes(".gov.it") ||
            val.includes("www.") ||
            /\.[a-z]{2,}(\/|$|\?)/i.test(val)
          );
          if (isLikelyUrl) {
            foundUrl = val;
            const otherCol = parts.find((o, idx) => idx !== pIdx && o.length > 1 && !o.startsWith("http"));
            if (otherCol) foundNom = safeDecodeURIComponent(otherCol);
            break;
          }
        }
      }

      if (foundUrl) {
        if (!foundUrl.startsWith("http://") && !foundUrl.startsWith("https://")) {
          foundUrl = `https://${foundUrl}`;
        }
        try {
          const u = new URL(foundUrl);
          if (u.hostname.includes(".") || u.hostname === "localhost") {
            results.push({ url: foundUrl, nominativo: foundNom ? foundNom.trim() : undefined });
          }
        } catch {
          // Scarta se non è un URL valido
        }
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
      const lower = str.toLowerCase();
      if (
        lower === "null" ||
        lower === "undefined" ||
        lower === "non riportato" ||
        lower === "non riportata" ||
        lower === "non specificato" ||
        lower === "non specificata" ||
        lower === "non disponibile" ||
        lower === "n/d" ||
        lower === "-" ||
        lower === ""
      ) return "";
      const num = parseFloat(str.replace(",", "."));
      return isNaN(num) ? "" : num.toFixed(2);
    };

    const rows: string[] = [];

    for (const r of items) {
      const data = r.data || ({} as any);

      // School Name: from data or URL
      let defaultSchoolName = data.nome_istituto ? safeDecodeURIComponent(data.nome_istituto) : "";
      if (!defaultSchoolName) {
        try {
          const u = new URL(r.navigatedUrl || r.url);
          const pathSegments = u.pathname.split("/").filter(Boolean);
          const candidateSegment = pathSegments.slice().reverse().find(s => 
            !/^(index|default|home|page|albo|trasparenza|atti|documenti|bacheca|login|it|en|categoria|category|rubrica|notizie)$/i.test(s) &&
            !/^\d+$/.test(s) &&
            s.length > 2
          );
          if (candidateSegment) {
            defaultSchoolName = safeDecodeURIComponent(candidateSegment).replace(/[-_]/g, " ").trim();
          } else {
            defaultSchoolName = safeDecodeURIComponent(u.hostname.replace(/^www\./, "")).toUpperCase();
          }
        } catch {
          defaultSchoolName = safeDecodeURIComponent(r.url || "Istituto Scolastico");
        }
      }
      defaultSchoolName = safeDecodeURIComponent(defaultSchoolName);
      
      // Verifica se la ricerca del codice meccanografico è stata effettuata
      const isAlboOnly = Array.isArray(data.albo_contratti) && data.albo_contratti.length > 0 && (!data.nomine_contratti || data.nomine_contratti.length === 0);
      const wasExtractionSearched = !isAlboOnly && r.status !== "error" && Boolean(r.data);
      const defaultSchoolCode = formatCsvCodiceMeccanografico(data.codice_meccanografico, wasExtractionSearched);

      // 1. If nomine_contratti is present and has elements, create one row per nomination
      if (Array.isArray(data.nomine_contratti) && data.nomine_contratti.length > 0) {
        for (const c of data.nomine_contratti) {
          const duration = calculateContractDuration(c.decorrenza_contratto || "");
          const schoolName = cleanFieldString(safeDecodeURIComponent(c.nome_istituto || defaultSchoolName), "Istituto Scolastico");
          const schoolCode = formatCsvCodiceMeccanografico(c.codice_meccanografico || defaultSchoolCode, true);
          const tipologia = cleanFieldString(c.tipologia_personale, "ATA");
          const profilo = cleanFieldString(safeDecodeURIComponent(c.profilo_lavorativo || "Collaboratore scolastico TD"), "Collaboratore scolastico TD");
          const isCdcPert = isClasseConcorsoPertinent(tipologia, profilo);
          const classe = standardizePlaceholder(c.classe_concorso_area_lab || c.classe_di_concorso, isCdcPert);
          const tipoPosto = cleanFieldString(c.tipo_posto, "comune");
          const punteggio = formatCsvPunteggio(c.punteggio);
          const origine = cleanFieldString(c.origine_punteggio, (punteggio ? "Esplicito" : "Non disponibile"));
          const posizione = standardizePlaceholder(c.posizione_graduatoria, true);
          const fascia = standardizePlaceholder(c.fascia || c.graduatoria_fascia, true);
          const ore = standardizePlaceholder(c.ore_settimanali, true);
          const decorrenza = standardizePlaceholder(duration.formattedPeriod, true);
          const mesi = duration.mesi;
          const giorni = duration.giorni;
          const noteIncrocio = cleanFieldString(c.note_cross_reference, "");
          const link = resolveValidDocumentLink(c.link_del_documento, r.navigatedUrl || r.url);

          rows.push([
            escapeCsvField(schoolName),
            escapeCsvField(schoolCode),
            escapeCsvField(tipologia),
            escapeCsvField(profilo),
            escapeCsvField(classe),
            escapeCsvField(tipoPosto),
            escapeCsvField(punteggio),
            escapeCsvField(origine),
            escapeCsvField(posizione),
            escapeCsvField(fascia),
            escapeCsvField(ore),
            escapeCsvField(decorrenza),
            escapeCsvField(mesi),
            escapeCsvField(giorni),
            escapeCsvField(noteIncrocio),
            escapeCsvField(link),
          ].join(","));
        }
      } 
      // 2. If albo_contratti has items, expand each contract to one row
      else if (Array.isArray(data.albo_contratti) && data.albo_contratti.length > 0) {
        for (const c of data.albo_contratti) {
          const duration = calculateContractDuration("", c.decorrenza_da, c.decorrenza_a);
          const schoolName = cleanFieldString(safeDecodeURIComponent(defaultSchoolName), "Istituto Scolastico");
          const schoolCode = formatCsvCodiceMeccanografico(c.codice_meccanografico || data.codice_meccanografico, false);
          const tipologia = cleanFieldString(c.tipologia_personale, "ATA");
          const profilo = cleanFieldString(safeDecodeURIComponent(c.profilo_professionale || c.titolo_bando || "Personale Scolastico"), "Personale Scolastico");
          const isCdcPert = isClasseConcorsoPertinent(tipologia, profilo);
          const classe = standardizePlaceholder(c.classe_concorso_area_lab || c.classe_di_concorso, isCdcPert);
          const tipoPosto = cleanFieldString(c.tipo_posto, "comune");
          const punteggio = formatCsvPunteggio(c.punteggio);
          const origine = cleanFieldString(c.origine_punteggio, (punteggio ? "Esplicito" : "Non disponibile"));
          const posizione = standardizePlaceholder(c.posizione_graduatoria, true);
          const fascia = standardizePlaceholder(c.graduatoria_fascia || c.fascia, true);
          const ore = standardizePlaceholder(c.ore_settimanali, true);
          const decorrenza = standardizePlaceholder(duration.formattedPeriod, true);
          const mesi = duration.mesi;
          const giorni = duration.giorni;
          const noteIncrocio = cleanFieldString(c.note_cross_reference, "");
          const link = resolveValidDocumentLink(c.pdf_url, r.navigatedUrl || r.url);

          rows.push([
            escapeCsvField(schoolName),
            escapeCsvField(schoolCode),
            escapeCsvField(tipologia),
            escapeCsvField(profilo),
            escapeCsvField(classe),
            escapeCsvField(tipoPosto),
            escapeCsvField(punteggio),
            escapeCsvField(origine),
            escapeCsvField(posizione),
            escapeCsvField(fascia),
            escapeCsvField(ore),
            escapeCsvField(decorrenza),
            escapeCsvField(mesi),
            escapeCsvField(giorni),
            escapeCsvField(noteIncrocio),
            escapeCsvField(link),
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
        const schoolName = cleanFieldString(safeDecodeURIComponent(defaultSchoolName), "Istituto Scolastico");
        const schoolCode = formatCsvCodiceMeccanografico(defaultSchoolCode, wasExtractionSearched);
        const tipologia = cleanFieldString(data.tipologia_personale, "ATA");
        const profilo = cleanFieldString(safeDecodeURIComponent(data.profilo_lavorativo || data.profilo_professionale || (
          data.convocazioni_collaboratore_scolastico > 0 ? "Collaboratore Scolastico TD" :
          data.convocazioni_assistente_amministrativo > 0 ? "Assistente Amministrativo TD" :
          data.convocazioni_docenti > 0 ? "Docente TD" :
          data.convocazioni_assistente_tecnico > 0 ? "Assistente Tecnico TD" :
          "Personale Scolastico"
        )), "Personale Scolastico");
        const isCdcPert = isClasseConcorsoPertinent(tipologia, profilo);
        const classe = standardizePlaceholder(data.classe_concorso_area_lab || data.classe_di_concorso, isCdcPert);
        const tipoPosto = cleanFieldString(data.tipo_posto, "comune");
        const punteggio = formatCsvPunteggio(data.punteggio);
        const origine = cleanFieldString(data.origine_punteggio, (punteggio ? "Esplicito" : "Non disponibile"));
        const posizione = standardizePlaceholder(data.posizione_graduatoria, true);
        const fascia = standardizePlaceholder(data.graduatoria_fascia || data.fascia, true);
        const ore = standardizePlaceholder(data.ore_settimanali, true);
        const decorrenza = standardizePlaceholder(duration.formattedPeriod, true);
        const mesi = duration.mesi;
        const giorni = duration.giorni;
        const noteIncrocio = cleanFieldString(data.note_cross_reference, "");
        const link = resolveValidDocumentLink(data.link_del_documento, r.navigatedUrl || r.url);

        rows.push([
          escapeCsvField(schoolName),
          escapeCsvField(schoolCode),
          escapeCsvField(tipologia),
          escapeCsvField(profilo),
          escapeCsvField(classe),
          escapeCsvField(tipoPosto),
          escapeCsvField(punteggio),
          escapeCsvField(origine),
          escapeCsvField(posizione),
          escapeCsvField(fascia),
          escapeCsvField(ore),
          escapeCsvField(decorrenza),
          escapeCsvField(mesi),
          escapeCsvField(giorni),
          escapeCsvField(noteIncrocio),
          escapeCsvField(link),
        ].join(","));
      }
    }

    return [headers.map(escapeCsvField).join(","), ...rows].join("\n");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navbar & Tab Bar - Linear / Vercel Enterprise Style */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        {/* Main Header Bar */}
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 shrink-0">
              <Cpu className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base font-semibold tracking-tight text-slate-100 truncate">
                  ScuolaATA Data Scraper & AI Extractor
                </h1>
                {openRouterApiKey ? (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shrink-0"
                    title="OpenRouter AI Attivo - Clicca per gestire la chiave"
                    aria-label="Stato OpenRouter: Connesso"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-400"></span>
                    <span>OpenRouter AI Connesso</span>
                    <Check className="size-3 text-emerald-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer animate-pulse focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shrink-0"
                    title="Clicca qui per inserire la tua OpenRouter API Key"
                    aria-label="Stato OpenRouter: API Key Mancante"
                  >
                    <Key className="size-3 text-amber-400" />
                    <span>API Key Mancante</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">Automazione avanzata per bandi, convocazioni e pensionamenti scolastici</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Light / Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Passa a tema chiaro (Light mode)" : "Passa a tema scuro (Dark mode)"}
              title={theme === "dark" ? "Passa a tema chiaro (Light mode)" : "Passa a tema scuro (Dark mode)"}
              className="size-10 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shrink-0"
            >
              {theme === "dark" ? (
                <Sun className="size-[18px] text-amber-400" />
              ) : (
                <Moon className="size-[18px] text-blue-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Impostazioni & API Key"
              title={openRouterApiKey ? "Impostazioni & API Key" : "Configura API Key"}
              className={`size-10 rounded-md border flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shrink-0 ${
                !openRouterApiKey
                  ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                  : "bg-slate-900 hover:bg-slate-800 hover:border-slate-700 text-slate-300 border-slate-800"
              }`}
            >
              {openRouterApiKey ? (
                <Settings className="size-[18px]" />
              ) : (
                <Key className="size-[18px] text-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation - Horizontal scroll on mobile, enterprise Linear/Vercel tabs */}
        <nav
          aria-label="Navigazione sezioni"
          className="px-4 sm:px-6 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-t border-slate-800/80"
        >
          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "batch"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <FileSpreadsheet className="size-[18px]" />
            <span>Elaborazione Batch CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "single"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <Search className="size-[18px]" />
            <span>Test URL Singolo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("albo")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "albo"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <FileText className="size-[18px]" />
            <span>Albo Pretorio & PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("graduatorie")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "graduatorie"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <GraduationCap className="size-[18px]" />
            <span>Graduatorie ({graduatorie.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "history"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <Layers className="size-[18px]" />
            <span>Storico ({batchHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "search"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <Globe className="size-[18px]" />
            <span>Google Data Search</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`px-3.5 py-2.5 rounded-t-md text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all duration-150 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
              activeTab === "guide"
                ? "border-b-[3px] border-blue-500 bg-blue-500/10 text-slate-100 font-medium"
                : "border-b-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium"
            }`}
          >
            <HelpCircle className="size-[18px]" />
            <span>Architettura & Guida</span>
          </button>
        </nav>
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
            className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full my-auto flex flex-col max-h-[90vh] overflow-hidden relative animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed & Sticky) */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900 sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Settings className="size-[18px]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
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
                className="size-10 rounded-md bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                aria-label="Chiudi impostazioni"
                title="Chiudi"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={saveSettings} className="overflow-y-auto p-6 space-y-6 flex-1">
              {settingsSavedMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-md text-sm flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-medium">{settingsSavedMessage}</span>
                </div>
              )}

              {/* PRIMARY & PROMINENT: OpenRouter API Key Input Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Key className="size-[18px]" />
                    </div>
                    <label htmlFor="openrouter-api-key-input" className="text-sm font-semibold text-slate-100">
                      OpenRouter API Key
                    </label>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Obbligatoria per AI
                    </span>
                  </div>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium transition-colors"
                  >
                    <span>Ottieni chiave su openrouter.ai</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Incolla qui la tua chiave segreta OpenRouter (inizia con <code className="bg-slate-900 text-blue-300 px-1.5 py-0.5 rounded font-mono text-[11px]">sk-or-v1-...</code>). Viene memorizzata esclusivamente nel LocalStorage del tuo browser e usata direttamente per le chiamate AI (Gemini 2.5 Flash / Claude).
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 pl-3 pr-24 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 font-mono outline-none transition-colors"
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
                          aria-label="Svuota campo chiave"
                          title="Svuota campo"
                          className="size-8 flex items-center justify-center text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors motion-reduce:transition-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? "Nascondi chiave" : "Mostra chiave"}
                        title={showApiKey ? "Nascondi chiave" : "Mostra chiave"}
                        className="size-8 flex items-center justify-center text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors motion-reduce:transition-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 cursor-pointer"
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
                      className="h-10 px-4 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                    >
                      {isTestingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
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
                      <div className={`text-xs flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-md ${
                        keyTestStatus.valid 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
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

              {/* SECTION: Tema & Aspetto (Light / Dark) */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    {theme === "dark" ? (
                      <Moon className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Aspetto & Tema Grafico</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {theme === "dark" ? "Tema Scuro attivo" : "Tema Chiaro attivo"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`h-11 px-4 rounded-md border flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
                      theme === "dark"
                        ? "bg-blue-500/10 border-blue-500 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <Moon className="size-4 text-blue-400" />
                    <span>Tema Scuro (Dark)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`h-11 px-4 rounded-md border flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 ${
                      theme === "light"
                        ? "bg-blue-500/10 border-blue-500 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <Sun className="size-4 text-amber-400" />
                    <span>Tema Chiaro (Light)</span>
                  </button>
                </div>
              </div>

              {/* SECTION: Rete & Architettura Anti-403 */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Rete & Architettura Anti-403</span>
                  </h4>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Attivo
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <p className="text-slate-300 font-medium">Catena di recupero automatica:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                    <li><strong className="text-slate-200">Proxy Server (/api/proxy)</strong> con intestazioni realistiche Chrome & failover serverless.</li>
                    <li><strong className="text-slate-200">Jina AI Reader</strong> con CORS nativo del browser, bypass 403 e rendering JavaScript di portali Albo (Argo, Trasparenza-PA).</li>
                    <li><strong className="text-slate-200">Web Grounding Search IA</strong> mirato per reperire bandi e convocazioni ufficiali se il sito è offline.</li>
                  </ol>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="jina-api-key-input" className="text-xs font-medium text-slate-400">
                      Jina AI Reader API Key (opzionale)
                    </label>
                    <a
                      href="https://jina.ai/reader"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 font-mono outline-none transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">
                    Alza il rate limit di r.jina.ai da 20 a 500 richieste/minuto. Ottienila gratis su{" "}
                    <a
                      href="https://jina.ai/reader"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      jina.ai/reader
                    </a>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Proxy o Scraper URL Personalizzato (Opzionale)</label>
                  <input
                    type="text"
                    value={customProxyUrl}
                    onChange={(e) => setCustomProxyUrl(e.target.value)}
                    placeholder="es. https://tuo-proxy.com/?url=${url}"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 outline-none transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Se possiedi un tuo proxy o servizio scraper dedicato, inseriscilo qui. Verrà usato come priorità assoluta.</p>
                </div>
              </div>

              {/* SECTION: GitHub Integration */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5 text-slate-400" />
                  <span>GitHub Integration (Opzionale)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Username GitHub</label>
                    <input
                      type="text"
                      value={githubUser}
                      onChange={(e) => setGithubUser(e.target.value)}
                      placeholder="es. mariosrossi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Nome Repository</label>
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="es. dashboard-etsy"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* SECTION: Salvataggio e Backup Locale */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Salvataggio e Backup Locale sul Device</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tutti i dati e lo storico delle estrazioni sono salvati in automatico nella memoria locale del browser (Device Storage). Puoi anche esportare un file di backup o ripristinarlo in qualsiasi momento.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={exportLocalBackup}
                    className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Esporta Backup (JSON)</span>
                  </button>
                  <label className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950">
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Importa Backup (JSON)</span>
                    <input type="file" accept=".json" onChange={importLocalBackup} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-800 bg-slate-900 sticky bottom-0 z-20 shrink-0">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${openRouterApiKey ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                  <span>{openRouterApiKey ? "Chiave inserita" : "Chiave non ancora impostata"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="h-10 px-4 rounded-md text-sm font-medium text-slate-400 hover:text-slate-200 bg-transparent hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
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
          <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-amber-500/50 transition-colors animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="size-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Key className="size-[18px] animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>OpenRouter API Key richiesta per l'estrazione AI</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold">
                    Non Configurato
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Per scansionare i siti degli istituti scolastici, analizzare l'Albo Pretorio ed estrarre i dati delle convocazioni ATA, inserisci la tua API Key di OpenRouter.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="h-10 px-4 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
            >
              <Key className="w-4 h-4" />
              <span>Inserisci API Key Ora</span>
            </button>
          </div>
        )}
        
        {/* TAB 1: BATCH CSV PROCESSING */}
        {activeTab === "batch" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Upload Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors relative overflow-hidden space-y-6">
              <div className="max-w-2xl space-y-2">
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
                  <FileSpreadsheet className="size-[22px] text-blue-400" />
                  Carica File CSV con Lista URL
                </h2>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  Carica un file CSV contenente una colonna con i link dei siti web scolastici. Il sistema visiterà ogni homepage, cercherà sezioni dedicate ad <strong className="text-slate-200">ATA</strong> o <strong className="text-slate-200">Bandi di gara</strong>, estrarrà i testi e utilizzerà Gemini AI per estrarre i dati strutturati.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={downloadSampleCsv}
                    className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Scarica CSV di Esempio</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleBatchProcess} className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <label htmlFor="batch-csv-upload-input" className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 cursor-pointer bg-slate-950/60 transition-colors motion-reduce:transition-none group min-h-[140px] focus-within:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2 transition-colors motion-reduce:transition-none" />
                    <span className="text-sm font-medium text-slate-200 group-hover:text-white text-center">
                      {selectedFile ? selectedFile.name : "Trascina qui il file CSV o clicca per selezionarlo"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Formati supportati: .csv</span>
                    <input
                      id="batch-csv-upload-input"
                      type="file"
                      accept=".csv"
                      className="sr-only"
                      aria-label="Carica file CSV contenente lista di URL scolastici"
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
                    className="h-10 sm:h-auto min-h-10 px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
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
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span><strong>Attenzione:</strong> OpenRouter API Key non ancora configurata per l'elaborazione batch.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-950"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configura API Key</span>
                  </button>
                </div>
              )}

              {batchError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{batchError}</span>
                  </div>
                  {(!openRouterApiKey || batchError.includes("API Key") || batchError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar during Batch Processing */}
            {isProcessingBatch && batchProgress.total > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-slate-300 gap-2">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>
                      Elaborazione pacchetto <strong className="text-white">{batchInfo.currentBatch || 1}</strong> di <strong className="text-white">{batchInfo.totalBatches || 1}</strong>
                      <span className="text-xs text-slate-400 ml-1.5">(15 link a pacchetto)</span>
                    </span>
                  </span>
                  <span className="font-semibold text-blue-400 font-mono">{batchProgress.current} / {batchProgress.total} link</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Salvataggio/append automatico nel file CSV al termine di ogni pacchetto di 15 link.</span>
                  <span className="font-mono">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Batch Live Log Panel */}
            {(isProcessingBatch || batchLiveLog.length > 0) && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  Log di Navigazione e Scansione (Batch)
                </h3>
                <div className="font-mono text-xs max-h-64 overflow-auto bg-slate-950 border border-slate-800 rounded-md p-4 text-slate-400 space-y-1.5">
                  {batchLiveLog.length === 0 ? (
                    <div className="text-slate-500 italic">In attesa dell'avvio...</div>
                  ) : (
                    batchLiveLog.map((logMsg, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-blue-400">›</span>
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
              <div className="space-y-6">
                {/* Final Completion Banner */}
                <div className="bg-slate-900 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors text-xs flex items-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Scarica CSV Server ({batchInfo.outputFilename || "batch.csv"})</span>
                    </a>
                  )}
                </div>

                {/* Batch Stats Counter Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                    <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="size-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-400 block truncate">URL Elaborati</span>
                      <span className="text-lg font-bold text-slate-100 font-mono block">{batchResults.length}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                    <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-400 block truncate">Successi</span>
                      <span className="text-lg font-bold text-slate-100 font-mono block">
                        {batchResults.filter(r => r.status === "success").length}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                    <div className="size-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                      <Briefcase className="size-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-400 block truncate">Convocazioni ATA</span>
                      <span className="text-lg font-bold text-slate-100 font-mono block">
                        {batchResults.reduce((acc, r) => acc + (r.data.convocazioni_collaboratore_scolastico || 0) + (r.data.convocazioni_assistente_amministrativo || 0) + (r.data.convocazioni_assistente_tecnico || 0) + (r.data.convocazioni_cuoco || 0) + (r.data.convocazioni_assistente_agrario || 0), 0)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                    <div className="size-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="size-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-400 block truncate">Errori Scansione</span>
                      <span className="text-lg font-bold text-slate-100 font-mono block">
                        {batchResults.filter(r => r.status === "error").length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">Risultati Elaborazione Batch</h3>
                    <p className="text-xs text-slate-400">Completata l'analisi su {batchResults.length} siti web</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={recalculateCrossReferenceOnBatchResults}
                      className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-medium transition-colors flex items-center gap-2 text-sm cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                      title="Ricalcola l'incrocio con le Graduatorie d'Istituto salvate per completare i punteggi mancanti"
                    >
                      <GraduationCap className="w-4 h-4 text-blue-400" />
                      <span>Ricalcola Incroci</span>
                    </button>
                    <button
                      onClick={exportResultsToCsv}
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors flex items-center gap-2 text-sm cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                      title="Esporta tutte le nomine nel formato CSV a 16 colonne con tracciamento incrocio graduatorie"
                    >
                      <Download className="w-4 h-4" />
                      <span>Esporta CSV Nomine (16 Colonne)</span>
                    </button>
                    <button
                      onClick={exportToGitHub}
                      className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-medium rounded-md transition-colors flex items-center gap-2 text-sm cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Github className="w-4 h-4 text-slate-300" />
                      <span>Salva CSV su GitHub</span>
                    </button>
                  </div>
                </div>

                {githubExportStatus && (
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-md text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-slate-300">{githubExportStatus}</span>
                    {githubExportUrl && (
                      <a 
                        href={githubExportUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-1 text-xs shrink-0"
                      >
                        <span>Visualizza commit su GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-sm">
                    <caption className="sr-only">
                      Risultati dell'elaborazione batch CSV con dettaglio statistiche convocazioni, nomine, graduatorie e contratti
                    </caption>
                    <thead className="sticky top-0 bg-slate-900 text-xs font-semibold text-slate-400 border-b border-slate-800 z-10">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">URL Originale</th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">Stato</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-blue-400">Tipo</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Profilo</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">CDC / Area AT</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Posto</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Punti / Origine</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Fascia</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap">Conv. Doc.</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap">Conv. ATA</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap">Pens. Doc.</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap">Pens. ATA</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Ore</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-center whitespace-nowrap text-emerald-400">Decorrenza</th>
                      </tr>
                    </thead>
                    <tbody>
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
                          <tr key={idx} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-200 max-w-xs text-sm">
                              <div className="flex flex-col gap-1">
                                <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-blue-400 flex items-center gap-1.5 truncate">
                                  <span className="truncate">{r.url}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                                </a>
                                <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                                  {isValidCodiceMeccanografico(r.data.codice_meccanografico) ? (
                                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 font-mono font-semibold rounded border border-blue-500/20 text-[10px] tracking-wide" title="Codice Meccanografico Ministeriale">
                                      {normalizeCodiceMeccanografico(r.data.codice_meccanografico)}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-slate-950 text-slate-500 font-mono rounded text-[10px] border border-slate-800" title="Codice Meccanografico">
                                      {r.data.codice_meccanografico === "Non disponibile" ? "Non disponibile" : "C.M. assente"}
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
                            <td className="px-4 py-3 text-sm">
                              {r.status === "success" ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap">
                                  <CheckCircle2 className="size-3" /> Completato
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" title={r.error}>
                                  <AlertCircle className="size-3" /> Errore
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${tipo === "DOCENTE" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-blue-500/10 text-blue-300 border border-blue-500/20"}`}>
                                {tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-300 font-medium max-w-[120px] truncate text-sm" title={r.data.profilo_lavorativo || r.data.profilo_professionale}>
                              {r.data.profilo_lavorativo || r.data.profilo_professionale || "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-300 font-medium font-mono text-sm">
                              {cdcArea}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400 capitalize text-sm">
                              {tipoPosto}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-sm">
                              <div className="flex flex-col items-center gap-1">
                                {punt === "Da verificare manualmente" || punt === "Non disponibile" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                    <AlertCircle className="size-3 shrink-0" />
                                    <span>{punt}</span>
                                  </span>
                                ) : (
                                  <span className="font-bold text-slate-100">{punt}</span>
                                )}
                                {r.data.origine_punteggio && r.data.punteggio !== null && punt !== "Da verificare manualmente" && (
                                  r.data.origine_punteggio === "Esplicito" ? (
                                    <span
                                      title={r.data.note_cross_reference || ""}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="size-3 shrink-0" />
                                      <span>Esplicito</span>
                                    </span>
                                  ) : r.data.origine_punteggio === "Incrociato" ? (
                                    <span
                                      title={r.data.note_cross_reference || ""}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap"
                                    >
                                      <GraduationCap className="size-3 shrink-0" />
                                      <span>Incrociato</span>
                                    </span>
                                  ) : (
                                    <span
                                      title={r.data.note_cross_reference || ""}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap"
                                    >
                                      <AlertCircle className="size-3 shrink-0" />
                                      <span>{r.data.origine_punteggio}</span>
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-300 font-medium text-sm">{r.data.graduatoria_fascia || "-"}</td>
                            <td className="px-4 py-3 text-center font-bold text-amber-300 text-sm">{r.data.convocazioni_docenti ?? 0}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-300 text-sm">{totalConvAta}</td>
                            <td className="px-4 py-3 text-center font-bold text-amber-300 text-sm">{r.data.pensionamenti_docenti ?? 0}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-300 text-sm">{totalPensAta}</td>
                            <td className="px-4 py-3 text-center text-slate-300 font-medium text-sm">{r.data.ore_settimanali || "-"}</td>
                            <td className="px-4 py-3 text-center text-slate-300 font-medium text-xs whitespace-nowrap">
                              {r.data.decorrenza_da ? `${r.data.decorrenza_da}${r.data.decorrenza_a ? ` - ${r.data.decorrenza_a}` : ""}` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SINGLE URL TEST */}
        {activeTab === "single" && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
                  <Search className="size-[22px] text-blue-400" />
                  Test Scansione & Estrazione Singolo URL
                </h2>
                <p className="text-sm font-medium text-slate-400 mt-1">
                  Inserisci l'indirizzo web di un istituto scolastico per testare la navigazione automatica e l'analisi LLM in tempo reale.
                </p>
              </div>

              <form onSubmit={handleSingleProcess} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="single-url-input" className="text-xs font-medium text-slate-400 block">
                      URL Portale Scuola
                    </label>
                    <input
                      id="single-url-input"
                      type="text"
                      placeholder="https://www.istitutoscolastico.edu.it"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors motion-reduce:transition-none"
                    />
                  </div>
                  <div className="sm:w-64 space-y-1.5">
                    <label htmlFor="single-nominativo-input" className="text-xs font-medium text-slate-400 block">
                      Nominativo (opzionale)
                    </label>
                    <input
                      id="single-nominativo-input"
                      type="text"
                      placeholder="es. Mario Rossi"
                      value={singleNominativo}
                      onChange={(e) => setSingleNominativo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors motion-reduce:transition-none"
                      title="Se inserito e il punteggio manca nel contratto, avvia la ricerca automatica nelle graduatorie d'istituto"
                    />
                  </div>
                  <div className="sm:self-end">
                    <button
                      type="submit"
                      disabled={isProcessingSingle || !singleUrl.trim()}
                      className="h-10 px-5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 w-full sm:w-auto"
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
                </div>
              </form>

              {!openRouterApiKey && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span><strong>OpenRouter API Key richiesta:</strong> Inserisci la tua API Key per sbloccare l'estrazione AI e la scansione della pagina.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-950"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configura Chiave</span>
                  </button>
                </div>
              )}

              {singleError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{singleError}</span>
                  </div>
                  {(!openRouterApiKey || singleError.includes("API Key") || singleError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
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
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    Log di Navigazione e Scansione
                  </h3>
                  <div className="font-mono text-xs max-h-64 overflow-auto bg-slate-950 border border-slate-800 rounded-md p-4 text-slate-400 space-y-1.5">
                    {singleResult.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-blue-400">›</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Structured Extraction Results */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      Dati Estratti tramite Gemini AI
                    </h3>
                    <button
                      onClick={exportSingleResultToCsv}
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors flex items-center gap-2 text-xs cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Download className="w-4 h-4" />
                      <span>Scarica CSV Risultato Singolo</span>
                    </button>
                  </div>

                  {/* Scuola & Codice Meccanografico Header */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Istituto Scolastico Rilevato</span>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <span>{singleResult.data.nome_istituto || "Istituto Scolastico"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-md flex flex-col items-start">
                        <span className="text-xs uppercase font-medium text-slate-400">Codice Meccanografico (C.M.)</span>
                        {isValidCodiceMeccanografico(singleResult.data.codice_meccanografico) ? (
                          <span className="text-sm font-mono font-bold text-blue-400">
                            {normalizeCodiceMeccanografico(singleResult.data.codice_meccanografico)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">
                            {singleResult.data.codice_meccanografico === "Non disponibile" ? "Non disponibile" : "Non individuato"}
                          </span>
                        )}
                      </div>
                      {singleResult.data.nominativo && (
                        <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-md flex flex-col items-start">
                          <span className="text-xs uppercase font-medium text-slate-400">Nominativo</span>
                          <span className="text-sm font-bold text-amber-300">
                            {singleResult.data.nominativo}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400">Convocazioni Personale</h4>
                      <ul className="space-y-2 text-sm font-medium">
                        <li className="flex justify-between items-center"><span className="text-slate-400">Collaboratore Scolastico:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_collaboratore_scolastico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Amministrativo:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_amministrativo}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Docenti:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_docenti}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Tecnico:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_tecnico}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Cuoco:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_cuoco}</span></li>
                        <li className="flex justify-between items-center"><span className="text-slate-400">Assistente Agrario:</span> <span className="font-bold text-white">{singleResult.data.convocazioni_assistente_agrario}</span></li>
                      </ul>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pensionamenti Personale</h4>
                      <ul className="space-y-2 text-sm font-medium">
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
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      Albo Pretorio & Contratti di Supplenza
                    </h3>
                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-md font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Zero Dati Personali (GDPR Safe)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Tipologia</span>
                      <span className={`text-sm font-bold ${singleResult.data.tipologia_personale === "DOCENTE" ? "text-amber-400" : "text-blue-400"}`}>
                        {singleResult.data.tipologia_personale || "ATA"}
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Tipo Posto</span>
                      <span className="text-sm font-bold text-slate-100 capitalize">{singleResult.data.tipo_posto || "comune"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">CDC / Area AT</span>
                      <span className="text-sm font-bold text-slate-100 font-mono">{singleResult.data.classe_concorso_area_lab || singleResult.data.classe_di_concorso || "Non applicabile"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Punteggio / Origine</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {singleResult.data.punteggio === "Da verificare manualmente" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="size-3 shrink-0" />
                            <span>Da verificare manualmente</span>
                          </span>
                        ) : singleResult.data.punteggio === null || singleResult.data.punteggio === undefined || singleResult.data.punteggio === "Non disponibile" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="size-3 shrink-0" />
                            <span>Non disponibile</span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {typeof singleResult.data.punteggio === "number" ? singleResult.data.punteggio.toFixed(2) : singleResult.data.punteggio}
                          </span>
                        )}
                        {singleResult.data.origine_punteggio && singleResult.data.punteggio !== null && singleResult.data.punteggio !== "Da verificare manualmente" && (
                          singleResult.data.origine_punteggio === "Esplicito" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="size-3 shrink-0" />
                              <span>Esplicito</span>
                            </span>
                          ) : singleResult.data.origine_punteggio === "Incrociato" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <GraduationCap className="size-3 shrink-0" />
                              <span>Incrociato</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="size-3 shrink-0" />
                              <span>{singleResult.data.origine_punteggio}</span>
                            </span>
                          )
                        )}
                      </div>
                      {singleResult.data.note_cross_reference && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2" title={singleResult.data.note_cross_reference}>
                          {singleResult.data.note_cross_reference}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Fascia Graduatoria</span>
                      <span className="text-sm font-bold text-slate-100">{singleResult.data.graduatoria_fascia || "Nessuna rilevata"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Profilo Lavorativo</span>
                      <span className="text-sm font-bold text-slate-100 truncate block">{singleResult.data.profilo_lavorativo || singleResult.data.profilo_professionale || "Nessun profilo"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Ore Settimanali</span>
                      <span className="text-sm font-bold text-slate-100">{singleResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block mb-1">Decorrenza</span>
                      <span className="text-sm font-bold text-slate-100">
                        {singleResult.data.decorrenza_contratto || (singleResult.data.decorrenza_da ? `${singleResult.data.decorrenza_da} - ${singleResult.data.decorrenza_a || "termine"}` : "N/D")}
                      </span>
                    </div>

                    {singleResult.data.nominativo && (
                      <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                        <span className="text-xs uppercase tracking-wider text-blue-400 font-medium block mb-1">Nominativo</span>
                        <span className="text-sm font-bold text-slate-100">{singleResult.data.nominativo}</span>
                      </div>
                    )}

                    {singleResult.data.pagine_graduatoria_esplorate && singleResult.data.pagine_graduatoria_esplorate.length > 0 && (
                      <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 col-span-2 sm:col-span-4">
                        <span className="text-xs uppercase tracking-wider text-blue-400 font-medium block mb-1">
                          Pagine Graduatorie Esplorate ({singleResult.data.pagine_graduatoria_esplorate.length}/5 max)
                        </span>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {singleResult.data.pagine_graduatoria_esplorate.map((pageUrl, pIdx) => (
                            <li key={pIdx} className="truncate">
                              <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-400">
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
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
                    <FileText className="size-[22px] text-blue-400" />
                    Modulo Albo Pretorio & Estrazione Contratti PDF
                  </h2>
                  <p className="text-sm font-medium text-slate-400 mt-1">
                    Scansione automatica dell'Albo Pretorio scolastico negli ultimi 6 mesi, download temporaneo degli allegati PDF ed estrazione sicura tramite Gemini AI.
                  </p>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  100% Privacy & Zero PII
                </span>
              </div>

              {/* Filtering Specs Box */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-md p-4 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-blue-400 flex items-center gap-1">
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
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  1. Test Scansione Albo Pretorio da URL Istituto
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Inserisci l'home page o il link dell'istituto: il motore individua la sezione Albo Pretorio, filtra gli atti conformi e scarica gli allegati PDF per l'analisi.
                </p>
              </div>

              <form onSubmit={handleAlboScan} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label htmlFor="albo-url-input" className="sr-only">
                      URL Portale Istituto per scansione Albo Pretorio
                    </label>
                    <input
                      id="albo-url-input"
                      type="text"
                      placeholder="https://www.comprensivomilano.edu.it"
                      value={alboUrlInput}
                      onChange={(e) => setAlboUrlInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors motion-reduce:transition-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isScanningAlbo || !alboUrlInput.trim()}
                    className="h-10 px-5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{alboScanError}</span>
                  </div>
                  {(!openRouterApiKey || alboScanError.includes("API Key") || alboScanError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
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
                    <h3 className="text-base font-semibold text-slate-100">
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
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Esporta Nomine Albo in CSV (11 Colonne)</span>
                    </button>
                  </div>

                  {/* Summary Grid with Counter Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                      <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <Globe className="size-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-400 block truncate">Albo Pretorio</span>
                        <span className="text-sm font-bold text-slate-100 truncate block">
                          {alboScanResult.alboUrl ? "Identificato" : "Non trovato"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                      <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="size-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-400 block truncate">Atti Conformi</span>
                        <span className="text-lg font-bold text-slate-100 font-mono block">
                          {alboScanResult.contratti?.length ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                      <div className="size-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                        <Layers className="size-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-400 block truncate">Fascia Graduatoria</span>
                        <span className="text-sm font-bold text-slate-100 truncate block">
                          {alboScanResult.graduatoria_fascia || "N/D"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex items-center gap-4 transition-colors">
                      <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <Briefcase className="size-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-400 block truncate">Profilo Rilevato</span>
                        <span className="text-sm font-bold text-slate-100 truncate block" title={alboScanResult.profilo_professionale}>
                          {alboScanResult.profilo_professionale || "N/D"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Logs */}
                  {alboScanResult.logs && (
                    <div className="font-mono text-xs max-h-64 overflow-auto bg-slate-950 border border-slate-800 rounded-md p-4 text-slate-400 space-y-1.5">
                      {alboScanResult.logs.map((log: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-blue-400">›</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contracts List */}
                  {alboScanResult.contratti && alboScanResult.contratti.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Dettaglio Contratti e Documenti PDF Estratti
                      </h4>
                      {alboScanResult.contratti.map((item: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-semibold text-sm text-slate-100">{item.titolo}</span>
                            {item.data_pubblicazione && (
                              <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md self-start">
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
                              <a href={item.pdf_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1">
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
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  2. Upload Diretto File PDF di Contratto / Bando Scolastico
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Trascina o carica direttamente un file PDF di nomina o contratto di supplenza per verificare l'estrazione strutturata delle 6 variabili e la totale privacy (zero PII estratti).
                </p>
              </div>

              <form onSubmit={handlePdfUploadAndExtract} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <label htmlFor="direct-pdf-upload-input" className="sr-only">
                      Carica file PDF di contratto o bando scolastico
                    </label>
                    <input
                      id="direct-pdf-upload-input"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-1.5 text-sm text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-400 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors motion-reduce:transition-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isExtractingPdf || !selectedPdfFile}
                    className="h-10 px-5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{pdfExtractError}</span>
                  </div>
                  {(!openRouterApiKey || pdfExtractError.includes("API Key") || pdfExtractError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
                </div>
              )}

              {pdfExtractResult && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-4 gap-3">
                    <div>
                      <span className="text-xs text-slate-400 block">File Elaborato:</span>
                      <span className="text-sm font-semibold text-slate-100">{pdfExtractResult.filename}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
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
                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica CSV (11 Colonne)</span>
                      </button>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Memoria Pulita
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Tipologia</span>
                      <span className={`text-sm font-bold ${pdfExtractResult.data.tipologia_personale === "DOCENTE" ? "text-amber-400" : "text-blue-400"}`}>
                        {pdfExtractResult.data.tipologia_personale || "ATA"}
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Tipo Posto</span>
                      <span className="text-sm font-bold text-slate-100 capitalize">{pdfExtractResult.data.tipo_posto || "comune"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">CDC / Area AT</span>
                      <span className="text-sm font-bold text-slate-100 font-mono">{pdfExtractResult.data.classe_concorso_area_lab || pdfExtractResult.data.classe_di_concorso || "Non applicabile"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Punteggio / Origine</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pdfExtractResult.data.punteggio === "Da verificare manualmente" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="size-3 shrink-0" />
                            <span>Da verificare manualmente</span>
                          </span>
                        ) : pdfExtractResult.data.punteggio === null || pdfExtractResult.data.punteggio === undefined || pdfExtractResult.data.punteggio === "Non disponibile" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="size-3 shrink-0" />
                            <span>Non disponibile</span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {typeof pdfExtractResult.data.punteggio === "number" ? pdfExtractResult.data.punteggio.toFixed(2) : pdfExtractResult.data.punteggio}
                          </span>
                        )}
                        {pdfExtractResult.data.origine_punteggio && pdfExtractResult.data.punteggio !== null && pdfExtractResult.data.punteggio !== "Da verificare manualmente" && (
                          pdfExtractResult.data.origine_punteggio === "Esplicito" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="size-3 shrink-0" />
                              <span>Esplicito</span>
                            </span>
                          ) : pdfExtractResult.data.origine_punteggio === "Incrociato" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <GraduationCap className="size-3 shrink-0" />
                              <span>Incrociato</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="size-3 shrink-0" />
                              <span>{pdfExtractResult.data.origine_punteggio}</span>
                            </span>
                          )
                        )}
                      </div>
                      {pdfExtractResult.data.note_cross_reference && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2" title={pdfExtractResult.data.note_cross_reference}>
                          {pdfExtractResult.data.note_cross_reference}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Graduatoria Fascia</span>
                      <span className="text-sm font-bold text-slate-100">{pdfExtractResult.data.fascia || pdfExtractResult.data.graduatoria_fascia || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Posizione Graduatoria</span>
                      <span className="text-sm font-bold text-slate-100">{pdfExtractResult.data.posizione_graduatoria || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Profilo Lavorativo</span>
                      <span className="text-sm font-bold text-slate-100 truncate block" title={pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale}>
                        {pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale || "N/D"}
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Ore Settimanali</span>
                      <span className="text-sm font-bold text-slate-100">{pdfExtractResult.data.ore_settimanali || "N/D"}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 sm:col-span-2">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Decorrenza Contratto</span>
                      <span className="text-sm font-bold text-slate-100">
                        {pdfExtractResult.data.decorrenza_contratto || (pdfExtractResult.data.decorrenza_da ? `${pdfExtractResult.data.decorrenza_da} - ${pdfExtractResult.data.decorrenza_a || "termine"}` : "N/D")}
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 sm:col-span-2">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Durata Stimata</span>
                      <span className="text-sm font-bold text-slate-100">
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
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Google Data Search & Web Grounding
                </h2>
                <p className="text-sm font-medium text-slate-400 mt-1">
                  Cerca direttamente sul web tramite l'intelligenza artificiale e Google Search Grounding per trovare bandi ATA, graduatorie scolastiche e circolari di supplenza in tempo reale.
                </p>
              </div>

              <form onSubmit={handleGoogleSearch} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label htmlFor="google-search-query-input" className="sr-only">
                      Termine di ricerca per bandi e convocazioni scolastiche
                    </label>
                    <input
                      id="google-search-query-input"
                      type="text"
                      placeholder="es. Convocazioni ATA terza fascia Milano 2026"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors motion-reduce:transition-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-10 px-5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{searchError}</span>
                  </div>
                  {(!openRouterApiKey || searchError.includes("API Key") || searchError.includes("Impostazioni")) && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Inserisci API Key</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {searchResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-4 animate-fadeIn">
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Risultati della Ricerca Web (Grounding)
                </h3>
                <div className="bg-slate-950 rounded-md p-5 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed border border-slate-800 font-sans">
                  {searchResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: STORICO BATCH */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  Storico Estrazioni Batch ({batchHistory.length})
                </h2>
                <p className="text-sm font-medium text-slate-400 mt-1">
                  Storico locale delle sessioni di estrazione CSV salvate nel browser. Puoi ricaricare qualsiasi sessione precedente, esportarla o eliminarla.
                </p>
              </div>
              {batchHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="h-10 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Svuota Storico</span>
                </button>
              )}
            </div>

            {batchHistory.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center space-y-4">
                <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                  <Layers className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Nessuna estrazione salvata nello storico</h3>
                <p className="text-sm font-medium text-slate-400 max-w-md mx-auto">
                  Carica un file CSV nella sezione "Elaborazione Batch CSV" ed esegui l'estrazione per salvare automaticamente i risultati nello storico locale.
                </p>
                <button
                  onClick={() => setActiveTab("batch")}
                  className="h-10 px-5 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-md transition-colors inline-flex items-center gap-2 text-sm cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Vai a Elaborazione Batch</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {batchHistory.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                          {item.filename}
                        </span>
                        <span className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md font-medium">
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
                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md text-xs transition-colors motion-reduce:transition-none flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
                        title="Esporta in CSV (11 colonne)"
                        aria-label={`Esporta sessione storico ${item.filename} in formato CSV`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Esporta CSV</span>
                      </button>
                      <button
                        onClick={() => loadHistoryItem(item)}
                        className="h-10 px-4 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-md text-xs transition-colors motion-reduce:transition-none flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
                        aria-label={`Carica risultati sessione ${item.filename} nella dashboard`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Carica in Dashboard</span>
                      </button>
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="size-10 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950"
                        title="Elimina dallo storico"
                        aria-label={`Elimina sessione ${item.filename} dallo storico locale`}
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
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Code2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Architettura Consigliata e Flusso di Lavoro</h2>
                  <p className="text-sm font-medium text-slate-400">Dettagli tecnici dell'applicazione Node.js, Axios, Cheerio e Gemini AI</p>
                </div>
              </div>

              <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                <div className="bg-slate-950 p-5 rounded-md border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-base text-blue-400">
                    <span>1. Stack Tecnologico Consigliato</span>
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-xs">
                    <li><strong className="text-slate-100">Backend Runtime:</strong> Node.js con Express per gestire le richieste HTTP, l'upload dei file CSV e la sincronizzazione delle chiamate di scraping.</li>
                    <li><strong className="text-slate-100">Scraping & Parsing:</strong> Librerie <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">axios</code> per il fetch delle pagine web e <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">cheerio</code> per l'analisi del DOM HTML e la ricerca mirata di sezioni "ATA" o "Bandi di gara".</li>
                    <li><strong className="text-slate-100">Estrazione con LLM:</strong> SDK ufficiale <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">@google/genai</code> con il modello <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">gemini-2.5-flash</code> per l'estrazione strutturata tramite schema JSON rigoroso.</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-5 rounded-md border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-base text-blue-400">
                    <span>2. Flusso di Esecuzione Dettagliato</span>
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs">
                    <li><strong className="text-slate-100">Caricamento CSV:</strong> L'utente carica il file iniziale contenente l'elenco degli URL istituzionali.</li>
                    <li><strong className="text-slate-100">Scansione Homepage & Sottopagina:</strong> Per ogni URL, il server effettua una richiesta HTTP, analizza i link alla ricerca di parole chiave come <em className="text-slate-200">ATA</em>, <em className="text-slate-200">Bandi di gara</em>, <em className="text-slate-200">Graduatorie</em> o <em className="text-slate-200">Avvisi</em>, e scarica il testo combinato.</li>
                    <li><strong className="text-slate-100">Analisi IA:</strong> Il testo estratto viene inviato a Gemini con il prompt di sistema dedicato, garantendo un output JSON pulito e privo di testo superfluo.</li>
                    <li><strong className="text-slate-100">Generazione CSV:</strong> Tutti i dati vengono aggregati in un nuovo file CSV strutturato, pronto per il download immediato.</li>
                  </ol>
                </div>

                <div className="bg-slate-950 p-5 rounded-md border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-base text-blue-400">
                    <span>3. Prompt di Sistema per l'Estrazione</span>
                  </h3>
                  <pre className="bg-slate-900 p-4 rounded-md text-xs font-mono text-blue-200 overflow-x-auto border border-slate-800">
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

                <div className="bg-slate-950 p-5 rounded-md border border-slate-800 space-y-3">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-base text-emerald-400">
                    <span>4. Estensione Modulare: Albo Pretorio, Filtri 6 Mesi & Download PDF</span>
                  </h3>
                  <div className="space-y-3 text-slate-300 text-xs leading-relaxed">
                    <p>
                      L'estensione opera come un add-on autonomo mantenendo al 100% la retrocompatibilità con tutte le funzioni preesistenti.
                    </p>
                    <ul className="list-disc list-inside space-y-1.5">
                      <li><strong className="text-slate-100">Filtro 6 Mesi:</strong> Scansione limitata tassativamente agli atti pubblicati negli ultimi 6 mesi rispetto alla data odierna.</li>
                      <li><strong className="text-slate-100">Parole Chiave di Inclusione:</strong> <em className="text-slate-200">"Contratto di supplenza annuale"</em>, <em className="text-slate-200">"Contratto di supplenza breve"</em>, <em className="text-slate-200">"Contratto di supplenza"</em>.</li>
                      <li><strong className="text-slate-100">Parole Chiave di Esclusione:</strong> <em className="text-slate-200">"ASSEGNAZIONE AI PLESSI DEL PERSONALE ATA"</em>, <em className="text-slate-200">"CI_031 Assenze del personale docente e ATA"</em>, <em className="text-slate-200">"direttiva_ds"</em>, <em className="text-slate-200">"informativa sindacale"</em>.</li>
                      <li><strong className="text-slate-100">Gestione Memoria Rigorosa:</strong> I file PDF scaricati temporaneamente vengono memorizzati su disco e tassativamente eliminati all'interno di blocchi <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">try...finally</code> tramite <code className="bg-slate-900 text-blue-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">fs.promises.unlink</code>, sia in caso di successo che di errore.</li>
                      <li><strong className="text-slate-100">Tutela Assoluta della Privacy:</strong> Non viene estratto alcun nominativo, codice fiscale o dato anagrafico. Vengono estratti solo i campi contrattuali: <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">graduatoria_fascia</code>, <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">profilo_professionale</code>, <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">classe_di_concorso</code>, <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">ore_settimanali</code>, <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">decorrenza_da</code>, <code className="bg-slate-900 text-emerald-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">decorrenza_a</code>.</li>
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
