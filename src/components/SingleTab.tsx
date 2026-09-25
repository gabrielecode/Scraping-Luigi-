import React from "react";
import { 
  Search, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Terminal, 
  ShieldCheck, 
  Key, 
  FileText, 
  Briefcase, 
  ExternalLink, 
  AlertTriangle,
  GraduationCap
} from "lucide-react";
import { ExtractionResult } from "../types";
import { isValidCodiceMeccanografico, normalizeCodiceMeccanografico } from "../services/graduatorieService";

interface SingleTabProps {
  singleUrl: string;
  setSingleUrl: (s: string) => void;
  singleNominativo: string;
  setSingleNominativo: (s: string) => void;
  isProcessingSingle: boolean;
  handleSingleProcess: (e: React.FormEvent) => void;
  singleResult: ExtractionResult | null;
  singleError: string;
  openRouterApiKey: string;
  setIsSettingsOpen: (b: boolean) => void;
  exportSingleResultToCsv: () => void;
}

export function SingleTab({
  singleUrl,
  setSingleUrl,
  singleNominativo,
  setSingleNominativo,
  isProcessingSingle,
  handleSingleProcess,
  singleResult,
  singleError,
  openRouterApiKey,
  setIsSettingsOpen,
  exportSingleResultToCsv
}: SingleTabProps) {
  return (
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
                        <span className="font-semibold text-sm text-slate-100">{contratto.titolo_bando}</span>
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
  );
}
