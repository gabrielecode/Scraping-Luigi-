import { ExtractionResult } from "../types";
import { escapeCsvField, cleanFieldString } from "../services/graduatorieService";

export function generateUnifiedCsvContent(results: ExtractionResult[]): string {
  const headers = [
    "URL",
    "Istituto",
    "Codice Meccanografico",
    "Tipologia Personale",
    "Profilo Lavorativo / Professionale",
    "Classe Concorso / Area Lab",
    "Tipo Posto",
    "Nominativo",
    "Punteggio",
    "Origine Punteggio",
    "Posizione Graduatoria",
    "Fascia Graduatoria",
    "Ore Settimanali",
    "Decorrenza Contratto",
    "Conv. Collaboratore Scolastico",
    "Conv. Assistente Amministrativo",
    "Conv. Docenti",
    "Conv. Assistente Tecnico",
    "Conv. Cuoco",
    "Conv. Assistente Agrario",
    "Pens. Collaboratore Scolastico",
    "Pens. Assistente Amministrativo",
    "Pens. Docenti",
    "Pens. Assistente Tecnico",
    "Pens. Cuoco",
    "Pens. Assistente Agrario",
    "Note Cross Reference"
  ];

  const rows: string[][] = [headers];

  for (const r of results) {
    const data = r.data;
    const baseRow = [
      escapeCsvField(r.url || ""),
      escapeCsvField(data.nome_istituto || ""),
      escapeCsvField(data.codice_meccanografico || ""),
      escapeCsvField(data.tipologia_personale || "ATA"),
      escapeCsvField(data.profilo_lavorativo || data.profilo_professionale || ""),
      escapeCsvField(data.classe_concorso_area_lab || data.classe_di_concorso || ""),
      escapeCsvField(data.tipo_posto || "comune"),
      escapeCsvField(data.nominativo || ""),
      escapeCsvField(data.punteggio !== null && data.punteggio !== undefined ? String(data.punteggio) : ""),
      escapeCsvField(data.origine_punteggio || ""),
      escapeCsvField(data.posizione_graduatoria || ""),
      escapeCsvField(data.graduatoria_fascia || ""),
      escapeCsvField(data.ore_settimanali || ""),
      escapeCsvField(data.decorrenza_contratto || (data.decorrenza_da ? `${data.decorrenza_da} - ${data.decorrenza_a || ""}` : "")),
      escapeCsvField(String(data.convocazioni_collaboratore_scolastico ?? 0)),
      escapeCsvField(String(data.convocazioni_assistente_amministrativo ?? 0)),
      escapeCsvField(String(data.convocazioni_docenti ?? 0)),
      escapeCsvField(String(data.convocazioni_assistente_tecnico ?? 0)),
      escapeCsvField(String(data.convocazioni_cuoco ?? 0)),
      escapeCsvField(String(data.convocazioni_assistente_agrario ?? 0)),
      escapeCsvField(String(data.pensionamenti_collaboratore_scolastico ?? 0)),
      escapeCsvField(String(data.pensionamenti_assistente_amministrativo ?? 0)),
      escapeCsvField(String(data.pensionamenti_docenti ?? 0)),
      escapeCsvField(String(data.pensionamenti_assistente_tecnico ?? 0)),
      escapeCsvField(String(data.pensionamenti_cuoco ?? 0)),
      escapeCsvField(String(data.pensionamenti_assistente_agrario ?? 0)),
      escapeCsvField(data.note_cross_reference || "")
    ];

    if (data.nomine_contratti && data.nomine_contratti.length > 0) {
      for (const nom of data.nomine_contratti) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(nom.tipologia_personale || data.tipologia_personale || "ATA"),
          escapeCsvField(nom.profilo_lavorativo || ""),
          escapeCsvField(nom.classe_concorso_area_lab || ""),
          escapeCsvField(nom.tipo_posto || "comune"),
          escapeCsvField(nom.nominativo || ""),
          escapeCsvField(nom.punteggio !== null && nom.punteggio !== undefined ? String(nom.punteggio) : ""),
          escapeCsvField(data.origine_punteggio || ""),
          escapeCsvField(nom.posizione_graduatoria || ""),
          escapeCsvField(nom.fascia || data.graduatoria_fascia || ""),
          escapeCsvField(nom.ore_settimanali || ""),
          escapeCsvField(nom.decorrenza_contratto || ""),
          escapeCsvField(String(data.convocazioni_collaboratore_scolastico ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_amministrativo ?? 0)),
          escapeCsvField(String(data.convocazioni_docenti ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_tecnico ?? 0)),
          escapeCsvField(String(data.convocazioni_cuoco ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_agrario ?? 0)),
          escapeCsvField(String(data.pensionamenti_collaboratore_scolastico ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_amministrativo ?? 0)),
          escapeCsvField(String(data.pensionamenti_docenti ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_tecnico ?? 0)),
          escapeCsvField(String(data.pensionamenti_cuoco ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_agrario ?? 0)),
          escapeCsvField(data.note_cross_reference || "")
        ]);
      }
    } else if (data.albo_contratti && data.albo_contratti.length > 0) {
      for (const alb of data.albo_contratti) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(alb.tipologia_personale || "ATA"),
          escapeCsvField(alb.profilo_professionale || ""),
          escapeCsvField(alb.classe_concorso_area_lab || alb.classe_di_concorso || ""),
          escapeCsvField(alb.tipo_posto || "comune"),
          escapeCsvField(alb.nominativo || ""),
          escapeCsvField(alb.punteggio !== null && alb.punteggio !== undefined ? String(alb.punteggio) : ""),
          escapeCsvField(alb.origine_punteggio || ""),
          escapeCsvField(alb.posizione_graduatoria || ""),
          escapeCsvField(alb.graduatoria_fascia || ""),
          escapeCsvField(alb.ore_settimanali || ""),
          escapeCsvField(alb.decorrenza_da ? `${alb.decorrenza_da} - ${alb.decorrenza_a || ""}` : ""),
          escapeCsvField(String(data.convocazioni_collaboratore_scolastico ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_amministrativo ?? 0)),
          escapeCsvField(String(data.convocazioni_docenti ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_tecnico ?? 0)),
          escapeCsvField(String(data.convocazioni_cuoco ?? 0)),
          escapeCsvField(String(data.convocazioni_assistente_agrario ?? 0)),
          escapeCsvField(String(data.pensionamenti_collaboratore_scolastico ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_amministrativo ?? 0)),
          escapeCsvField(String(data.pensionamenti_docenti ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_tecnico ?? 0)),
          escapeCsvField(String(data.pensionamenti_cuoco ?? 0)),
          escapeCsvField(String(data.pensionamenti_assistente_agrario ?? 0)),
          escapeCsvField(alb.note_cross_reference || data.note_cross_reference || "")
        ]);
      }
    } else {
      rows.push(baseRow);
    }
  }

  return rows.map(r => r.join(",")).join("\n");
}
