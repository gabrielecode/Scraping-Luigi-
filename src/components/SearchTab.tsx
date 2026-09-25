import React from "react";
import { Search, Play, Loader2, AlertCircle, ExternalLink, Globe } from "lucide-react";

interface SearchTabProps {
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  isSearching: boolean;
  handleGoogleSearch: (e: React.FormEvent) => void;
  searchResult: string;
  searchError: string;
}

export function SearchTab({
  searchQuery,
  setSearchQuery,
  isSearching,
  handleGoogleSearch,
  searchResult,
  searchError
}: SearchTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Search className="size-[22px] text-blue-400" />
            Ricerca Avanzata Portali Scolastici & Albi Pretori
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Cerca sul Web portali di istituti scolastici, delibere e bandi di convocazione tramite l'indicizzazione pubblica.
          </p>
        </div>

        <form onSubmit={handleGoogleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="search-query-input" className="sr-only">
                Chiave di ricerca portali scolastici
              </label>
              <input
                id="search-query-input"
                type="text"
                placeholder="es. IC Ripa Teatina albo pretorio convocazioni"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-md h-10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus-visible:ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 transition-colors"
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
                  <Play className="w-4 h-4 fill-current" />
                  <span>Cerca sul Web</span>
                </>
              )}
            </button>
          </div>
        </form>

        {searchError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-md text-sm flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {searchResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4 animate-fadeIn">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Risultati della Ricerca
          </h3>
          <div className="font-mono text-xs max-h-96 overflow-auto bg-slate-950 border border-slate-800 rounded-md p-4 text-slate-300 whitespace-pre-wrap">
            {searchResult}
          </div>
        </div>
      )}
    </div>
  );
}
