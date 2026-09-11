export interface ExtractionData {
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
}

export interface ExtractionResult {
  url: string;
  navigatedUrl: string;
  status: "success" | "error";
  error?: string;
  logs: string[];
  data: ExtractionData;
}
