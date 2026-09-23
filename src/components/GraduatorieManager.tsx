import React, { useState } from "react";
import {
  GraduatoriaIstituto,
  GraduatoriaIstitutoEntry,
  TipologiaPersonale
} from "../types";
import {
  saveStoredGraduatorie,
  parseGraduatoriaText,
  normalizeProfiloOrCdc
} from "../services/graduatorieService";
import {
  GraduationCap,
  Plus,
  Trash2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Search,
  BookOpen,
  ArrowRight,
  Database,
  Sparkles,
  Download
} from "lucide-react";

interface GraduatorieManagerProps {
  graduatorie: GraduatoriaIstituto[];
  onUpdateGraduatorie: (list: GraduatoriaIstituto[]) => void;
}

export const GraduatorieManager: React.FC<GraduatorieManagerProps> = ({
  graduatorie,
  onUpdateGraduatorie,
}) => {
  const [selectedGrad, setSelectedGrad] = useState<GraduatoriaIstituto | null>(
    graduatorie.length > 0 ? graduatorie[0] : null
  );

  // New graduatoria modal / form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCodice, setNewCodice] = useState("");
  const [newIstituto, setNewIstituto] = useState("");
  const [newTipologia, setNewTipologia] = useState<TipologiaPersonale>("ATA");
  const [newProfilo, setNewProfilo] = useState("CS");
  const [newFascia, setNewFascia] = useState("3");
  const [newAnno, setNewAnno] = useState("2024/2027");
  const [rawText, setRawText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [importStatus, setImportStatus] = useState<string>("");

  const handleCreateGraduatoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      alert("Incolla o carica il testo/elenco della graduatoria (es. posizione, punteggio, nominativo).");
      return;
    }

    const created = parseGraduatoriaText(rawText, {
      codice_meccanografico: newCodice,
      nome_istituto: newIstituto,
      tipologia_personale: newTipologia,
      profilo_o_cdc: newProfilo,
      fascia: newFascia,
      anno_scolastico: newAnno,
    });

    if (created.graduatoria.length === 0) {
      alert("Nessuna riga valida riconosciuta. Assicurati che ogni riga contenga almeno la posizione e il punteggio (es. '1 18.50' o '1;18,50;ROSSI M.').");
      return;
    }

    const updated = [created, ...graduatorie];
    onUpdateGraduatorie(updated);
    saveStoredGraduatorie(updated);
    setSelectedGrad(created);
    setShowAddModal(false);
    setRawText("");
    setImportStatus(`Importata con successo graduatoria con ${created.graduatoria.length} candidati!`);
    setTimeout(() => setImportStatus(""), 4000);
  };

  const handleDeleteGraduatoria = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Sei sicuro di voler eliminare questa graduatoria?")) return;
    const updated = graduatorie.filter(g => g.id !== id);
    onUpdateGraduatorie(updated);
    saveStoredGraduatorie(updated);
    if (selectedGrad?.id === id) {
      setSelectedGrad(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
    };
    reader.readAsText(file);
  };

  const filteredGraduatorie = graduatorie.filter(g => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (g.nome_istituto && g.nome_istituto.toLowerCase().includes(term)) ||
      (g.codice_meccanografico && g.codice_meccanografico.toLowerCase().includes(term)) ||
      g.profilo_o_cdc.toLowerCase().includes(term) ||
      g.fascia.toLowerCase().includes(term)
    );
  });

  const exportGraduatorieJson = () => {
    const blob = new Blob([JSON.stringify(graduatorie, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `graduatorie_istituto_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none">
          <GraduationCap className="w-48 h-48 text-indigo-400" />
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Incrocio Graduatorie d'Istituto (Cross-Referencing)</span>
            </div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <span>Database Graduatorie d'Istituto ATA & Docenti</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Quando una nomina o bando riporta la <strong>posizione in graduatoria</strong> ma non il punteggio esplicito (restituendo <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs">null</code>), l'algoritmo effettua l'incrocio automatico con queste graduatorie per ricavare il punteggio esatto assegnandogli l'origine <strong>"Incrociato"</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Importa Nuova Graduatoria</span>
            </button>
            <button
              onClick={exportGraduatorieJson}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
              title="Esporta le graduatorie salvate in formato JSON"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Esporta JSON</span>
            </button>
          </div>
        </div>

        {importStatus && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* Main Grid: List on Left, Candidate Table on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: List of saved graduatorie */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Graduatorie Salvate ({graduatorie.length})</span>
            </h3>
          </div>

          {/* Search filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filtra per scuola, codice o CDC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredGraduatorie.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs space-y-2">
                <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                <p>Nessuna graduatoria trovata.</p>
              </div>
            ) : (
              filteredGraduatorie.map((g) => {
                const isSelected = selectedGrad?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGrad(g)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? "bg-indigo-600/15 border-indigo-500/40 shadow-sm shadow-indigo-600/10"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              g.tipologia_personale === "DOCENTE"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {g.tipologia_personale}
                          </span>
                          <span className="text-xs font-mono font-bold text-white">
                            {g.profilo_o_cdc}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Fascia {g.fascia}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">
                          {g.nome_istituto || "Tutti gli istituti"}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          {g.codice_meccanografico && (
                            <span className="font-mono text-indigo-300">
                              {g.codice_meccanografico}
                            </span>
                          )}
                          <span>{g.graduatoria.length} candidati</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteGraduatoria(g.id, e)}
                        title="Elimina graduatoria"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Candidates in selected graduatoria */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {selectedGrad ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedGrad.tipologia_personale === "DOCENTE"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      }`}
                    >
                      {selectedGrad.tipologia_personale}
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      {selectedGrad.profilo_o_cdc}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Fascia {selectedGrad.fascia}
                    </span>
                    {selectedGrad.anno_scolastico && (
                      <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                        A.S. {selectedGrad.anno_scolastico}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {selectedGrad.nome_istituto || "Graduatoria d'Istituto"}
                  </h3>
                  {selectedGrad.codice_meccanografico && (
                    <p className="text-xs text-indigo-400 font-mono">
                      Codice Meccanografico: {selectedGrad.codice_meccanografico}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Totale candidati</div>
                  <div className="text-xl font-bold text-white font-mono">
                    {selectedGrad.graduatoria.length}
                  </div>
                </div>
              </div>

              {/* Table of entries */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 z-10">
                    <tr>
                      <th className="p-3 font-semibold text-center w-20">Posizione</th>
                      <th className="p-3 font-semibold text-center w-28 text-emerald-400">Punteggio</th>
                      <th className="p-3 font-semibold">Candidato / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedGrad.graduatoria.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-indigo-300">
                          #{entry.posizione}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-white bg-slate-950/40">
                          {entry.punteggio.toFixed(2)}
                        </td>
                        <td className="p-3 text-slate-300">
                          {entry.cognome_nome || (
                            <span className="text-slate-500 italic">Dato riservato (Posizione #{entry.posizione})</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <GraduationCap className="w-12 h-12 mx-auto opacity-30 text-indigo-400" />
              <p className="text-sm">Nessuna graduatoria selezionata.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Carica una graduatoria
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add New Graduatoria */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <span>Importa Graduatoria d'Istituto</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGraduatoria} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Denominazione Scuola</label>
                  <input
                    type="text"
                    placeholder="es. IC Ripa Teatina"
                    value={newIstituto}
                    onChange={(e) => setNewIstituto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Codice Meccanografico</label>
                  <input
                    type="text"
                    placeholder="es. CHIC81000A"
                    value={newCodice}
                    onChange={(e) => setNewCodice(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Tipologia Personale</label>
                  <select
                    value={newTipologia}
                    onChange={(e) => {
                      const t = e.target.value as TipologiaPersonale;
                      setNewTipologia(t);
                      if (t === "DOCENTE") setNewProfilo("A-22");
                      else setNewProfilo("CS");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ATA">Personale ATA</option>
                    <option value="DOCENTE">Personale DOCENTE</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Profilo ATA o CDC Docente</label>
                  <input
                    type="text"
                    placeholder={newTipologia === "DOCENTE" ? "es. A-12, A-22, ADMM" : "es. CS, AA, AT, AR02"}
                    value={newProfilo}
                    onChange={(e) => setNewProfilo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Fascia Graduatoria</label>
                  <select
                    value={newFascia}
                    onChange={(e) => setNewFascia(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="1">Prima fascia (Fascia 1 / 24 Mesi)</option>
                    <option value="2">Seconda fascia (Fascia 2)</option>
                    <option value="3">Terza fascia (Fascia 3)</option>
                    <option value="GI">Graduatoria d'Istituto generale</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Anno Scolastico / Validità</label>
                  <input
                    type="text"
                    placeholder="2024/2027"
                    value={newAnno}
                    onChange={(e) => setNewAnno(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Textarea / File input */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Elenco Candidati (Posizione, Punteggio, Nominativo opzionale)
                  </label>
                  <label className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-medium">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carica file CSV/TXT</span>
                    <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Incolla qui le righe copiate dal PDF o dal file CSV della graduatoria:\n1;19,80;ROSSI M.\n2;18,55;BIANCHI G.\n15;15,20;VERDI A.\n313;13,17\n342;12,57`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Formati supportati: CSV (<code className="text-indigo-300">pos;punteggio</code>) o testo tabellare copiato da PDF (<code className="text-indigo-300">1 19.80 CANDIDATO</code>). La virgola viene normalizzata automaticamente.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salva e Importa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
