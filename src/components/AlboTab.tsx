import React from "react";
import { 
  FileText, 
  Search, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Layers, 
  ShieldCheck, 
  Key, 
  Globe, 
  Briefcase, 
  Calendar, 
  Filter, 
  ExternalLink 
} from "lucide-react";
import { ExtractionResult } from "../types";
import { generateUnifiedCsvContent } from "../utils/exportUtils";

interface AlboTabProps {
  alboUrlInput: string;
  setAlboUrlInput: (s: string) => void;
  isScanningAlbo: boolean;
  handleAlboScan: (e: React.FormEvent) => void;
  alboScanResult: any | null;
  alboScanError: string;
  openRouterApiKey: string;
  setIsSettingsOpen: (b: boolean) => void;
  selectedPdfFile: File | null;
  setSelectedPdfFile: (f: File | null) => void;
  isExtractingPdf: boolean;
  handlePdfExtract: (e: React.FormEvent) => void;
  pdfExtractResult: any | null;
  pdfExtractError: string;
}

export function AlboTab({
  alboUrlInput,
  setAlboUrlInput,
  isScanningAlbo,
  handleAlboScan,
  alboScanResult,
  alboScanError,
  openRouterApiKey,
  setIsSettingsOpen,
  selectedPdfFile,
  setSelectedPdfFile,
  isExtractingPdf,
  handlePdfExtract,
  pdfExtractResult,
  pdfExtractError
}: AlboTabProps) {
  return (
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
                {alboScanResult.contratti.map((c: any, cIdx: number) => (
                  <div key={cIdx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{c.titolo_bando}</span>
                      <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md font-mono">
                        {c.data_pubblicazione || "Data non indicata"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
                      <div><span className="text-slate-500">Profilo:</span> {c.profilo_professionale}</div>
                      <div><span className="text-slate-500">Fascia:</span> {c.graduatoria_fascia}</div>
                      <div><span className="text-slate-500">Ore:</span> {c.ore_settimanali}</div>
                      <div><span className="text-slate-500">Decorrenza:</span> {c.decorrenza_da} - {c.decorrenza_a}</div>
                    </div>
                    {c.pdf_url && (
                      <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-900">
                        <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Allegato PDF originale</span>
                        </a>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {c.note_filtro || "Conforme 6 mesi"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Upload & Extract Local PDF */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            2. Estrazione Diretta da File PDF Locale (Contratto / Bando / Graduatoria)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Carica un file PDF dal tuo dispositivo: il parser estrarrà il testo integrativo e l'AI strutturerà tutti i dati di nomina e punteggio nel rispetto della privacy.
          </p>
        </div>

        <form onSubmit={handlePdfExtract} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 text-sm text-slate-300 cursor-pointer"
              />
              {selectedPdfFile && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PDF pronto: {selectedPdfFile.name}</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isExtractingPdf || !selectedPdfFile}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0 cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
            >
              {isExtractingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisi PDF...</span>
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
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{pdfExtractError}</span>
          </div>
        )}

        {pdfExtractResult && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Risultato Analisi PDF
              </h4>
              <span className="text-xs font-mono text-slate-400">
                {pdfExtractResult.charsExtracted} caratteri estratti
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-md">
                <span className="text-slate-400 block mb-1">Istituto</span>
                <span className="font-bold text-white truncate block">{pdfExtractResult.data.nome_istituto || "N/D"}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-md">
                <span className="text-slate-400 block mb-1">Codice Mecc.</span>
                <span className="font-bold text-blue-400 font-mono">{pdfExtractResult.data.codice_meccanografico || "N/D"}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-md">
                <span className="text-slate-400 block mb-1">Profilo</span>
                <span className="font-bold text-white">{pdfExtractResult.data.profilo_lavorativo || pdfExtractResult.data.profilo_professionale || "N/D"}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-md">
                <span className="text-slate-400 block mb-1">Punteggio</span>
                <span className="font-bold text-amber-300 font-mono">{pdfExtractResult.data.punteggio ?? "Non disponibile"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Testo Estratto dal PDF (Anteprima)</span>
              <div className="font-mono text-xs max-h-40 overflow-auto bg-slate-900 border border-slate-800 rounded-md p-3 text-slate-300 whitespace-pre-wrap">
                {pdfExtractResult.rawText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
