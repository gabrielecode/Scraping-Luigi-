import { ExtractionData, GraduatoriaIstituto, OriginePunteggio, NominaContrattoItem } from "../types";
import { 
  extractCodiceMeccanograficoFromText, 
  crossReferenceNomina, 
  resolveFromGraduatorie,
  extractWithOpenRouter 
} from "./graduatorieService";

/**
 * Estrae ed analizza i dati di una scuola (nome, codice, convocazioni, pensionamenti, contratti/nomine)
 * dal contenuto HTML o testo grezzo, integrando intelligenza artificiale e cross-reference graduatorie.
 */
export async function extractSchoolData(
  htmlText: string,
  url: string,
  apiKey: string,
  graduatorie: GraduatoriaIstituto[] = [],
  singleNominativo?: string,
  initialHint?: { nome_istituto?: string; codice_meccanografico?: string }
): Promise<ExtractionData> {
  // 1. Estrazione preliminare codice meccanografico tramite regex
  const detectedMecc = initialHint?.codice_meccanografico || extractCodiceMeccanograficoFromText(htmlText, url);

  // 2. Pulizia sommaria testo HTML per prompt compatto
  const textSample = htmlText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000); // Primi 15k caratteri per non saturare la chiamata

  const prompt = `Analizza il testo della seguente pagina web di una scuola italiana per estrarre informazioni su:
1. "nome_istituto": denominazione della scuola.
2. "codice_meccanografico": codice meccanografico (se presente).
3. "convocazioni": numero di atti/avvisi di convocazione/interpello per:
   - collaboratore_scolastico (numero)
   - assistente_amministrativo (numero)
   - docenti (numero)
   - assistente_tecnico (numero)
   - cuoco (numero)
   - assistente_agrario (numero)
4. "pensionamenti": numero di avvisi/cessazioni dal servizio/pensionamenti per gli stessi profili.
5. "nomine_contratti": array di contratti, nomine o interpelli individuati (se presenti nel testo), con campi:
   - "nominativo" (stringa o null)
   - "tipologia_personale" ("ATA" o "DOCENTE")
   - "profilo_lavorativo" (es. "Collaboratore scolastico", "Docente A-22", ecc.)
   - "classe_concorso_area_lab" (es. "A-22", "AR02", o null)
   - "tipo_posto" ("comune" o "sostegno")
   - "punteggio" (numero o null se non esplicito)
   - "posizione_graduatoria" (stringa o "Non disponibile")
   - "fascia" (es. "1", "2", "3", o null)
   - "ore_settimanali" (es. "36 ore", "18 ore", o null)
   - "decorrenza_contratto" (es. "10/10/2026 - 30/06/2027" o null)

${singleNominativo ? `ATTENZIONE: Cerca in particolare evidenze relative al candidato: "${singleNominativo}".` : ""}

Rispondi strettamente in formato JSON valido, senza testo introduttivo o markdown:
{
  "nome_istituto": "...",
  "codice_meccanografico": "...",
  "convocazioni": {
    "collaboratore_scolastico": 0,
    "assistente_amministrativo": 0,
    "docenti": 0,
    "assistente_tecnico": 0,
    "cuoco": 0,
    "assistente_agrario": 0
  },
  "pensionamenti": {
    "collaboratore_scolastico": 0,
    "assistente_amministrativo": 0,
    "docenti": 0,
    "assistente_tecnico": 0,
    "cuoco": 0,
    "assistente_agrario": 0
  },
  "nomine_contratti": []
}

Testo della pagina:
"""${textSample}"""`;

  let aiParsed: any = null;
  if (apiKey && apiKey.trim()) {
    try {
      const response = await extractWithOpenRouter(
        prompt,
        apiKey.trim(),
        "Sei un estrattore esperto di dati e circolari scolastiche italiane. Rispondi solo in JSON."
      );
      const cleanJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
      aiParsed = JSON.parse(cleanJson);
    } catch {
      // Se la chiamata AI fallisce (es. timeout o rate limit), procedi con valori euristici di base
    }
  }

  const nome = initialHint?.nome_istituto || aiParsed?.nome_istituto || url.replace(/^https?:\/\//, "").split("/")[0];
  const codice = detectedMecc || aiParsed?.codice_meccanografico || "";

  const conv = aiParsed?.convocazioni || {};
  const pens = aiParsed?.pensionamenti || {};

  const rawNomine: NominaContrattoItem[] = Array.isArray(aiParsed?.nomine_contratti)
    ? aiParsed.nomine_contratti.map((n: any) => ({
        nome_istituto: nome,
        codice_meccanografico: codice,
        nominativo: n.nominativo || singleNominativo || undefined,
        tipologia_personale: n.tipologia_personale === "DOCENTE" ? "DOCENTE" : "ATA",
        profilo_lavorativo: n.profilo_lavorativo || "",
        classe_concorso_area_lab: n.classe_concorso_area_lab || "",
        tipo_posto: n.tipo_posto === "sostegno" ? "sostegno" : "comune",
        punteggio: typeof n.punteggio === "number" ? n.punteggio : null,
        origine_punteggio: (typeof n.punteggio === "number" ? "Esplicito" : "Non disponibile") as OriginePunteggio,
        posizione_graduatoria: n.posizione_graduatoria || "Non disponibile",
        fascia: n.fascia || "",
        ore_settimanali: n.ore_settimanali || "",
        decorrenza_contratto: n.decorrenza_contratto || "",
        durata_contratto_mesi: "",
        durata_contratto_giorni: "",
        link_del_documento: url
      }))
    : [];

  // Se è specificato un nominativo e non ci sono nomine estratte, crea una riga segnaposto per consentire il cross-reference
  if (singleNominativo && singleNominativo.trim() && rawNomine.length === 0) {
    rawNomine.push({
      nome_istituto: nome,
      codice_meccanografico: codice,
      nominativo: singleNominativo.trim(),
      tipologia_personale: "ATA",
      profilo_lavorativo: "Collaboratore scolastico",
      classe_concorso_area_lab: "",
      tipo_posto: "comune",
      punteggio: null,
      origine_punteggio: "Non disponibile",
      posizione_graduatoria: "Non disponibile",
      fascia: "",
      ore_settimanali: "",
      decorrenza_contratto: "",
      durata_contratto_mesi: "",
      durata_contratto_giorni: "",
      link_del_documento: url
    });
  }

  // Cross reference nomine con le graduatorie salvate
  const processedNomine = rawNomine.map(nom => {
    return crossReferenceNomina(nom, graduatorie, {
      codice_meccanografico: codice,
      nome_istituto: nome
    });
  });

  const baseData: ExtractionData = {
    nome_istituto: nome,
    codice_meccanografico: codice,
    nominativo: singleNominativo || processedNomine[0]?.nominativo,
    nomine_contratti: processedNomine,

    convocazioni_collaboratore_scolastico: Number(conv.collaboratore_scolastico) || 0,
    convocazioni_assistente_amministrativo: Number(conv.assistente_amministrativo) || 0,
    convocazioni_docenti: Number(conv.docenti) || 0,
    convocazioni_assistente_tecnico: Number(conv.assistente_tecnico) || 0,
    convocazioni_cuoco: Number(conv.cuoco) || 0,
    convocazioni_assistente_agrario: Number(conv.assistente_agrario) || 0,

    pensionamenti_collaboratore_scolastico: Number(pens.collaboratore_scolastico) || 0,
    pensionamenti_assistente_amministrativo: Number(pens.assistente_amministrativo) || 0,
    pensionamenti_docenti: Number(pens.docenti) || 0,
    pensionamenti_assistente_tecnico: Number(pens.assistente_tecnico) || 0,
    pensionamenti_cuoco: Number(pens.cuoco) || 0,
    pensionamenti_assistente_agrario: Number(pens.assistente_agrario) || 0,

    // Campi del primo candidato per compatibilità tabellare
    tipologia_personale: processedNomine[0]?.tipologia_personale || "ATA",
    profilo_lavorativo: processedNomine[0]?.profilo_lavorativo || "",
    classe_concorso_area_lab: processedNomine[0]?.classe_concorso_area_lab || "",
    tipo_posto: processedNomine[0]?.tipo_posto || "comune",
    punteggio: processedNomine[0]?.punteggio !== undefined ? processedNomine[0]?.punteggio : null,
    origine_punteggio: processedNomine[0]?.origine_punteggio || "Non disponibile",
    confidence: processedNomine[0]?.confidence,
    posizione_graduatoria: processedNomine[0]?.posizione_graduatoria || "Non disponibile",
    graduatoria_fascia: processedNomine[0]?.fascia || "",
    ore_settimanali: processedNomine[0]?.ore_settimanali || "",
    decorrenza_contratto: processedNomine[0]?.decorrenza_contratto || "",
    note_cross_reference: processedNomine[0]?.note_cross_reference || ""
  };

  // Se ci sono graduatorie registrate, esegui resolveFromGraduatorie
  if (graduatorie && graduatorie.length > 0) {
    try {
      const resolved = await resolveFromGraduatorie(baseData, {
        targetUrl: url,
        initialContent: textSample
      });
      return resolved;
    } catch {
      return baseData;
    }
  }

  return baseData;
}
