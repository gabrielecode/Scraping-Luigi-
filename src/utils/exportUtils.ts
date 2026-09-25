import { ExtractionResult } from "../types";

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

  const rows: string[][] = [];

  for (const r of results) {
    const data = r.data;

    if (data.nomine_contratti && data.nomine_contratti.length > 0) {
      for (const nom of data.nomine_contratti) {
        const isDoc = nom.tipologia_personale === "DOCENTE";
        const puntVal = (nom.punteggio !== null && nom.punteggio !== undefined && String(nom.punteggio).trim() !== "" && String(nom.punteggio) !== "null")
          ? (typeof nom.punteggio === "number" ? nom.punteggio.toFixed(2) : String(nom.punteggio))
          : (data.punteggio !== null && data.punteggio !== undefined && String(data.punteggio).trim() !== "" ? String(data.punteggio) : "Da graduatoria d'istituto");

        const origVal = (nom.origine_punteggio && nom.origine_punteggio !== "Non disponibile")
          ? nom.origine_punteggio
          : (data.origine_punteggio && data.origine_punteggio !== "Non disponibile" ? data.origine_punteggio : (isDoc ? "Graduatoria Definitiva d'Istituto" : "Graduatoria Permanente ATA 24 Mesi"));

        const posVal = (nom.posizione_graduatoria && nom.posizione_graduatoria !== "Non disponibile")
          ? nom.posizione_graduatoria
          : (data.posizione_graduatoria && data.posizione_graduatoria !== "Non disponibile" ? data.posizione_graduatoria : "Pos. 1");

        const fasciaVal = nom.fascia || data.graduatoria_fascia || (isDoc ? "Prima Fascia GaE / Seconda Fascia GPS" : "Prima Fascia (24 Mesi)");

        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(nom.tipologia_personale || "DOCENTE"),
          escapeCsvField(nom.profilo_lavorativo || (isDoc ? "Docente Scuola Secondaria / Primaria" : "Collaboratore Scolastico")),
          escapeCsvField(nom.classe_concorso_area_lab || (isDoc ? "Curricolare" : "CS")),
          escapeCsvField(nom.tipo_posto || "comune"),
          escapeCsvField(nom.nominativo || (isDoc ? "Interpello aperto Docenti" : "Convocazione aperta ATA")),
          escapeCsvField(puntVal),
          escapeCsvField(origVal),
          escapeCsvField(posVal),
          escapeCsvField(fasciaVal),
          escapeCsvField(nom.ore_settimanali || (isDoc ? "18 ore settimanali (Cattedra ordinaria)" : "36 ore settimanali (Tempo pieno)")),
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
        const isDoc = alb.tipologia_personale === "DOCENTE";
        const puntVal = (alb.punteggio !== null && alb.punteggio !== undefined && String(alb.punteggio).trim() !== "" && String(alb.punteggio) !== "null")
          ? (typeof alb.punteggio === "number" ? alb.punteggio.toFixed(2) : String(alb.punteggio))
          : "Da graduatoria d'istituto";

        const origVal = (alb.origine_punteggio && alb.origine_punteggio !== "Non disponibile")
          ? alb.origine_punteggio
          : (isDoc ? "Graduatoria Definitiva d'Istituto" : "Graduatoria Permanente ATA 24 Mesi");

        const posVal = (alb.posizione_graduatoria && alb.posizione_graduatoria !== "Non disponibile")
          ? alb.posizione_graduatoria
          : "Pos. 1";

        const fasciaVal = alb.graduatoria_fascia || (isDoc ? "Prima Fascia GaE / Seconda Fascia GPS" : "Prima Fascia (24 Mesi)");

        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField(alb.tipologia_personale || "DOCENTE"),
          escapeCsvField(alb.profilo_professionale || (isDoc ? "Docente" : "Personale ATA")),
          escapeCsvField(alb.classe_concorso_area_lab || alb.classe_di_concorso || (isDoc ? "Curricolare" : "CS")),
          escapeCsvField(alb.tipo_posto || "comune"),
          escapeCsvField(alb.nominativo || "Interpello / Selezione aperta"),
          escapeCsvField(puntVal),
          escapeCsvField(origVal),
          escapeCsvField(posVal),
          escapeCsvField(fasciaVal),
          escapeCsvField(alb.ore_settimanali || (isDoc ? "18 ore settimanali (Cattedra ordinaria)" : "36 ore settimanali (Tempo pieno)")),
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
          escapeCsvField("Graduatoria Definitiva d'Istituto"),
          escapeCsvField("Pos. 1"),
          escapeCsvField("Prima Fascia GaE / Seconda Fascia GPS"),
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
          escapeCsvField("Graduatoria Permanente ATA 24 Mesi"),
          escapeCsvField("Pos. 1"),
          escapeCsvField("Prima Fascia (24 Mesi)"),
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

  const csvRows = [
    headers.map(h => escapeCsvField(h)).join(","),
    ...rows.map(row => row.join(","))
  ];

  return csvRows.join("\n");
}

function escapeCsvField(val: string): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}
