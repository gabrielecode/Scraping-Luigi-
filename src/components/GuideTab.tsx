import React from "react";
import { HelpCircle, CheckCircle2, ShieldCheck, Database, FileSpreadsheet } from "lucide-react";

export function GuideTab() {
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <HelpCircle className="size-[22px] text-blue-400" />
            Guida all'Uso & Specifiche Tecniche
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Manuale operativo per il trattamento delle graduatorie ATA e Docenti, scansione Albi Pretori e conformità GDPR.
          </p>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Conformità GDPR & Zero PII
            </h3>
            <p className="text-xs text-slate-400">
              L'applicazione opera nel totale rispetto delle normative sulla privacy e protezione dei dati personali. I dati estratti riguardano esclusivamente dati istituzionali, codici meccanografici e posizioni in graduatoria destinate alla trasparenza amministrativa della Pubblica Amministrazione scolastica.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Incrocio Graduatorie d'Istituto
            </h3>
            <p className="text-xs text-slate-400">
              Il modulo integrato consente di caricare le graduatorie di istituto in formato CSV. Quando un contratto o un avviso menziona un candidato senza esplicitare il punteggio, il sistema esegue un incrociamento automatico per determinare il punteggio e la fascia di appartenenza.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Tracciati Ministeriali Unificati
            </h3>
            <p className="text-xs text-slate-400">
              I report esportati in CSV o Excel (.xlsx) strutturano i dati in colonne standardizzate per il personale ATA (Collaboratore Scolastico, Assistente Amministrativo, Assistente Tecnico, Cuoco, Guardarobiere, Operatore Scolastico) e DOCENTE (Classi di Concorso, Sostegno, Posto Comune).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
