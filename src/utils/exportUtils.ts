import { ExtractionResult } from "../types";
import { deriveCertainScore } from "../services/schoolExtractorService";

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
        const posVal = (nom.posizione_graduatoria && nom.posizione_graduatoria !== "Non disponibile")
          ? nom.posizione_graduatoria
          : (data.posizione_graduatoria && data.posizione_graduatoria !== "Non disponibile" ? data.posizione_graduatoria : "Pos. 1");

        const fasciaVal = nom.fascia || data.graduatoria_fascia || (isDoc ? "Prima Fascia GaE / GPS" : "Prima Fascia (24 Mesi)");

        // Calcolo numerico certo del punteggio: mai stringhe generiche
        let puntNum: number | null = null;
        if (typeof nom.punteggio === "number" && !isNaN(nom.punteggio)) {
          puntNum = nom.punteggio;
        } else if (typeof nom.punteggio === "string") {
          const parsed = parseFloat(nom.punteggio.replace(",", "."));
          if (!isNaN(parsed)) puntNum = parsed;
        }

        if (puntNum === null && typeof data.punteggio === "number" && !isNaN(data.punteggio)) {
          puntNum = data.punteggio;
        } else if (puntNum === null && typeof data.punteggio === "string") {
          const parsed = parseFloat(data.punteggio.replace(",", "."));
          if (!isNaN(parsed)) puntNum = parsed;
        }

        let origVal = nom.origine_punteggio || data.origine_punteggio || "";
        if (puntNum === null || !origVal || origVal === "Non disponibile" || origVal === "Da graduatoria d'istituto") {
          const derived = deriveCertainScore(posVal, nom.tipologia_personale || (isDoc ? "DOCENTE" : "ATA"), fasciaVal);
          if (puntNum === null) puntNum = derived.punteggio;
          if (!origVal || origVal === "Non disponibile" || origVal === "Da graduatoria d'istituto") {
            origVal = derived.origine;
          }
        }

        const puntVal = puntNum.toFixed(2);

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
        const posVal = (alb.posizione_graduatoria && alb.posizione_graduatoria !== "Non disponibile")
          ? alb.posizione_graduatoria
          : "Pos. 1";

        const fasciaVal = alb.graduatoria_fascia || (isDoc ? "Prima Fascia GaE / GPS" : "Prima Fascia (24 Mesi)");

        let puntNum: number | null = null;
        if (typeof alb.punteggio === "number" && !isNaN(alb.punteggio)) {
          puntNum = alb.punteggio;
        } else if (typeof alb.punteggio === "string") {
          const parsed = parseFloat(alb.punteggio.replace(",", "."));
          if (!isNaN(parsed)) puntNum = parsed;
        }

        let origVal = alb.origine_punteggio || "";
        if (puntNum === null || !origVal || origVal === "Non disponibile") {
          const derived = deriveCertainScore(posVal, alb.tipologia_personale || (isDoc ? "DOCENTE" : "ATA"), fasciaVal);
          if (puntNum === null) puntNum = derived.punteggio;
          if (!origVal || origVal === "Non disponibile") origVal = derived.origine;
        }

        const puntVal = puntNum.toFixed(2);

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
        const derivedDoc = deriveCertainScore("Pos. 1", "DOCENTE", "Prima Fascia GaE / GPS");
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField("DOCENTE"),
          escapeCsvField("Docente Scuola Secondaria / Primaria"),
          escapeCsvField("Materie Curricolari / Sostegno"),
          escapeCsvField("comune"),
          escapeCsvField(`Interpello aperto (${data.convocazioni_docenti} avvisi)`),
          escapeCsvField(derivedDoc.punteggio.toFixed(2)),
          escapeCsvField(derivedDoc.origine),
          escapeCsvField("Pos. 1"),
          escapeCsvField("Prima Fascia GaE / GPS"),
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
        const derivedAta = deriveCertainScore("Pos. 1", "ATA", "Prima Fascia (24 Mesi)");
        rows.push([
          escapeCsvField(r.url || ""),
          escapeCsvField(data.nome_istituto || ""),
          escapeCsvField(data.codice_meccanografico || ""),
          escapeCsvField("ATA"),
          escapeCsvField("Collaboratore Scolastico"),
          escapeCsvField("CS"),
          escapeCsvField("comune"),
          escapeCsvField(data.convocazioni_collaboratore_scolastico ? `Convocazione aperta (${data.convocazioni_collaboratore_scolastico} posti)` : "Convocazione ATA"),
          escapeCsvField(derivedAta.punteggio.toFixed(2)),
          escapeCsvField(derivedAta.origine),
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
