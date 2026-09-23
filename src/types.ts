export interface NominaContrattoItem {
  id?: string;
  nome_istituto: string;
  codice_meccanografico: string;
  profilo_lavorativo: string;
  classe_di_concorso: string;
  punteggio: string;
  posizione_graduatoria: string;
  fascia: string;
  ore_settimanali: string;
  decorrenza_contratto: string;
  durata_contratto_mesi: string;
  durata_contratto_giorni: string;
  link_del_documento: string;
}

export interface AlboPretorioContract {
  id?: string;
  titolo_bando: string;
  data_pubblicazione?: string;
  pdf_url?: string;
  graduatoria_fascia: string;
  punteggio?: string;
  posizione_graduatoria?: string;
  profilo_professionale: string;
  classe_di_concorso: string;
  ore_settimanali: string;
  decorrenza_da: string;
  decorrenza_a: string;
  note_filtro?: string;
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

  // Retrocompatibilità & campi singoli
  graduatoria_fascia?: string;
  punteggio?: string;
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
