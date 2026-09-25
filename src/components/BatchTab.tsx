import React from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Layers, 
  Terminal, 
  Key, 
  Trash2, 
  AlertTriangle 
} from "lucide-react";
import { ExtractionResult } from "../types";
import { isValidCodiceMeccanografico, normalizeCodiceMeccanografico } from "../services/graduatorieService";

interface BatchTabProps {
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  singleNominativo: string;
  setSingleNominativo: (s: string) => void;
  isProcessingBatch: boolean;
  handleBatchProcess: (e: React.FormEvent) => void;
  batchProgress: { current: number; total: number };
  batchLiveLog: string[];
  batchLogEndRef: React.RefObject<HTMLDivElement>;
  batchInfo: { currentBatch: number; totalBatches: number; batchSize: number; jobId?: string; finalMessage?: string; outputFilename?: string };
  batchResults: ExtractionResult[];
  batchError: string;
  openRouterApiKey: string;
  setIsSettingsOpen: (b: boolean) => void;
  exportBatchResultsToCsv: () => void;
  exportBatchResultsToXlsx: () => void;
  exportBatchResultsToJson: () => void;
  saveCurrentBatchToHistory: () => void;
  githubExportStatus: string;
  githubExportUrl: string;
  exportToGithub: () => void;
}

export function BatchTab({
  selectedFile,
  setSelectedFile,
  singleNominativo,
  setSingleNominativo,
  isProcessingBatch,
  handleBatchProcess,
  batchProgress,
  batchLiveLog,
  batchLogEndRef,
  batchInfo,
  batchResults,
  batchError,
  openRouterApiKey,
  setIsSettingsOpen,
  exportBatchResultsToCsv,
  exportBatchResultsToXlsx,
  exportBatchResultsToJson,
  saveCurrentBatchToHistory,
  githubExportStatus,
  githubExportUrl,
  exportToGithub
}: BatchTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Upload & Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileSpreadsheet className="size-[22px] text-blue-400" />
            Elaborazione Batch Istituti Scolastici (CSV / URL)
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Carica un file CSV contenente l'elenco degli URL delle scuole o inseriscili in batch. Il motore analizzerà automaticamente Albi Pretori, circolari e graduatorie.
          </p>
        </div>

        <form onSubmit={handleBatchProcess} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="csv-file-input" className="text-xs font-medium text-slate-400 block">
                File CSV con URL (colonna "url" o prima colonna)
              </label>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-xs file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 text-sm text-slate-300 cursor-pointer"
              />
              {selectedFile && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>File selezionato: {selectedFile.name}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="batch-nominativo-input" className="text-xs font-medium text-slate-400 block">
                Cerca Candidato (Opzionale)
              </label>
              <input
                id="batch-nominativo-input"
                type="text"
                placeholder="es. Mario Rossi"
                value={singleNominativo}
                onChange={(e) => setSingleNominativo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors"
                title="Se inserito, incrocerà le graduatorie d'istituto per estrarre il punteggio esatto"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">
              {batchResults.length > 0 ? `${batchResults.length} istituti elaborati con successo` : "Pronto per l'avvio"}
            </div>
            <button
              type="submit"
              disabled={isProcessingBatch || !selectedFile}
              className="h-10 px-6 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors motion-reduce:transition-none flex items-center gap-2 cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
            >
              {isProcessingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Elaborazione Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
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

      {/* Progress & Live Logs during Batch */}
      {isProcessingBatch && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Elaborazione Batch in Corso ({batchProgress.current}/{batchProgress.total})
            </span>
            <span className="text-xs font-mono text-blue-400">
              {Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%` }}
            />
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-400" /> Log di Navigazione in tempo reale
            </span>
            <div className="font-mono text-xs max-h-56 overflow-auto bg-slate-950 border border-slate-800 rounded-md p-4 text-slate-400 space-y-1">
              {batchLiveLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400">›</span>
                  <span>{log}</span>
                </div>
              ))}
              <div ref={batchLogEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Results Table & Export Controls */}
      {batchResults.length > 0 && !isProcessingBatch && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Risultati Elaborazione Batch ({batchResults.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tabella unificata conforme ai tracciati ministeriali ATA e DOCENTI.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={exportBatchResultsToCsv}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Esporta CSV Unificato</span>
              </button>
              <button
                type="button"
                onClick={exportBatchResultsToXlsx}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Esporta Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={exportBatchResultsToJson}
                className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-slate-500 ring-offset-2 ring-offset-slate-950"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Esporta JSON</span>
              </button>
              <button
                type="button"
                onClick={saveCurrentBatchToHistory}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-xs cursor-pointer focus-visible:ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Salva in Storico</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <th className="px-4 py-3">Istituto</th>
                  <th className="px-4 py-3 text-center">Codice Mecc.</th>
                  <th className="px-4 py-3 text-center">Personale</th>
                  <th className="px-4 py-3">Profilo / CDC</th>
                  <th className="px-4 py-3 text-center">Tipo Posto</th>
                  <th className="px-4 py-3 text-center">Pos. Grad.</th>
                  <th className="px-4 py-3 text-center">Punteggio</th>
                  <th className="px-4 py-3 text-center">Fascia</th>
                  <th className="px-4 py-3 text-center">Conv. Doc</th>
                  <th className="px-4 py-3 text-center">Conv. ATA</th>
                  <th className="px-4 py-3 text-center">Pens. Doc</th>
                  <th className="px-4 py-3 text-center">Pens. ATA</th>
                  <th className="px-4 py-3 text-center">Ore</th>
                  <th className="px-4 py-3 text-center">Decorrenza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-200">
                {batchResults.map((r, idx) => {
                  const totalConvAta = (r.data.convocazioni_collaboratore_scolastico || 0) +
                    (r.data.convocazioni_assistente_amministrativo || 0) +
                    (r.data.convocazioni_assistente_tecnico || 0) +
                    (r.data.convocazioni_cuoco || 0) +
                    (r.data.convocazioni_assistente_agrario || 0);

                  const totalPensAta = (r.data.pensionamenti_collaboratore_scolastico || 0) +
                    (r.data.pensionamenti_assistente_amministrativo || 0) +
                    (r.data.pensionamenti_assistente_tecnico || 0) +
                    (r.data.pensionamenti_cuoco || 0) +
                    (r.data.pensionamenti_assistente_agrario || 0);

                  const punt = r.data.punteggio;

                  return (
                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate" title={r.data.nome_istituto}>
                        {r.data.nome_istituto || r.url}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-blue-400">
                        {isValidCodiceMeccanografico(r.data.codice_meccanografico) ? normalizeCodiceMeccanografico(r.data.codice_meccanografico) : (r.data.codice_meccanografico || "-")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.data.tipologia_personale === "DOCENTE" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                          {r.data.tipologia_personale || "ATA"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-300">
                        {r.data.profilo_lavorativo || r.data.profilo_professionale || "Non specificato"}
                      </td>
                      <td className="px-4 py-3 text-center capitalize text-slate-300 font-medium">
                        {r.data.tipo_posto || "comune"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-300">
                        {r.data.posizione_graduatoria || "-"}
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
                                <CheckCircle2 className="size-3 shrink-0" />
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
  );
}
