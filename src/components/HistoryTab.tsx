import React from "react";
import { Clock, Trash2, ExternalLink, Download } from "lucide-react";
import { BatchHistoryItem } from "../types";

interface HistoryTabProps {
  batchHistory: BatchHistoryItem[];
  loadHistoryItem: (item: BatchHistoryItem) => void;
  deleteHistoryItem: (id: string, e: React.MouseEvent) => void;
  clearHistory: () => void;
  exportBatchResultsToCsvFromHistory: (item: BatchHistoryItem) => void;
}

export function HistoryTab({
  batchHistory,
  loadHistoryItem,
  deleteHistoryItem,
  clearHistory,
  exportBatchResultsToCsvFromHistory
}: HistoryTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <Clock className="size-[22px] text-blue-400" />
              Storico Estrazioni Batch & Sessioni
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              Archivio locale delle sessioni di estrazione completate. Puoi ricaricare o esportare i risultati in qualsiasi momento.
            </p>
          </div>
          {batchHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="h-10 px-4 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-medium rounded-md transition-colors flex items-center gap-2 text-xs cursor-pointer focus-visible:ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950 self-start sm:self-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>Svuota Storico</span>
            </button>
          )}
        </div>

        {batchHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2 bg-slate-950 border border-slate-800 rounded-lg">
            <Clock className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">Nessuna sessione salvata nello storico.</p>
            <p className="text-xs text-slate-600">Le sessioni batch completate appariranno qui automaticamente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batchHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => loadHistoryItem(item)}
                className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{item.filename}</span>
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      {item.totalUrls} istituti
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Salvato il: {item.timestamp}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportBatchResultsToCsvFromHistory(item);
                    }}
                    className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-800"
                    title="Esporta CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadHistoryItem(item);
                    }}
                    className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Apri</span>
                  </button>
                  <button
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    className="h-9 w-9 bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-md transition-colors flex items-center justify-center border border-slate-800"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
