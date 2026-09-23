export type TipologiaPersonale = "ATA" | "DOCENTE";
export type TipoPosto = "comune" | "sostegno";
export type OriginePunteggio = "Esplicito" | "Incrociato" | "Non disponibile";

export interface GraduatoriaIstitutoEntry {
  posizione: number;
  punteggio: number;
  cognome_nome?: string;
  incluso_con_riserva?: boolean;
}

export interface GraduatoriaIstituto {
  id: string;
  codice_meccanografico?: string;
  nome_istituto?: string;
  tipologia_personale: TipologiaPersonale;
  profilo_o_cdc: string; // Es. "AA", "CS", "AT", "A-12", "A-22", "ADMM"
  fascia: string; // Es. "1", "2", "3", "Prima fascia", "Seconda fascia", "Terza fascia"
  anno_scolastico?: string;
  graduatoria: GraduatoriaIstitutoEntry[]; // ordinata per posizione o punteggio decrescente
}

export interface NominaContrattoItem {
  id?: string;
  nome_istituto: string;
  codice_meccanografico: string;
  tipologia_personale: TipologiaPersonale;
  profilo_lavorativo: string;
  classe_concorso_area_lab: string;
  tipo_posto: TipoPosto;
  classe_di_concorso?: string;
  punteggio: number | null;
  origine_punteggio?: OriginePunteggio;
  posizione_graduatoria: string;
  fascia: string;
  ore_settimanali: string;
  decorrenza_contratto: string;
  durata_contratto_mesi: string;
  durata_contratto_giorni: string;
  link_del_documento: string;
  note_cross_reference?: string;
}

export interface AlboPretorioContract {
  id?: string;
  titolo_bando: string;
  data_pubblicazione?: string;
  pdf_url?: string;
  tipologia_personale?: TipologiaPersonale;
  profilo_professionale: string;
  classe_concorso_area_lab?: string;
  classe_di_concorso?: string;
  tipo_posto?: TipoPosto;
  graduatoria_fascia: string;
  punteggio?: number | null;
  origine_punteggio?: OriginePunteggio;
  posizione_graduatoria?: string;
  ore_settimanali: string;
  decorrenza_da: string;
  decorrenza_a: string;
  note_filtro?: string;
  note_cross_reference?: string;
}

export interface ExtractionData {
  nome_istituto?: string;
  codice_meccanografico?: string;
  nomine_contratti?: NominaContrattoItem[];

  convocazioni_collaboratore_scolastico: number;
  convocazioni_assistente_amministrativo: number;
  convocazioni_docenti: number;
  convocazioni_assistente_tecnico: number;
  convocazioni_cuoco: number;
  convocazioni_assistente_agrario: number;
  pensionamenti_collaboratore_scolastico: number;
  pensionamenti_assistente_amministrativo: number;
  pensionamenti_docenti: number;
  pensionamenti_assistente_tecnico: number;
  pensionamenti_cuoco: number;
  pensionamenti_assistente_agrario: number;

  // Nuovi campi ATA + Docenti
  tipologia_personale?: TipologiaPersonale;
  classe_concorso_area_lab?: string;
  tipo_posto?: TipoPosto;
  profilo_lavorativo?: string;

  // Retrocompatibilità & campi singoli
  graduatoria_fascia?: string;
  punteggio?: number | null;
  origine_punteggio?: OriginePunteggio;
  posizione_graduatoria?: string;
  profilo_professionale?: string;
  classe_di_concorso?: string;
  ore_settimanali?: string;
  decorrenza_da?: string;
  decorrenza_a?: string;
  decorrenza_contratto?: string;
  durata_contratto_mesi?: string;
  durata_contratto_giorni?: string;
  link_del_documento?: string;
  albo_contratti?: AlboPretorioContract[];
  note_cross_reference?: string;
}

export interface ExtractionResult {
  url: string;
  navigatedUrl: string;
  status: "success" | "error";
  error?: string;
  logs: string[];
  data: ExtractionData;
}

export interface BatchHistoryItem {
  id: string;
  filename: string;
  timestamp: string;
  totalUrls: number;
  results: ExtractionResult[];
}
