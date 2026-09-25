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

    if (data.nomine_contratti && data.nomine_contratti.length > 0) {
      for (const nom of data.nomine_contratti) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(nom.tipologia_personale || "DOCENTE"),
          escapeCsvField(nom.profilo_lavorativo || (nom.tipologia_personale === "DOCENTE" ? "Docente Scuola Secondaria / Primaria" : "Collaboratore Scolastico")),
          escapeCsvField(nom.classe_concorso_area_lab || (nom.tipologia_personale === "DOCENTE" ? "Curricolare" : "CS")),
          escapeCsvField(nom.tipo_posto || "comune"),
          escapeCsvField(nom.nominativo || (nom.tipologia_personale === "DOCENTE" ? "Interpello aperto Docenti" : "Convocazione aperta ATA")),
          escapeCsvField(nom.punteggio !== null && nom.punteggio !== undefined && String(nom.punteggio) !== "" ? String(nom.punteggio) : "Da graduatoria d'istituto"),
          escapeCsvField(nom.origine_punteggio || data.origine_punteggio || "Da graduatoria d'istituto"),
          escapeCsvField(nom.posizione_graduatoria || "Da graduatoria d'istituto"),
          escapeCsvField(nom.fascia || data.graduatoria_fascia || "Graduatoria d'Istituto"),
          escapeCsvField(nom.ore_settimanali || (nom.tipologia_personale === "DOCENTE" ? "18 ore settimanali (Cattedra)" : "36 ore settimanali (Tempo pieno)")),
          escapeCsvField(nom.decorrenza_contratto || "Fino al termine delle attività didattiche (30/06/2026)"),
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
          escapeCsvField(nom.note_cross_reference || data.note_cross_reference || "")
        ]);
      }
    } else if (data.albo_contratti && data.albo_contratti.length > 0) {
      for (const alb of data.albo_contratti) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(alb.tipologia_personale || "DOCENTE"),
          escapeCsvField(alb.profilo_professionale || (alb.tipologia_personale === "DOCENTE" ? "Docente" : "Personale ATA")),
          escapeCsvField(alb.classe_concorso_area_lab || alb.classe_di_concorso || (alb.tipologia_personale === "DOCENTE" ? "Curricolare" : "CS")),
          escapeCsvField(alb.tipo_posto || "comune"),
          escapeCsvField(alb.nominativo || "Interpello / Selezione aperta"),
          escapeCsvField(alb.punteggio !== null && alb.punteggio !== undefined && String(alb.punteggio) !== "" ? String(alb.punteggio) : "Da graduatoria d'istituto"),
          escapeCsvField(alb.origine_punteggio || "Da bando/graduatoria"),
          escapeCsvField(alb.posizione_graduatoria || "Da graduatoria d'istituto"),
          escapeCsvField(alb.graduatoria_fascia || "Graduatoria d'Istituto"),
          escapeCsvField(alb.ore_settimanali || (alb.tipologia_personale === "DOCENTE" ? "18 ore settimanali" : "36 ore settimanali")),
          escapeCsvField(alb.decorrenza_da ? `${alb.decorrenza_da} - ${alb.decorrenza_a || "30/06/2026"}` : "Fino al termine delle attività didattiche (30/06/2026)"),
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
      // Fallback avanzato: se ci sono convocazioni docenti o ATA, emette le relative righe compilate
      const hasDoc = (data.convocazioni_docenti || 0) > 0;
      const hasATA = (data.convocazioni_collaboratore_scolastico || 0) > 0 || (data.convocazioni_assistente_amministrativo || 0) > 0;

      if (hasDoc) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField("DOCENTE"),
          escapeCsvField("Docente Scuola Secondaria / Primaria"),
          escapeCsvField("Materie Curricolari / Sostegno"),
          escapeCsvField("comune"),
          escapeCsvField(`Interpello aperto (${data.convocazioni_docenti} avvisi)`),
          escapeCsvField("Da graduatoria d'istituto"),
          escapeCsvField("Da bando/graduatoria"),
          escapeCsvField("Da graduatoria d'istituto"),
          escapeCsvField("Graduatoria d'Istituto Docenti (I/II/III Fascia)"),
          escapeCsvField("18 ore settimanali (Cattedra ordinaria)"),
          escapeCsvField("Fino al termine delle attività didattiche (30/06/2026)"),
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

      if (hasATA || !hasDoc) {
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField("ATA"),
          escapeCsvField("Collaboratore Scolastico"),
          escapeCsvField("CS"),
          escapeCsvField("comune"),
          escapeCsvField(data.convocazioni_collaboratore_scolastico ? `Convocazione aperta (${data.convocazioni_collaboratore_scolastico} posti)` : "Convocazione ATA"),
          escapeCsvField("Da graduatoria d'istituto"),
          escapeCsvField("Da graduatoria d'istituto"),
          escapeCsvField("Da graduatoria d'istituto"),
          escapeCsvField("Graduatoria ATA 24 Mesi / Terza Fascia"),
          escapeCsvField("36 ore settimanali (Tempo pieno)"),
          escapeCsvField("Fino al termine delle attività didattiche (30/06/2026)"),
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
    }
  }

  return rows.map(r => r.join(",")).join("\n");
}
