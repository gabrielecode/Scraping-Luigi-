import { GraduatoriaIstituto, GraduatoriaIstitutoEntry, NominaContrattoItem, AlboPretorioContract, OriginePunteggio, ExtractionData } from "../types";

const STORAGE_KEY = "scuola_graduatorie_istituto";

/**
 * Decodifica in modo sicuro una stringa con codifica URL (%20, %22, ecc.),
 * gestendo doppie codifiche e stringhe malformate senza generare eccezioni.
 * Esempio: "PALMA%20I.C.%202" -> "PALMA I.C. 2"
 */
export function safeDecodeURIComponent(val?: string | null): string {
  if (!val) return "";
  let str = String(val);
  for (let i = 0; i < 2; i++) {
    if (!str.includes("%")) break;
    try {
      const decoded = decodeURIComponent(str.replace(/\+/g, " "));
      if (decoded === str) break;
      str = decoded;
    } catch {
      try {
        const partialDecoded = str.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => {
          try {
            return decodeURIComponent(`%${hex}`);
          } catch {
            return `%${hex}`;
          }
        });
        if (partialDecoded === str) break;
        str = partialDecoded;
      } catch {
        break;
      }
    }
  }
  return str;
}

/**
 * Esegue l'escaping RFC 4180 di un campo per CSV in modo pulito e sicuro:
 * - Se il valore contiene virgolette già moltiplicate (es. """" o """ o "") derivanti
 *   da cicli multipli di serializzazione/parsing, le normalizza a singole virgolette.
 * - Converte virgolette con barre d'escape (tipo \") a virgolette standard.
 * - Rimuove virgolette esterne di contenimento se presenti come residuo di wrapping.
 * - Raddoppia ogni virgoletta interna esattamente una volta: " -> ""
 * - Racchiude infine il valore tra virgolette esterne: "valore"
 * 
 * Esempio:
 *  `Istituto "A.Amici"` -> `"Istituto ""A.Amici"""`
 *  `"Istituto ""A.Amici"""` -> `"Istituto ""A.Amici"""` (nessun raddoppio moltiplicativo)
 */
export function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (!str) return '""';

  // Protezione globale da "null" o "undefined" letterali
  const lower = str.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return '""';
  }

  // Rimuovi barre di escape tipo \" o \\"
  str = str.replace(/\\"/g, '"');

  // Rimuovi tutte le virgolette esterne residue multiple
  str = str.replace(/^"+|"+$/g, '').trim();

  // Se dopo la pulizia la stringa è vuota
  if (!str) return '""';

  // Normalizza eventuali sequenze consecutive di virgolette interne a singola virgoletta
  str = str.replace(/"+/g, '"');

  // Applica l'escaping canonico RFC 4180: ogni virgoletta interna raddoppiata una sola volta
  const escaped = str.replace(/"/g, '""');

  return `"${escaped}"`;
}

/**
 * Normalizza il punteggio garantendo float valido con 2 decimali, oppure null
 */
export function normalizePunteggio(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : Number(val.toFixed(2));
  }
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (
      !s ||
      s === "null" ||
      s === "none" ||
      s === "non riportato" ||
      s === "non specificato" ||
      s === "non presente" ||
      s === "non disponibile" ||
      s === "n/d" ||
      s === "-" ||
      s === "nd" ||
      s === "assente" ||
      s === "mancante"
    ) {
      return null;
    }
    const clean = s.replace(",", ".").replace(/[^\d.-]/g, "");
    if (!clean) return null;
    const num = parseFloat(clean);
    return isNaN(num) ? null : Number(num.toFixed(2));
  }
  return null;
}

/**
 * Normalizza la denominazione della scuola per il confronto:
 * lowercase, rimozione della punteggiatura e normalizzazione degli spazi
 */
export function normalizeNomeIstituto(nome?: string | null): string {
  if (!nome) return "";
  const decoded = safeDecodeURIComponent(nome);
  return decoded
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?<>@\\\[\]|«»“”’‘–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cerca un candidato per posizione o nominativo in una graduatoria specifica.
 * Una graduatoria è candidata SOLO se il codice meccanografico coincide oppure,
 * senza codice, se coincide nome_istituto normalizzato (lowercase, senza punteggiatura).
 * Nessun match scuola = return null. Mai match per sola posizione.
 */
export function lookupPunteggioGraduatoria(
  graduatorie: GraduatoriaIstituto[],
  criteri: {
    codice_meccanografico?: string;
    nome_istituto?: string;
    tipologia_personale?: "ATA" | "DOCENTE";
    profilo_o_cdc?: string;
    fascia?: string;
    posizione?: number;
    nominativo?: string;
  }
): { punteggio: number; entry?: GraduatoriaIstitutoEntry; graduatoriaMatched?: GraduatoriaIstituto } | null {
  const normCodice = normalizeCodiceMeccanografico(criteri.codice_meccanografico);
  const normNomeCriteri = normalizeNomeIstituto(criteri.nome_istituto);

  // Nessun match scuola possibile se mancano sia codice che nome istituto nei criteri:
  // una graduatoria è candidata SOLO se la scuola coincide. Mai match per sola posizione.
  if (!normCodice && !normNomeCriteri) {
    return null;
  }

  const normProfilo = normalizeProfiloOrCdc(criteri.profilo_o_cdc || "");
  const normFascia = criteri.fascia && !isFasciaMissing(criteri.fascia)
    ? normalizeFascia(criteri.fascia)
    : "";

  // Filtriamo le graduatorie candidate
  const candidateGrad = graduatorie.filter(g => {
    const gCodice = normalizeCodiceMeccanografico(g.codice_meccanografico);
    const gNome = normalizeNomeIstituto(g.nome_istituto);

    // Candidata SOLO se il codice meccanografico coincide oppure, senza codice, se coincide nome_istituto normalizzato
    let schoolMatch = false;
    if (normCodice && gCodice) {
      schoolMatch = (normCodice === gCodice);
    } else if ((!normCodice || !gCodice) && normNomeCriteri && gNome) {
      schoolMatch = (normNomeCriteri === gNome);
    }

    if (!schoolMatch) {
      return false;
    }

    // Tipologia personale
    if (criteri.tipologia_personale && g.tipologia_personale !== criteri.tipologia_personale) {
      return false;
    }

    // Profilo o CDC (solo uguaglianza dei valori canonici)
    if (criteri.profilo_o_cdc && g.profilo_o_cdc) {
      if (!isClassMatch(criteri.profilo_o_cdc, g.profilo_o_cdc)) {
        return false;
      }
    }

    // Fascia
    if (normFascia) {
      const gFascia = normalizeFascia(g.fascia);
      if (gFascia && gFascia !== normFascia) {
        return false;
      }
    }

    return true;
  });

  // Nessun match scuola = return null
  if (candidateGrad.length === 0) {
    return null;
  }

  // 1. Cerca per posizione se specificata
  if (criteri.posizione && criteri.posizione > 0) {
    const matched: Array<{
      punteggio: number;
      entry: GraduatoriaIstitutoEntry;
      graduatoriaMatched: GraduatoriaIstituto;
    }> = [];

    for (const g of candidateGrad) {
      const entry = g.graduatoria.find(e => e.posizione === criteri.posizione);
      if (entry && typeof entry.punteggio === "number" && !isNaN(entry.punteggio)) {
        // Se c'è anche il nominativo nei criteri, verifichiamo che non sia in conflitto
        if (criteri.nominativo && criteri.nominativo.trim().length >= 3 && entry.cognome_nome) {
          if (!isNameMatch(criteri.nominativo, entry.cognome_nome)) {
            continue;
          }
        }
        matched.push({
          punteggio: Number(entry.punteggio.toFixed(2)),
          entry,
          graduatoriaMatched: g,
        });
      }
    }

    if (matched.length > 0) {
      // TASK 1-bis/1: Se fascia non è nei criteri e più graduatorie candidate hanno la posizione con punteggi diversi -> return null (mai la prima)
      if (!normFascia) {
        const distinctScores = Array.from(new Set(matched.map(m => m.punteggio)));
        if (distinctScores.length > 1) {
          return null;
        }
      }
      return matched[0];
    }
  }

  // 2. Cerca per nominativo se specificato
  if (criteri.nominativo && criteri.nominativo.trim().length >= 3) {
    const matched: Array<{
      punteggio: number;
      entry: GraduatoriaIstitutoEntry;
      graduatoriaMatched: GraduatoriaIstituto;
    }> = [];

    for (const g of candidateGrad) {
      const entry = g.graduatoria.find(e => e.cognome_nome && isNameMatch(criteri.nominativo!, e.cognome_nome));
      if (entry && typeof entry.punteggio === "number" && !isNaN(entry.punteggio)) {
        matched.push({
          punteggio: Number(entry.punteggio.toFixed(2)),
          entry,
          graduatoriaMatched: g,
        });
      }
    }

    if (matched.length > 0) {
      // TASK 1-bis/1: Se fascia non è nei criteri e più graduatorie candidate hanno il nominativo con punteggi diversi -> return null (mai la prima)
      if (!normFascia) {
        const distinctScores = Array.from(new Set(matched.map(m => m.punteggio)));
        if (distinctScores.length > 1) {
          return null;
        }
      }
      return matched[0];
    }
  }

  return null;
}

/**
 * Incrocia automaticamente una singola nomina/contratto con le graduatorie disponibili.
 * Se la nomina ha già un punteggio esplicito (diverso da null), lo preserva con origine "Esplicito".
 * Se la nomina ha punteggio null, tenta il lookup tramite posizione o nominativo.
 */
export function crossReferenceNomina<T extends NominaContrattoItem | AlboPretorioContract>(
  item: T,
  graduatorie: GraduatoriaIstituto[],
  scuolaContext?: { codice_meccanografico?: string; nome_istituto?: string }
): T & { punteggio: number | null; origine_punteggio: OriginePunteggio; note_cross_reference?: string } {
  const existingNotes = (item as any).note_cross_reference || "";
  const existingSoglia = existingNotes.includes("Soglia convocazione:")
    ? (existingNotes.split("|").find((s: string) => s.includes("Soglia convocazione:"))?.trim() || "")
    : "";

  // Se ha già un punteggio esplicito valido
  if (item.punteggio !== null && item.punteggio !== undefined && !isNaN(Number(item.punteggio))) {
    return {
      ...item,
      punteggio: Number(Number(item.punteggio).toFixed(2)),
      origine_punteggio: "Esplicito",
      note_cross_reference: existingNotes || "Punteggio estratto direttamente dal testo del documento/contratto.",
    };
  }

  const codMec = (item as any).codice_meccanografico || scuolaContext?.codice_meccanografico;
  const nomeScuola = (item as any).nome_istituto || scuolaContext?.nome_istituto;
  const tipologia = (item as any).tipologia_personale || "ATA";
  const profilo = (item as any).profilo_lavorativo || (item as any).profilo_professionale || (item as any).classe_concorso_area_lab || (item as any).classe_di_concorso || "";
  const fascia = (item as any).fascia || (item as any).graduatoria_fascia || "";
  const posNum = parsePosizioneNumber(item.posizione_graduatoria);
  const nominativo = (item as any).nominativo;

  // Tentativo di incrocio tramite posizione o nominativo
  if (posNum || (nominativo && nominativo.trim().length >= 3)) {
    const match = lookupPunteggioGraduatoria(graduatorie, {
      codice_meccanografico: codMec,
      nome_istituto: nomeScuola,
      tipologia_personale: tipologia,
      profilo_o_cdc: profilo,
      fascia,
      posizione: posNum || undefined,
      nominativo: nominativo || undefined,
    });

    if (match) {
      const nomeGrad = match.graduatoriaMatched?.nome_istituto || match.graduatoriaMatched?.codice_meccanografico || "Graduatoria d'Istituto";
      const matchedPos = match.entry?.posizione || posNum || "N/D";
      const sogliaSuffix = existingSoglia ? ` | ${existingSoglia}` : "";
      return {
        ...item,
        codice_meccanografico: (item as any).codice_meccanografico || match.graduatoriaMatched?.codice_meccanografico || "",
        posizione_graduatoria: (item as any).posizione_graduatoria && (item as any).posizione_graduatoria !== "Non disponibile" ? (item as any).posizione_graduatoria : String(matchedPos),
        punteggio: match.punteggio,
        origine_punteggio: "Incrociato",
        note_cross_reference: `Punteggio incrociato con ${nomeGrad} (${match.graduatoriaMatched?.profilo_o_cdc}, Fascia ${match.graduatoriaMatched?.fascia}): pos. ${matchedPos} = ${match.punteggio.toFixed(2)} pt${match.entry?.cognome_nome ? ` [${match.entry.cognome_nome}]` : ""}${sogliaSuffix}`,
      } as any;
    }
  }

  // Verifica se si tratta di un interpello o bando aperto in corso
  const combinedDesc = `${profilo} ${fascia} ${(item as any).note || ""} ${(item as any).tipo_posto || ""}`.toLowerCase();
  if (combinedDesc.includes("interpell") || combinedDesc.includes("bando") || combinedDesc.includes("selezione")) {
    const defaultMsg = "Bando/Interpello di selezione: nessun candidato ancora nominato nell'atto.";
    return {
      ...item,
      punteggio: null,
      origine_punteggio: "Non disponibile",
      note_cross_reference: existingSoglia ? `${existingSoglia} | ${defaultMsg}` : (existingNotes || defaultMsg),
    };
  }

  if (posNum) {
    const posMsg = `Posizione ${posNum} presente, ma nessuna graduatoria caricata corrisponde a [${profilo} - Fascia ${fascia || "N/D"}].`;
    return {
      ...item,
      punteggio: null,
      origine_punteggio: "Non disponibile",
      note_cross_reference: existingSoglia ? `${existingSoglia} | ${posMsg}` : (existingNotes || posMsg),
    };
  }

  return {
    ...item,
    punteggio: null,
    origine_punteggio: "Non disponibile",
    note_cross_reference: existingNotes || "Punteggio non presente nel documento e posizione non specificata.",
  };
}

/**
 * Pulisce qualsiasi valore da stringhe letterali "null", "undefined", "none", ecc.
 */
export function cleanFieldString(val: any, fallback: string = ""): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none" || lower === "[object object]") {
    return fallback;
  }
  return s;
}

/**
 * Formatta il Codice Meccanografico per l'output:
 * - Se valido -> restituito normalizzato in maiuscolo
 * - Se non valido o mancante ("null", undefined, vuoto):
 *    - se la ricerca è stata fatta ma non trovata -> "Non disponibile"
 *    - se il dato non è mai stato cercato -> "" (campo vuoto)
 */
export function formatCsvCodiceMeccanografico(val: any, wasSearched: boolean): string {
  const cleaned = cleanFieldString(val, "");
  if (!cleaned) {
    return wasSearched ? "Non disponibile" : "";
  }
  if (cleaned.toLowerCase() === "non disponibile") {
    return "Non disponibile";
  }
  if (isValidCodiceMeccanografico(cleaned)) {
    return normalizeCodiceMeccanografico(cleaned);
  }
  return wasSearched ? "Non disponibile" : "";
}

/**
 * Risolve e valida il link del documento o della fonte:
 * - Se rawLink è un URL assoluto valido (http/https senza spazi o caratteri spuri): lo restituisce.
 * - Se rawLink è un percorso relativo (/albo/doc.pdf) ed è disponibile visitedUrl: lo risolve rispetto alla base.
 * - Se rawLink non è valido (es. "https://" + nome scuola, stringhe con spazi, protocolli fittizi, vuoto, null):
 *   usa come fallback l'URL della homepage del sito della scuola (es. https://www.scuola.edu.it)
 *   da cui è partita la scansione.
 * - Garantisce che il campo contenga SEMPRE un URL valido e cliccabile.
 */
export function resolveValidDocumentLink(
  rawLink: string | null | undefined,
  visitedUrl: string | null | undefined,
  visitedHosts?: Set<string>
): string {
  // Calcola la homepage di fallback dal sito visitato da cui è partita la scansione
  let fallbackHomepage = "";
  let baseDomain = "";
  if (visitedUrl && typeof visitedUrl === "string") {
    const cleanVisited = visitedUrl.trim();
    try {
      const u = new URL(cleanVisited.startsWith("http") ? cleanVisited : `https://${cleanVisited}`);
      fallbackHomepage = u.origin;
      baseDomain = normalizeDomainForComparison(u.hostname);
    } catch {
      fallbackHomepage = cleanVisited.startsWith("http") ? cleanVisited : "";
      baseDomain = normalizeDomainForComparison(fallbackHomepage);
    }
  }

  const cleanRaw = cleanFieldString(rawLink, "");

  // Se rawLink è assente o stringa vuota o solo protocollo
  if (!cleanRaw || cleanRaw === "https://" || cleanRaw === "http://" || cleanRaw === "https" || cleanRaw === "http") {
    return fallbackHomepage || (visitedUrl ? visitedUrl.trim() : "");
  }

  // Risoluzione URL relativi
  if (cleanRaw.startsWith("/") && fallbackHomepage) {
    try {
      return new URL(cleanRaw, fallbackHomepage).href;
    } catch {
      return fallbackHomepage;
    }
  }

  try {
    const urlCandidate = cleanRaw.startsWith("http") ? cleanRaw : `https://${cleanRaw}`;
    
    // Controlla che l'autorità non contenga spazi o caratteri palesemente testuali (es. "https://IC MARIANI TOMAI")
    const authorityMatch = urlCandidate.match(/^https?:\/\/([^/?#]+)/i);
    if (!authorityMatch) {
      return fallbackHomepage || "";
    }
    const hostPart = authorityMatch[1];
    if (hostPart.includes(" ") || hostPart.includes('"') || hostPart.includes("(") || hostPart.includes(")")) {
      return fallbackHomepage || "";
    }

    const urlObj = new URL(urlCandidate);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return fallbackHomepage || "";
    }

    const host = urlObj.hostname;
    if (!host || host.includes(" ") || (!host.includes(".") && host !== "localhost")) {
      return fallbackHomepage || "";
    }

    const normHost = normalizeDomainForComparison(host);
    const matchesBase = baseDomain && (normHost === baseDomain || baseDomain.endsWith("." + normHost) || normHost.endsWith("." + baseDomain));
    const isVisited = visitedHosts ? (visitedHosts.has(normHost) || Array.from(visitedHosts).some(vh => normHost === vh || normHost.endsWith("." + vh) || vh.endsWith("." + normHost))) : false;
    const isAllowedExt = isAllowedExternalDomain(normHost);

    if (!matchesBase && !isVisited && !isAllowedExt && normHost !== "localhost") {
      return fallbackHomepage || "";
    }

    return urlObj.href;
  } catch {
    return fallbackHomepage || "";
  }
}

/**
 * Determina se la Classe di Concorso / Area di Laboratorio è un campo pertinente
 * per il profilo e la tipologia di personale indicati.
 * - Pertinente per DOCENTE e per ATA Assistente Tecnico (laboratori)
 * - NON pertinente per gli altri profili ATA (CS, AA, Cuoco, Guardarobiere, ecc.)
 */
export function isClasseConcorsoPertinent(tipologia: string, profilo: string): boolean {
  const tip = (tipologia || "").trim().toUpperCase();
  if (tip === "DOCENTE") return true;

  const prof = (profilo || "").trim().toLowerCase();
  if (
    prof.includes("docente") ||
    prof.includes("insegnante") ||
    prof.includes("maestr") ||
    prof.includes("profess") ||
    prof.includes("cdc") ||
    prof.includes("sostegno")
  ) {
    return true;
  }

  // Assistente Tecnico ATA con Area di Laboratorio
  if (
    prof.includes("assistente tecnico") ||
    prof.includes("tecnico di laboratorio") ||
    /\bat\b/i.test(prof)
  ) {
    return true;
  }

  return false;
}

/**
 * Standardizza i placeholder delle celle secondo le due uniche categorie ammesse:
 * - "Non applicabile": se il campo non è pertinente per quel tipo posto/profilo
 * - "Non disponibile": se il campo è pertinente ma il dato non è stato trovato nella fonte
 * Rimuove definitivamente "Non riportata", "Non riportate", "Non specificata", "Non specificato", "null", ecc.
 */
export function standardizePlaceholder(
  val: any,
  isPertinent: boolean,
  validExplicitFallback?: string
): string {
  if (val === null || val === undefined) {
    return isPertinent ? "Non disponibile" : "Non applicabile";
  }
  const s = String(val).trim();
  const lower = s.toLowerCase();

  // Se è vuoto o un placeholder obsoleto / generico
  if (
    !s ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "non riportata" ||
    lower === "non riportato" ||
    lower === "non riportate" ||
    lower === "non specificata" ||
    lower === "non specificato" ||
    lower === "non specificate" ||
    lower === "n/d" ||
    lower === "nd" ||
    lower === "-" ||
    lower === "assente" ||
    lower === "mancante"
  ) {
    if (!isPertinent) {
      return "Non applicabile";
    }
    return validExplicitFallback !== undefined ? validExplicitFallback : "Non disponibile";
  }

  // Se era già esplicitamente "non applicabile"
  if (lower === "non applicabile") {
    return isPertinent ? (validExplicitFallback !== undefined ? validExplicitFallback : "Non disponibile") : "Non applicabile";
  }

  // Se era già esplicitamente "non disponibile"
  if (lower === "non disponibile") {
    return isPertinent ? "Non disponibile" : "Non applicabile";
  }

  // Altrimenti è un valore effettivo valido
  return s;
}

/**
 * Normalizza il profilo lavorativo ATA o la CDC docente in una chiave canonica di confronto.
 * Esempio:
 *  "Collaboratore scolastico" -> "CS"
 *  "Assistente Amministrativo" -> "AA"
 *  "Assistente Tecnico" -> "AT"
 *  "A-12 - Discipline letterarie..." -> "A-12"
 *  "A22" -> "A-22"
 *  "ADMM - Sostegno I grado" -> "ADMM"
 */
export function normalizeProfiloOrCdc(val: string): string {
  return normalizeCdcOrProfile(val);
}

/**
 * Normalizza la fascia:
 * Rimuove anni/intervalli (\d{4}(/\d{2,4})?) e "24 mesi" se preceduto da "permanente".
 * Poi, nell'ordine:
 * terza|iii|3 → "3"
 * seconda|ii|2 → "2"
 * prima|i|1 → "1"
 * "permanente" → "1"
 * "istituto" senza numero → "GI"
 * "interpello" → "INT"
 * Nessun match: restituisce la stringa originale trimmata.
 */
export function normalizeFascia(val: string): string {
  if (!val) return "";
  const originalTrimmed = val.trim();
  let s = val.toLowerCase();

  // Rimuovi anni e intervalli (\d{4}(/\d{2,4})?)
  s = s.replace(/\d{4}(?:\/\d{2,4})?/g, " ");

  // Rimuovi "24 mesi" se preceduto da "permanente"
  s = s.replace(/(?<=\bpermanente\b[\s\S]*?)\b24\s*mesi\b/gi, " ");

  // Token interi con word boundary, mai includes su singole cifre/lettere, gestisci "ª" e "°"
  const matchToken = (pattern: string) => {
    const re = new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "i");
    return re.test(s);
  };

  // 1. terza|iii|3 → "3"
  if (matchToken("(?:terza|iii|3[ª°]?)")) {
    return "3";
  }

  // 2. seconda|ii|2 → "2"
  if (matchToken("(?:seconda|ii|2[ª°]?)")) {
    return "2";
  }

  // 3. prima|i|1 → "1"
  if (matchToken("(?:prima|i|1[ª°]?)")) {
    return "1";
  }

  // 4. "permanente" → "1"
  if (matchToken("permanente")) {
    return "1";
  }

  // 5. "istituto" senza numero → "GI"
  if (matchToken("istituto")) {
    return "GI";
  }

  // 6. "interpello" → "INT"
  if (matchToken("interpello")) {
    return "INT";
  }

  return originalTrimmed;
}

/**
 * Mappa il valore normalizzato di una fascia ("1", "2", "3", "GI")
 * all'etichetta contrattuale standard ("Prima fascia", "Seconda fascia", "Terza fascia", "Graduatoria d'Istituto").
 */
export function formatFasciaLabel(normFascia: string): string {
  if (!normFascia) return "";
  const norm = normalizeFascia(normFascia);
  if (norm === "1") return "Prima fascia";
  if (norm === "2") return "Seconda fascia";
  if (norm === "3") return "Terza fascia";
  if (norm === "GI") return "Graduatoria d'Istituto";
  return normFascia;
}

/**
 * Normalizza codice meccanografico
 */
export function normalizeCodiceMeccanografico(codice?: string): string {
  if (!codice) return "";
  return codice.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Tutte le 107 province italiane ufficiali (sigla a 2 lettere)
export const ITALIAN_PROVINCES = new Set([
  "AG", "AL", "AN", "AO", "AP", "AQ", "AR", "AT", "AV", "BA", "BG", "BI", "BL", "BN", "BO", "BR", "BS", "BT", "BZ",
  "CA", "CB", "CE", "CH", "CI", "CL", "CN", "CO", "CR", "CS", "CT", "CZ", "EN", "FC", "FE", "FG", "FI", "FM", "FR",
  "GE", "GO", "GR", "IM", "IS", "KR", "LC", "LE", "LI", "LO", "LT", "LU", "MB", "MC", "ME", "MI", "MN", "MO", "MS",
  "MT", "NA", "NO", "NU", "OR", "PA", "PC", "PD", "PE", "PG", "PI", "PN", "PO", "PR", "PT", "PU", "PV", "PZ", "RA",
  "RC", "RE", "RG", "RI", "RM", "RN", "RO", "SA", "SI", "SO", "SP", "SR", "SS", "SU", "SV", "TA", "TE", "TN", "TO",
  "TP", "TR", "TS", "TV", "UD", "VA", "VB", "VC", "VE", "VI", "VR", "VT", "VV"
]);

// Tipologie ministeriali di istituto scolastico (caratteri 3-4 del codice meccanografico)
export const SCHOOL_TYPE_CODES = new Set([
  "IC", // Istituto Comprensivo
  "IS", // Istituto Superiore
  "PC", // Liceo Classico
  "PS", // Liceo Scientifico
  "PM", // Istituto Magistrale / Scienze Umane
  "PL", // Liceo Linguistico
  "SL", // Liceo Artistico
  "TD", // Tecnico Economico / Commerciale
  "TF", // Tecnico Tecnologico / Industriale
  "TL", // Tecnico Costruzioni Ambiente e Territorio (Geometri)
  "TN", // Tecnico Trasporti e Logistica (Nautico)
  "TA", // Tecnico Agrario
  "TT", // Tecnico Turismo
  "RH", // Professionale Enogastronomia e Ospitalità Alberghiera
  "RC", // Professionale Servizi Commerciali
  "RI", // Professionale Industria e Artigianato
  "RA", // Professionale Agricoltura
  "EE", // Circolo Didattico / Primaria
  "MM", // Scuola Media / Secondaria I grado
  "AA", // Scuola dell'Infanzia
  "CT", // Centro Territoriale
  "SS", // Scuola Speciale / Convitto
  "VC", // Convitto / Educandato
  "SD", // Istituto Statale d'Arte
  "1D", "1A", "1B"
]);

/**
 * Valida un codice meccanografico secondo lo standard MIUR/MIM:
 * Esattamente 10 caratteri alfanumerici:
 * - 2 lettere di provincia valide (es. RM, MI, NA, CH, TO, ...)
 * - 2 lettere/cifre di tipologia scuola (es. IC, IS, PC, PS, TF, TD, EE, MM, ...)
 * - 5 cifre numeriche o alfanumeriche (solitamente con cifre come 81000, 00100)
 * - 1 lettera o cifra di controllo finale
 */
export function isValidCodiceMeccanografico(codice?: string): boolean {
  if (!codice) return false;
  const clean = codice.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 10) return false;

  const prov = clean.slice(0, 2);
  if (!ITALIAN_PROVINCES.has(prov)) return false;

  const typeCode = clean.slice(2, 4);
  const isValidType = SCHOOL_TYPE_CODES.has(typeCode) || /^[A-Z0-9]{2}$/.test(typeCode);
  if (!isValidType) return false;

  // Caratteri 5-9: contengono cifre numeriche
  const middle = clean.slice(4, 9);
  if (!/[0-9]/.test(middle)) return false;

  return true;
}

/**
 * Estrae e rinforza la ricerca del codice meccanografico da un testo libero, HTML, email istituzionali o URL.
 * Applica molteplici euristiche in ordine di precisione:
 * 1. Email o PEC istituzionale MIUR/MIM (@istruzione.it o @pec.istruzione.it)
 * 2. Etichette esplicite (C.M., Cod. Mecc., Codice Scuola, ecc.)
 * 3. Analisi del dominio e percorso URL
 * 4. Pattern con tipologie scolastiche riconosciute (IC, IS, PC, PS, TF, TD, RH, EE, MM)
 * 5. Scansione generica di stringhe a 10 caratteri con validazione della provincia
 */
export function extractCodiceMeccanograficoFromText(text?: string, url?: string): string | null {
  const content = text || "";

  // 1. Email o PEC istituzionale ministeriale (massima certezza: chic81000a@istruzione.it -> CHIC81000A)
  const emailRegex = /\b([a-zA-Z]{2}[a-zA-Z0-9]{2}[0-9a-zA-Z]{5}[a-zA-Z0-9])@(istruzione|pec\.istruzione)\.it\b/gi;
  let match: RegExpExecArray | null;
  while ((match = emailRegex.exec(content)) !== null) {
    const candidate = match[1].toUpperCase();
    if (isValidCodiceMeccanografico(candidate)) {
      return candidate;
    }
  }

  // 2. Diciture ed etichette esplicite: "C.M.: ...", "Cod. Mecc.: ...", "Codice Meccanografico: ...", "Cod. Scuola: ..."
  const labelRegex = /(?:cod(?:ice)?\.?\s*mecc(?:anografico)?|c\.?\s*m\.?|cod\.?\s*scuola|codice\s+istituto|codice\s+ministeriale|codice\s+univoco\s+ufficio)\s*[:\-\s]\s*([a-zA-Z0-9]{10})\b/gi;
  while ((match = labelRegex.exec(content)) !== null) {
    const candidate = match[1].toUpperCase();
    if (isValidCodiceMeccanografico(candidate)) {
      return candidate;
    }
  }

  // 3. Verifica nel dominio o percorso URL (es: "www.chic81000a.edu.it", "/chic81000a/")
  if (url) {
    try {
      const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
      const hostParts = parsedUrl.hostname.split(".");
      for (const part of hostParts) {
        const candidate = part.toUpperCase();
        if (isValidCodiceMeccanografico(candidate)) {
          return candidate;
        }
      }
      const pathSegments = parsedUrl.pathname.split(/[\/\-_]/);
      for (const seg of pathSegments) {
        const candidate = seg.toUpperCase();
        if (isValidCodiceMeccanografico(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Ignora errori di parsing URL
    }
  }

  // 4. Pattern mirato con tipologie scolastiche standard (es: CHIC81000A, RMIS00100B, MIPC01000C)
  const schoolTypeRegex = /\b([A-Z]{2}(?:IC|IS|PC|PS|PM|PL|SL|TD|TF|TL|TN|TA|TT|RH|RC|RI|RA|EE|MM|AA|CT|SS|VC|SD)[0-9][0-9A-Z]{4}[A-Z0-9])\b/gi;
  while ((match = schoolTypeRegex.exec(content)) !== null) {
    const candidate = match[1].toUpperCase();
    if (isValidCodiceMeccanografico(candidate)) {
      return candidate;
    }
  }

  // 5. Pattern generico 10 caratteri con provincia italiana valida
  const genericCandidates = content.match(/\b([A-Za-z]{2}[A-Za-z0-9]{2}[0-9A-Za-z]{5}[A-Za-z0-9])\b/g);
  if (genericCandidates) {
    for (const raw of genericCandidates) {
      const candidate = raw.toUpperCase();
      if (isValidCodiceMeccanografico(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Estrae un numero intero di posizione da stringhe come "313", "Pos. 42", "n. 15"
 */
export function parsePosizioneNumber(posStr?: string | number): number | null {
  if (posStr === null || posStr === undefined) return null;
  if (typeof posStr === "number") return isNaN(posStr) || posStr <= 0 ? null : Math.floor(posStr);
  const clean = String(posStr).replace(/[^\d]/g, "");
  if (!clean) return null;
  const num = parseInt(clean, 10);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Carica le graduatorie salvate in LocalStorage.
 * Restituisce [] se lo storage è vuoto o corrotto.
 */
export function getStoredGraduatorie(): GraduatoriaIstituto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Errore lettura graduatorie da LocalStorage:", e);
    return [];
  }
}

/**
 * Salva le graduatorie in LocalStorage
 */
export function saveStoredGraduatorie(list: GraduatoriaIstituto[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Errore salvataggio graduatorie in LocalStorage:", e);
  }
}



/**
 * Parser per importare graduatorie da testo o CSV/TSV
 * Formati supportati:
 *   posizione;punteggio;cognome_nome
 *   oppure tabulare copiata da PDF graduatoria: "1 54.50 ROSSI M."
 */
export function parseGraduatoriaText(
  text: string,
  metadata: {
    codice_meccanografico?: string;
    nome_istituto?: string;
    tipologia_personale: "ATA" | "DOCENTE";
    profilo_o_cdc: string;
    fascia: string;
    anno_scolastico?: string;
  }
): GraduatoriaIstituto {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries: GraduatoriaIstitutoEntry[] = [];

  for (const line of lines) {
    // Salta intestazioni tipiche
    if (/^(pos|posizione|posto|graduatoria|cognome|punti|punteggio)/i.test(line)) {
      continue;
    }

    // Tentativo 1: CSV con virgola o punto e virgola (es. 1;45,50;ROSSI MARIO o 1,45.50)
    let parts: string[] = [];
    if (line.includes(";")) {
      parts = line.split(";").map(p => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map(p => p.trim());
    } else if (line.includes(",")) {
      // Se ci sono più virgole o una sola
      const commas = line.split(",").map(p => p.trim());
      if (commas.length >= 2 && !isNaN(parseInt(commas[0], 10))) {
        parts = commas;
      }
    }

    if (parts.length >= 2) {
      const pos = parseInt(parts[0].replace(/[^\d]/g, ""), 10);
      const puntRaw = parts[1].replace(",", ".").replace(/[^\d.-]/g, "");
      const punt = parseFloat(puntRaw);
      const nome = parts[2] || undefined;

      if (!isNaN(pos) && pos > 0 && !isNaN(punt)) {
        entries.push({
          posizione: pos,
          punteggio: Number(punt.toFixed(2)),
          cognome_nome: nome,
        });
        continue;
      }
    }

    // Tentativo 2: Regex su riga di testo tipo "1   65,25   ROSSI G." oppure "1 45.20"
    const match = line.match(/^(\d{1,5})[\s|;,\t]+([\d]+[.,][\d]{1,2}|[\d]+)(?:[\s|;,\t]+(.*))?$/);
    if (match) {
      const pos = parseInt(match[1], 10);
      const punt = parseFloat(match[2].replace(",", "."));
      const nome = match[3] ? match[3].trim() : undefined;
      if (!isNaN(pos) && pos > 0 && !isNaN(punt)) {
        entries.push({
          posizione: pos,
          punteggio: Number(punt.toFixed(2)),
          cognome_nome: nome,
        });
      }
    }
  }

  // Ordina per posizione
  entries.sort((a, b) => a.posizione - b.posizione);

  return {
    id: "grad_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    codice_meccanografico: metadata.codice_meccanografico?.trim().toUpperCase(),
    nome_istituto: metadata.nome_istituto ? safeDecodeURIComponent(metadata.nome_istituto.trim()) : undefined,
    tipologia_personale: metadata.tipologia_personale,
    profilo_o_cdc: normalizeProfiloOrCdc(metadata.profilo_o_cdc),
    fascia: normalizeFascia(metadata.fascia),
    anno_scolastico: metadata.anno_scolastico || "2024/2025 - 2026/2027",
    graduatoria: entries,
  };
}

// -------------------------------------------------------------
// TASK 5.1 — Ricerca pagina graduatorie su stesso dominio (max 5)
// -------------------------------------------------------------

export interface ExploredGraduatoriaPage {
  url: string;
  title: string;
  keywordMatched: string;
  content: string;
  format: "html" | "markdown" | "buffer";
  pdfLinks: string[];
}

export interface GraduatoriaCandidateLink {
  url: string;
  title: string;
  keyword: string;
  priority: number;
}

/**
 * Verifica se un testo o URL fa riferimento a graduatorie, albo pretorio o amministrazione trasparente
 */
export function isGraduatoriaLink(text: string, href: string): { matches: boolean; keyword: string; priority: number } {
  const cleanText = safeDecodeURIComponent(text || "");
  const cleanHref = safeDecodeURIComponent(href || "");
  const combined = `${cleanText} ${cleanHref}`.toLowerCase();

  // 1. albo pretorio / albo online / pubblicità legale
  if (
    combined.includes("albo pretorio") ||
    combined.includes("albo-pretorio") ||
    combined.includes("albopretorio") ||
    combined.includes("albo online") ||
    combined.includes("albo-online") ||
    combined.includes("/albo/") ||
    combined.includes("albipretorionline") ||
    combined.includes("bacheca") ||
    combined.includes("pubblicita legale") ||
    combined.includes("pubblicità legale")
  ) {
    return { matches: true, keyword: "albo pretorio", priority: 10 };
  }

  // 2. amministrazione trasparente / trasparenza
  if (
    combined.includes("amministrazione trasparente") ||
    combined.includes("amministrazione-trasparente") ||
    combined.includes("amministrazionetrasparente") ||
    combined.includes("/amministrazione_trasparente") ||
    combined.includes("/trasparenza") ||
    combined.includes("trasparenza-pa")
  ) {
    return { matches: true, keyword: "amministrazione trasparente", priority: 8 };
  }

  // 3. graduatoria / graduatorie (mantenuta solo se contiene anche albo, trasparenza, o pubblicità legale)
  if (
    (/\bgraduatorie?\b/i.test(combined) || combined.includes("graduatoria") || combined.includes("graduatorie")) &&
    (combined.includes("albo") || combined.includes("trasparenza") || combined.includes("pubblicit") || combined.includes("bacheca"))
  ) {
    return { matches: true, keyword: "graduatoria/e", priority: 9 };
  }

  return { matches: false, keyword: "", priority: 0 };
}

/**
 * Normalizza il dominio rimuovendo protocollo, prefisso www. e porta
 */
export function normalizeDomainForComparison(urlStr: string): string {
  if (!urlStr) return "";
  try {
    const formatted = urlStr.startsWith("http://") || urlStr.startsWith("https://")
      ? urlStr
      : `https://${urlStr}`;
    const parsed = new URL(formatted);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return urlStr.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

/**
 * Verifica se un dominio esterno è un portale scolastico o di trasparenza autorizzato (es. Spaggiari, Nuvola, Argo, Axios).
 */
export function isAllowedExternalDomain(linkDomain: string): boolean {
  if (!linkDomain) return false;
  const allowedExts = [
    "spaggiari.eu",
    "madisoft.it",
    "argo-enti.it",
    "axioscloud.it",
    "zippy.it",
    "trasparenza-valutazione-merito.it",
    "pubblicitalegale.gov.it",
    "albopretorio.it"
  ];
  return allowedExts.some(ext => linkDomain === ext || linkDomain.endsWith("." + ext));
}

/**
 * Trova i link candidati relativi a graduatoria, amministrazione trasparente o albo pretorio
 * filtrando sullo stesso dominio di base o su portali esterni autorizzati (es. Spaggiari, Nuvola, Argo).
 */
export function findGraduatoriaCandidateLinks(
  rawContent: string,
  baseUrl: string,
  doc?: Document
): GraduatoriaCandidateLink[] {
  const candidates: GraduatoriaCandidateLink[] = [];
  const seen = new Set<string>();
  const baseDomain = normalizeDomainForComparison(baseUrl);

  const addCandidate = (rawUrl: string, title: string) => {
    if (!rawUrl) return;
    const cleanUrl = rawUrl.trim();
    if (
      cleanUrl.startsWith("#") ||
      cleanUrl.startsWith("javascript:") ||
      cleanUrl.startsWith("mailto:") ||
      cleanUrl.startsWith("tel:")
    ) {
      return;
    }

    try {
      const resolved = new URL(cleanUrl, baseUrl).href;
      if (seen.has(resolved)) return;

      // Stesso dominio o dominio esterno autorizzato (es. Spaggiari, Nuvola, Argo, Axios)
      const linkDomain = normalizeDomainForComparison(resolved);
      const isExternalAllowed = isAllowedExternalDomain(linkDomain);
      if (linkDomain !== baseDomain && !isExternalAllowed) {
        return; // Salta link esterni fuori dai domini scolastici autorizzati
      }

      const match = isGraduatoriaLink(title, resolved);
      if (match.matches) {
        seen.add(resolved);
        candidates.push({
          url: resolved,
          title: safeDecodeURIComponent((title || resolved).trim()),
          keyword: match.keyword,
          priority: match.priority,
        });
      }
    } catch {
      // Ignora URL non validi
    }
  };

  // 1. Estrazione link da Markdown: [Titolo](URL)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)\'\"]+)\)/g;
  let match;
  while ((match = mdRegex.exec(rawContent)) !== null) {
    addCandidate(match[2], match[1]);
  }

  // 2. Estrazione da HTML se disponibile
  if (doc) {
    const anchors = Array.from(doc.querySelectorAll("a"));
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent || a.getAttribute("title") || a.getAttribute("aria-label") || "";
      addCandidate(href, text);
    }
  } else if (rawContent.includes("<a ") || rawContent.includes("<A ")) {
    // Fallback regex su tag <a> HTML
    const aRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = aRegex.exec(rawContent)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, "").trim();
      addCandidate(href, text);
    }
  }

  // Ordina per priorità decrescente (graduatorie prima di albo/trasparenza)
  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * 5.1 — Trigger + ricerca pagina graduatoria
 * Segue i link individuati (stesso dominio) tramite fetchWithProxy fino a max 5 pagine.
 */
export async function searchGraduatoriaPages(
  baseUrl: string,
  fetchFn: (
    url: string,
    asArrayBuffer?: boolean,
    onLog?: (msg: string) => void
  ) => Promise<{ data: any; method?: string; format: "html" | "markdown" | "buffer" }>,
  onLog?: (msg: string) => void,
  initialContent?: string,
  initialDoc?: Document
): Promise<ExploredGraduatoriaPage[]> {
  onLog?.(`🔎 Cerco in graduatoria...`);
  const exploredPages: ExploredGraduatoriaPage[] = [];
  const visitedUrls = new Set<string>();
  const MAX_PAGES = 5;

  // Marca la homepage come visitata per non rianalizzarla inutilmente
  visitedUrls.add(baseUrl);
  try {
    const normBase = new URL(baseUrl).origin;
    visitedUrls.add(normBase);
    visitedUrls.add(`${normBase}/`);
  } catch {}

  // 1. Trova candidati iniziali
  let candidateLinks: GraduatoriaCandidateLink[] = [];
  if (initialContent) {
    candidateLinks = findGraduatoriaCandidateLinks(initialContent, baseUrl, initialDoc);
  }

  // Se non abbiamo candidati iniziali o initialContent era vuoto, proviamo a scaricare la homepage
  if (candidateLinks.length === 0) {
    try {
      onLog?.(`Analisi homepage per individuazione sezioni Graduatorie / Albo / Trasparenza...`);
      const homeRes = await fetchFn(baseUrl, false, onLog);
      const raw = homeRes.data as string;
      candidateLinks = findGraduatoriaCandidateLinks(raw, baseUrl);
    } catch (e: any) {
      onLog?.(`Impossibile interrogare la homepage per le graduatorie: ${e.message}`);
    }
  }

  onLog?.(`Trovati ${candidateLinks.length} link candidati (graduatorie/albo/trasparenza) su ${baseUrl}`);

  const queue: GraduatoriaCandidateLink[] = [...candidateLinks];

  // 2. Esplora i link in coda fino a max 5 pagine
  while (queue.length > 0 && exploredPages.length < MAX_PAGES) {
    const current = queue.shift()!;
    if (visitedUrls.has(current.url)) continue;
    visitedUrls.add(current.url);

    const pageNum = exploredPages.length + 1;
    onLog?.(`Esplorazione pagina graduatoria (${pageNum}/${MAX_PAGES}): "${current.title}" (${current.url}) [tipo: ${current.keyword}]`);

    try {
      const res = await fetchFn(current.url, false, onLog);
      const rawData = res.data as string;
      let textContent = "";
      const pdfs: string[] = [];

      if (res.format === "html") {
        if (typeof window !== "undefined" && window.DOMParser) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawData, "text/html");
          textContent = doc.body?.textContent?.replace(/\s+/g, " ").trim() || "";

          // Individua PDF allegati
          const anchors = Array.from(doc.querySelectorAll("a"));
          for (const a of anchors) {
            const h = a.getAttribute("href") || "";
            if (h.toLowerCase().includes(".pdf") || h.toLowerCase().includes("/allegat") || h.toLowerCase().includes("/download")) {
              try {
                const fullPdf = new URL(h, current.url).href;
                if (!pdfs.includes(fullPdf)) {
                  pdfs.push(fullPdf);
                }
              } catch {}
            }
          }

          // Se abbiamo ancora spazio nelle 5 pagine, raccogli eventuali sottolink specifici su questa pagina (es. da trasparenza a graduatorie)
          if (exploredPages.length + 1 < MAX_PAGES) {
            const nestedCandidates = findGraduatoriaCandidateLinks(rawData, current.url, doc);
            for (const n of nestedCandidates) {
              if (!visitedUrls.has(n.url) && !queue.some(q => q.url === n.url)) {
                // Se è una graduatoria specifica, mettila in testa
                if (n.keyword === "graduatoria/e") {
                  queue.unshift(n);
                } else {
                  queue.push(n);
                }
              }
            }
          }
        } else {
          textContent = rawData.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
      } else {
        textContent = rawData.replace(/[#*`_\[\]]/g, " ").replace(/\s+/g, " ").trim();
        // Estrai PDF links da markdown
        const pdfMatches = rawData.match(/https?:\/\/[^\s\)\'\"]+\.pdf/gi);
        if (pdfMatches) {
          for (const p of pdfMatches) {
            if (!pdfs.includes(p)) pdfs.push(p);
          }
        }
      }

      onLog?.(`Pagina letta con successo: "${current.title}" (${textContent.length} caratteri estratti, ${pdfs.length} allegati/PDF rilevati)`);

      exploredPages.push({
        url: current.url,
        title: safeDecodeURIComponent(current.title),
        keywordMatched: current.keyword,
        content: textContent,
        format: res.format,
        pdfLinks: pdfs,
      });
    } catch (err: any) {
      onLog?.(`Avviso lettura link graduatoria ${current.url}: ${err.message}`);
    }
  }

  onLog?.(`Completata ricerca graduatorie: ${exploredPages.length} pagine esplorate su ${baseUrl}`);
  return exploredPages;
}

// -------------------------------------------------------------
// TASK 5.2 — Estrazione + Matching Graduatoria
// -------------------------------------------------------------

export interface GraduatoriaMeta {
  tipologia_personale: "ATA" | "DOCENTE" | null;
  fascia: string | null;
  profilo_o_cdc: string | null;
  anno_scolastico: string | null;
}

export interface GraduatoriaExtractedEntry {
  nominativo: string;
  punteggio: number | null;
  posizione?: number | null;
  classe_concorso?: string;
  fascia?: string | null;
}

export interface GraduatoriaExtractionResult {
  meta: GraduatoriaMeta;
  graduatoria_entries: GraduatoriaExtractedEntry[];
}

export const GRADUATORIA_EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrazione precisa di dati da graduatorie d'istituto scolastiche italiane (Docenti e Personale ATA) pubblicate su pagine web, albi pretori o file PDF.

SCHEMA JSON OBBLIGATORIO:
{
  "meta": {
    "tipologia_personale": "ATA" | "DOCENTE" | null,
    "fascia": string | null,
    "profilo_o_cdc": string | null,
    "anno_scolastico": string | null
  },
  "graduatoria_entries": [
    {
      "nominativo": "COGNOME NOME o NOME COGNOME",
      "punteggio": number | null,
      "posizione": number | null,
      "classe_concorso": string,
      "fascia": string | null
    }
  ]
}

REGOLE CRITICHE:
1. "meta": Estrai i metadati ESCLUSIVAMENTE dall'intestazione del documento:
   - "tipologia_personale": "ATA" o "DOCENTE" (oppure null).
   - "fascia": es. "1", "2", "3", "Prima fascia", "Permanente" (oppure null).
   - "profilo_o_cdc": codice classe di concorso (es. "A-22", "A-12", "ADMM") o profilo ATA (es. "CS", "AA", "AT") (oppure null).
   - "anno_scolastico": es. "2024/2025", "2024/2027" (oppure null).
   - REGOLA ASSOLUTA (ZERO ALLUCINAZIONI): Qualsiasi campo non presente nel testo o illeggibile deve essere RIGOROSAMENTE null, MAI inventato o presupposto (mai inventare 0 o "N/D").
2. "graduatoria_entries":
   - Ricevi la lista dei nominativi cercati nel prompt utente.
   - Restituisci SOLO ed ESCLUSIVAMENTE le righe corrispondenti a quei nominativi cercati (considera nome e cognome anche invertiti, es. "MARIO ROSSI" o "ROSSI MARIO").
   - Non estrarre altri nominativi non inclusi nella lista cercata.
   - "punteggio": Deve essere un valore numerico valido con eventuali decimali (es. 54.5, 88.0, 112.5). Se il punteggio non è presente o non è riportato, imposta RIGOROSAMENTE null. MAI restituire 0 se il punteggio è assente.
   - "posizione": Numero intero della posizione in graduatoria se presente, altrimenti null.
   - "classe_concorso": Codice classe di concorso o profilo ATA della riga/graduatoria.
   - "fascia": Fascia della graduatoria per questa specifica riga/candidato (es. "1", "2", "3", "Prima fascia", "Permanente", ecc., string | null) ricavata dalla sezione o intestazione a cui appartiene. Se non determinabile a livello di riga/sezione, imposta null.
3. GERARCHIA FONTI IN CASO DI CONFLITTO: Dai priorità al dispositivo/tabella finale ("DECRETA", "DISPONE", tabelle nominative) rispetto alle premesse ("VISTO", "CONSIDERATO", che spesso citano soglie o casi diversi dal candidato).
4. OCR/SCANSIONI: Se il testo sembra frutto di OCR impreciso, distingui con attenzione 0/O, 1/I, 5/S dal contesto numerico o alfabetico. Se una lettera/cifra è coperta o illeggibile, usa solo ciò che è visibile con certezza; in caso di dubbio reale, imposta il campo a null.
5. Rispondi RIGOROSAMENTE ed ESCLUSIVAMENTE con l'oggetto JSON richiesto, senza blocchi markdown esterni o testo addizionale.`;

/**
 * Prefiltra il testo di una pagina o documento di graduatoria:
 * - Intestazione completa (primi 1500 caratteri) SOLO per la prima pagina/sezione;
 *   per le altre sezioni SOLO le righe con i cognomi cercati (±3 righe di contesto, oppure 0 per il retry).
 */
export function prefilterGraduatoriaText(text: string, targetNames: string[], contextLines: number = 3): string {
  if (!text) return "";
  const cleanedNames = targetNames
    .map(n => n.trim())
    .filter(n => n.length >= 2);

  // Se nessun nominativo target fornito, estrai primi 3000 caratteri
  if (cleanedNames.length === 0) {
    return text.slice(0, 3000);
  }

  // Estrai i token significativi (lunghezza >= 3 caratteri per evitare falsi positivi con particelle)
  const searchTokens = new Set<string>();
  for (const name of cleanedNames) {
    const tokens = name
      .toLowerCase()
      .replace(/[^a-z0-9àèéìòù]/gi, " ")
      .split(/\s+/)
      .filter(t => t.length >= 3);
    for (const t of tokens) searchTokens.add(t);
  }

  // Suddividi per pagine se sono presenti delimitatori di pagina PDF, altrimenti tratta l'intero testo
  const pageSections = text.split(/(?=\n--- PAGINA \d+)/i);
  const resultBlocks: string[] = [];

  for (let sIdx = 0; sIdx < pageSections.length; sIdx++) {
    const section = pageSections[sIdx];
    const lines = section.split("\n");
    let headerText = "";
    let headerLineCount = 0;

    // Intestazione completa (1500 car.) SOLO per la prima pagina/sezione
    if (sIdx === 0) {
      for (let i = 0; i < lines.length; i++) {
        if (headerText.length + lines[i].length <= 1500) {
          headerText += lines[i] + "\n";
          headerLineCount = i + 1;
        } else {
          break;
        }
      }
    }

    const matchedLineIndices = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      let matched = false;
      for (const tok of searchTokens) {
        const re = new RegExp(`(?<![a-z0-9àèéìòù])${tok}(?![a-z0-9àèéìòù])`, "i");
        if (re.test(lineLower)) {
          matched = true;
          break;
        }
      }
      if (matched) {
        if (contextLines > 0) {
          const minJ = Math.max(0, i - contextLines);
          const maxJ = Math.min(lines.length - 1, i + contextLines);
          for (let j = minJ; j <= maxJ; j++) {
            if (sIdx === 0 && j < headerLineCount) {
              // già nell'intestazione della prima pagina
              continue;
            }
            matchedLineIndices.add(j);
          }
        } else {
          // Senza contesto ±3 (solo righe matchate)
          if (!(sIdx === 0 && i < headerLineCount)) {
            matchedLineIndices.add(i);
          }
        }
      }
    }

    let block = headerText.trim();
    const sortedIndices = Array.from(matchedLineIndices).sort((a, b) => a - b);
    if (sortedIndices.length > 0) {
      if (block) {
        block += "\n\n... [RIGHE CON CANDIDATI CERCATI] ...\n";
      }
      let prevIdx = -1;
      for (const idx of sortedIndices) {
        if (prevIdx !== -1 && idx > prevIdx + 1) {
          block += "...\n";
        }
        block += lines[idx] + "\n";
        prevIdx = idx;
      }
    }

    if (block.trim()) {
      resultBlocks.push(block.trim());
    }
  }

  return resultBlocks.filter(Boolean).join("\n\n");
}

/**
 * Costruisce il messaggio utente per l'estrazione della graduatoria
 * specificando esplicitamente i nominativi cercati
 */
export function buildGraduatoriaUserPrompt(filteredText: string, targetNames: string[]): string {
  const nomList = targetNames.filter(Boolean).join(", ");
  return `NOMINATIVI DA CERCARE (estrai SOLO le righe di questi candidati, gestendo cognome/nome anche invertiti):\n${nomList || "Tutti i candidati presenti"}\n\nTESTO GRADUATORIA PRE-FILTRATO:\n${filteredText}`;
}

/**
 * Esegue il parsing del JSON della graduatoria con ritentativo:
 * - Tentativo 1: prefiltro con intestazione pagina 1 + righe matchate (±3 righe di contesto)
 * - Tentativo 2 (Retry): non dimezza il testo. Ripete con intestazione pagina 1 + solo righe matchate (senza contesto ±3)
 * - Aggiunge "fascia" per ogni riga (con meta.fascia come fallback se la riga non la specifica)
 */
export async function extractGraduatoriaWithRetry(
  text: string,
  targetNames: string[],
  apiKey: string,
  fetchFn: (promptText: string, sysPrompt: string) => Promise<any>,
  onLog?: (msg: string) => void
): Promise<GraduatoriaExtractionResult | null> {
  const filtered = prefilterGraduatoriaText(text, targetNames, 3);
  if (!filtered || filtered.trim().length < 20) {
    onLog?.("Nessun testo utile dopo il pre-filtraggio per i nominativi cercati.");
    return null;
  }

  const mapEntriesWithFasciaFallback = (entries: any[], metaFascia: string | null): GraduatoriaExtractedEntry[] => {
    if (!Array.isArray(entries)) return [];
    return entries.map(entry => {
      const rawFascia = entry?.fascia;
      const entryFascia = (rawFascia !== undefined && rawFascia !== null && String(rawFascia).trim() !== "" && String(rawFascia).toLowerCase() !== "null")
        ? String(rawFascia).trim()
        : (metaFascia || null);

      return {
        ...entry,
        fascia: entryFascia,
      };
    });
  };

  const prompt1 = buildGraduatoriaUserPrompt(filtered, targetNames);

  try {
    const rawRes1 = await fetchFn(prompt1, GRADUATORIA_EXTRACTION_SYSTEM_PROMPT);
    const content1 = rawRes1?.choices?.[0]?.message?.content || "";
    const parsed1 = JSON.parse(content1);
    if (parsed1 && typeof parsed1 === "object") {
      const meta: GraduatoriaMeta = parsed1.meta || {
        tipologia_personale: null,
        fascia: null,
        profilo_o_cdc: null,
        anno_scolastico: null,
      };
      return {
        meta,
        graduatoria_entries: mapEntriesWithFasciaFallback(parsed1.graduatoria_entries, meta.fascia),
      };
    }
  } catch (err1: any) {
    onLog?.(`Risposta non in formato JSON valido (${err1.message}). Nuovo tentativo con intestazione pagina 1 + solo righe matchate...`);
  }

  // Tentativo 2: non dimezzare il testo. Ripeti con intestazione pagina 1 + solo righe matchate (senza contesto ±3)
  try {
    const retryFiltered = prefilterGraduatoriaText(text, targetNames, 0);
    const prompt2 = buildGraduatoriaUserPrompt(retryFiltered, targetNames);
    const rawRes2 = await fetchFn(prompt2, GRADUATORIA_EXTRACTION_SYSTEM_PROMPT);
    const content2 = rawRes2?.choices?.[0]?.message?.content || "";
    const parsed2 = JSON.parse(content2);
    if (parsed2 && typeof parsed2 === "object") {
      const meta: GraduatoriaMeta = parsed2.meta || {
        tipologia_personale: null,
        fascia: null,
        profilo_o_cdc: null,
        anno_scolastico: null,
      };
      return {
        meta,
        graduatoria_entries: mapEntriesWithFasciaFallback(parsed2.graduatoria_entries, meta.fascia),
      };
    }
  } catch (err2: any) {
    console.error("Errore irreversibile parsing JSON graduatoria:", err2);
    onLog?.(`Errore estrazione graduatoria (JSON non valido anche al secondo tentativo): ${err2.message}`);
  }

  return null;
}

/**
 * Confronta due nominativi gestendo l'ordine nome/cognome invertito.
 * Non accetta errori di battitura (no fuzzy matching).
 * Esempio: "MARIO ROSSI" corrisponde a "ROSSI MARIO".
 */
export function isNameMatch(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;

  const cleanTokens = (str: string): string[] =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9àèéìòù]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const tokensA = cleanTokens(nameA);
  const tokensB = cleanTokens(nameB);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Corrispondenza esatta di tutti i token (ordine invariante)
  const sortedA = [...tokensA].sort().join(" ");
  const sortedB = [...tokensB].sort().join(" ");
  if (sortedA === sortedB) return true;

  // Gestione di 2 parole: A B === B A
  if (tokensA.length === 2 && tokensB.length === 2) {
    if (tokensA[0] === tokensB[1] && tokensA[1] === tokensB[0]) return true;
  }

  // Gestione di iniziali es: "M. ROSSI" o "ROSSI M." con "MARIO ROSSI"
  if (tokensA.length === 2 && tokensB.length === 2) {
    const isInitA = tokensA[0].length === 1 || tokensA[1].length === 1;
    const isInitB = tokensB[0].length === 1 || tokensB[1].length === 1;
    if (isInitA || isInitB) {
      const surnameA = tokensA[0].length > 1 ? tokensA[0] : tokensA[1];
      const surnameB = tokensB[0].length > 1 ? tokensB[0] : tokensB[1];
      const initA = tokensA[0].length === 1 ? tokensA[0] : tokensA[1][0];
      const initB = tokensB[0].length === 1 ? tokensB[0] : tokensB[1][0];
      if (surnameA === surnameB && initA === initB) return true;
    }
  }

  return false;
}

/**
 * Normalizza classe di concorso o profilo professionale per il matching.
 * - Docenti: canonicalizza a lettera-NN con zero padding (A1, A-1, A01 → "A-01"; A022 → "A-22");
 *   ADMM/ADSS/ADAA/ADEE/AAAA/EEEE invariati.
 * - ATA: CS, AA, AT, CU, CR, GU, IF come ora; se entrambi hanno area lab (AR02…) devono coincidere.
 */
export function normalizeCdcOrProfile(val?: string): string {
  if (!val) return "";
  const s = val.trim().toUpperCase();

  // Docenti sostegno: ADMM, ADSS, ADAA, ADEE, AAAA, EEEE invariati
  const SOSTEGNO = ["ADMM", "ADSS", "ADAA", "ADEE", "AAAA", "EEEE"];
  for (const code of SOSTEGNO) {
    const re = new RegExp(`(?<![A-Z0-9])${code}(?![A-Z0-9])`, "i");
    if (re.test(s)) return code;
  }
  if (/\bINFANZIA\b/i.test(s)) return "AAAA";
  if (/\bPRIMARIA\b/i.test(s)) return "EEEE";

  // ATA: CS, AA, AT, CU, CR, GU, IF
  if (/\b(COLLABORATORE(\s+SCOLASTICO)?|CS)\b/i.test(s)) return "CS";
  if (/\b(ASSISTENTE\s+AMMINISTRATIVO|AMMINISTRATIVO|AA)\b/i.test(s)) return "AA";
  if (/\b(CUOCO|CU)\b/i.test(s)) return "CU";
  if (/\b(AGRARIO|ADDETTO\s+ALLE\s+AZIENDE\s+AGRARIE|CR)\b/i.test(s)) return "CR";
  if (/\b(GUARDAROBIERE|GU)\b/i.test(s)) return "GU";
  if (/\b(INFERMIERE|IF)\b/i.test(s)) return "IF";
  if (/\b(OPERATORE(\s+SCOLASTICO)?|OS)\b/i.test(s)) return "OS";

  // Assistente tecnico (AT) con eventuale area di laboratorio ARxx
  const arMatch = s.match(/(?<![A-Z0-9])AR\s*(\d{2})(?![A-Z0-9])/i);
  if (/\b(ASSISTENTE\s+TECNICO|TECNICO|AT)\b/i.test(s) || arMatch) {
    if (arMatch) {
      return `AT_AR${arMatch[1]}`;
    }
    return "AT";
  }

  // Docenti: canonicalizza a lettera-NN con zero padding (A1, A-1, A01 → "A-01"; A022 → "A-22")
  const docMatch = s.match(/(?<![A-Z0-9])([A-Z])[\s\-_]*0*([0-9]{1,3})(?![A-Z0-9])/i);
  if (docMatch) {
    const letter = docMatch[1].toUpperCase();
    const num = parseInt(docMatch[2], 10);
    const padded = String(num).padStart(2, "0");
    return `${letter}-${padded}`;
  }

  return s;
}

/**
 * Confronta due classi di concorso o profili professionali.
 * isClassMatch: SOLO uguaglianza dei valori canonici. Elimina ogni includes().
 * Se entrambi hanno area lab (AR02...), devono coincidere.
 */
export function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return false;
  const normA = normalizeCdcOrProfile(classA);
  const normB = normalizeCdcOrProfile(classB);
  if (!normA || !normB) return false;

  // Se entrambi hanno area lab (ARxx), devono coincidere
  const labA = normA.startsWith("AT_AR") ? normA.slice(3) : null;
  const labB = normB.startsWith("AT_AR") ? normB.slice(3) : null;
  if (labA && labB) {
    return labA === labB;
  }
  if ((normA === "AT" && labB) || (normB === "AT" && labA)) {
    return true;
  }

  // SOLO uguaglianza dei valori canonici. Elimina ogni includes().
  return normA === normB;
}

// -------------------------------------------------------------
// TASK 5 — resolveFromGraduatorie
// -------------------------------------------------------------

export interface GraduatoriaCollectedEntry {
  nominativo: string;
  punteggio: number | null;
  posizione: number | null;
  fascia: string | null;
  classe: string;
  anno?: string | null;
  url: string;
  tipologia?: "ATA" | "DOCENTE" | null;
}

export interface ResolveGraduatorieOptions {
  apiKey?: string;
  targetUrl?: string;
  customProxy?: string;
  failedProxiesByDomain?: Map<string, Set<string>>;
  exploredPages?: ExploredGraduatoriaPage[];
  collectedEntries?: GraduatoriaCollectedEntry[];
  fetchAiFn?: (promptText: string, sysPrompt: string) => Promise<any>;
  fetchProxyFn?: (
    url: string,
    asArrayBuffer?: boolean,
    onLog?: (msg: string) => void
  ) => Promise<{ data: any; method?: string; format: "html" | "markdown" | "buffer" }>;
  pdfTextExtractor?: (buffer: ArrayBuffer, maxPages?: number) => Promise<{ text: string; numPages: number }>;
  pdfAiFallbackFn?: (pdfUrl: string, sysPrompt: string, targetNames?: string[]) => Promise<any>;
  onLog?: (msg: string) => void;
  initialContent?: string;
  initialDoc?: Document;
}

export function parseAnnoNumber(anno?: string | null): number | null {
  if (!anno || typeof anno !== "string") return null;
  const trimmed = anno.trim();
  const m4 = trimmed.match(/\b(19\d\d|20\d\d)\b/);
  if (m4) return parseInt(m4[1], 10);
  const m2 = trimmed.match(/\b(\d{2})\/(\d{2})\b/);
  if (m2) {
    const yr = parseInt(m2[1], 10);
    return yr < 50 ? 2000 + yr : 1900 + yr;
  }
  return null;
}

export function isClassEmpty(cls?: string | null): boolean {
  if (!cls || typeof cls !== "string") return true;
  const s = cls.trim().toLowerCase();
  return (
    s === "" ||
    s === "non applicabile" ||
    s === "non disponibile" ||
    s === "n/a" ||
    s === "n.a." ||
    s === "n/d" ||
    s === "nd" ||
    s === "-"
  );
}

export function isPunteggioMissing(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return isNaN(val);
  const s = String(val).trim().toLowerCase();
  if (
    !s ||
    s === "non disponibile" ||
    s === "da verificare manualmente" ||
    s === "null" ||
    s === "undefined" ||
    s === "n/d" ||
    s === "nd" ||
    s === "-"
  ) {
    return true;
  }
  return normalizePunteggio(val) === null;
}

export function isFasciaMissing(val: any): boolean {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  if (
    !s ||
    s === "non disponibile" ||
    s === "da verificare manualmente" ||
    s === "null" ||
    s === "undefined" ||
    s === "n/d" ||
    s === "nd" ||
    s === "-"
  ) {
    return true;
  }
  return false;
}

export function isPosizioneMissing(val: any): boolean {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  if (
    !s ||
    s === "non disponibile" ||
    s === "da verificare manualmente" ||
    s === "null" ||
    s === "undefined" ||
    s === "n/d" ||
    s === "nd" ||
    s === "-"
  ) {
    return true;
  }
  return parsePosizioneNumber(val) === null;
}

export function doesItemNeedGraduatoriaResolution(item: {
  nominativo?: string;
  punteggio?: any;
  fascia?: any;
  graduatoria_fascia?: any;
  posizione_graduatoria?: any;
}): boolean {
  const nom = (item.nominativo || "").trim();
  if (!nom) return false;
  const f = item.fascia !== undefined ? item.fascia : item.graduatoria_fascia;
  // Solo punteggio o fascia mancanti avviano la ricerca (la posizione da sola NON avvia la ricerca; se la ricerca parte, viene comunque compilata)
  return isPunteggioMissing(item.punteggio) || isFasciaMissing(f);
}

/**
 * TASK 5-quater — Verifica se una specifica nomina ha almeno una entry compatibile in collectedEntries:
 * - isNameMatch tra nominativo della nomina ed entry
 * - entry con classe non vuota (mai match per classe vuota)
 * - isClassMatch tra la classe/profilo della nomina e quella dell'entry
 * - eventuale coerenza di tipologia personale se specificata in entrambi
 * - punteggio numerico valido
 * - fascia valida (o fascia del contratto già valida)
 */
export function isNominaSatisfiedInEntries(
  nomina: {
    nominativo?: string;
    tipologia_personale?: any;
    profilo_lavorativo?: string;
    profilo_professionale?: string;
    classe_concorso_area_lab?: string;
    classe_di_concorso?: string;
    fascia?: string;
    graduatoria_fascia?: string;
    punteggio?: any;
    posizione_graduatoria?: any;
  },
  collectedEntries: GraduatoriaCollectedEntry[],
  fallbackContext?: {
    classe_concorso_area_lab?: string;
    classe_di_concorso?: string;
    profilo_lavorativo?: string;
    profilo_professionale?: string;
    tipologia_personale?: any;
  }
): boolean {
  if (!doesItemNeedGraduatoriaResolution(nomina)) {
    return true;
  }

  const nom = (nomina.nominativo || "").trim();
  if (!nom) return true;

  let rawClassCandidates = [
    nomina.classe_concorso_area_lab,
    nomina.classe_di_concorso,
    nomina.profilo_lavorativo,
    nomina.profilo_professionale,
  ].filter(c => !isClassEmpty(c)) as string[];

  if (rawClassCandidates.length === 0 && fallbackContext) {
    rawClassCandidates = [
      fallbackContext.classe_concorso_area_lab,
      fallbackContext.classe_di_concorso,
      fallbackContext.profilo_lavorativo,
      fallbackContext.profilo_professionale,
    ].filter(c => !isClassEmpty(c)) as string[];
  }

  const currentFascia = nomina.fascia !== undefined ? nomina.fascia : (nomina as any).graduatoria_fascia;
  const hasValidContractFascia = !isFasciaMissing(currentFascia);
  const contractNormFascia = hasValidContractFascia ? normalizeFascia(currentFascia) : null;
  const tipologia = nomina.tipologia_personale || fallbackContext?.tipologia_personale;

  return collectedEntries.some(e => {
    // 1) isNameMatch con il nominativo della nomina
    if (!isNameMatch(e.nominativo, nom)) return false;

    // 2) entry con classe non vuota (mai match per classe vuota)
    if (isClassEmpty(e.classe)) return false;

    // 3) isClassMatch con la sua classe/profilo
    if (rawClassCandidates.length > 0) {
      const matchClass = rawClassCandidates.some(c => isClassMatch(e.classe, c));
      if (!matchClass) return false;
    } else {
      return false;
    }

    // Tipologia personale coerente se entrambe note
    if (tipologia && e.tipologia) {
      if (String(tipologia).toUpperCase() !== String(e.tipologia).toUpperCase()) {
        return false;
      }
    }

    // 4) Punteggio numerico valido
    if (e.punteggio === null || e.punteggio === undefined || isNaN(Number(e.punteggio))) {
      return false;
    }

    // 5) Fascia numerica/valida (o fascia del contratto già valida)
    if (hasValidContractFascia && contractNormFascia) {
      // Se il contratto ha già fascia valida: entry senza fascia non contraddice, entry con fascia diversa scartata
      if (isFasciaMissing(e.fascia)) {
        return true;
      }
      return normalizeFascia(e.fascia || "") === contractNormFascia;
    } else {
      // Se il contratto non ha fascia valida, l'entry deve avere una fascia valida
      return !isFasciaMissing(e.fascia);
    }
  });
}

function resolveSingleTarget<T extends {
  nominativo?: string;
  tipologia_personale?: any;
  profilo_lavorativo?: string;
  profilo_professionale?: string;
  classe_concorso_area_lab?: string;
  classe_di_concorso?: string;
  fascia?: string;
  graduatoria_fascia?: string;
  punteggio?: number | null | string;
  origine_punteggio?: OriginePunteggio;
  posizione_graduatoria?: string;
  note_cross_reference?: string;
}>(
  item: T,
  collectedEntries: GraduatoriaCollectedEntry[],
  onLog?: (msg: string) => void,
  isTopLevel: boolean = false
): T {
  const nom = (item.nominativo || "").trim();
  if (!nom) {
    return item;
  }

  // Estrai i candidati validi per classe/profilo della nomina escludendo placeholder
  const rawClassCandidates = [
    item.classe_concorso_area_lab,
    item.classe_di_concorso,
    item.profilo_lavorativo,
    item.profilo_professionale,
  ].filter(c => !isClassEmpty(c)) as string[];

  const itemClass = rawClassCandidates[0] || "";

  const itemTipologia = item.tipologia_personale;
  const currentFascia = item.fascia !== undefined ? item.fascia : item.graduatoria_fascia;
  const hasValidContractFascia = !isFasciaMissing(currentFascia);
  const contractNormFascia = hasValidContractFascia ? normalizeFascia(currentFascia) : null;

  // 1) Match: isNameMatch con IL SUO nominativo + isClassMatch con LA SUA classe/profilo (+ tipologia coerente se nota)
  // Entry con classe vuota → esclusa dal match (mai match per solo nome).
  let matchedEntries = collectedEntries.filter(entry => {
    if (!isNameMatch(entry.nominativo, nom)) return false;
    if (isClassEmpty(entry.classe)) return false;
    if (rawClassCandidates.length === 0) return false;
    const matchAnyClass = rawClassCandidates.some(c => isClassMatch(entry.classe, c));
    if (!matchAnyClass) return false;
    if (itemTipologia && entry.tipologia) {
      if (itemTipologia.toUpperCase() !== entry.tipologia.toUpperCase()) return false;
    }
    return true;
  });

  // 3) Contratto con fascia valida: entry con fascia null NON vengono scartate (non contraddicono);
  // scarta solo quelle con fascia diversa.
  if (hasValidContractFascia && contractNormFascia) {
    matchedEntries = matchedEntries.filter(entry => {
      if (isFasciaMissing(entry.fascia)) {
        return true; // NON scartare: non contraddice
      }
      const entryNormFascia = normalizeFascia(entry.fascia || "");
      return entryNormFascia === contractNormFascia;
    });
  }

  // 2) Tra i match dello stesso nome+classe(+fascia) tieni solo quelli con anno più recente.
  const groupsByFascia = new Map<string, GraduatoriaCollectedEntry[]>();
  for (const entry of matchedEntries) {
    const fKey = !isFasciaMissing(entry.fascia) ? normalizeFascia(entry.fascia || "") : "__NONE__";
    if (!groupsByFascia.has(fKey)) {
      groupsByFascia.set(fKey, []);
    }
    groupsByFascia.get(fKey)!.push(entry);
  }

  const filteredByYearEntries: GraduatoriaCollectedEntry[] = [];
  for (const group of groupsByFascia.values()) {
    const years = group
      .map(e => parseAnnoNumber(e.anno))
      .filter((y): y is number => y !== null);
    if (years.length > 0) {
      const maxYear = Math.max(...years);
      const mostRecent = group.filter(e => {
        const y = parseAnnoNumber(e.anno);
        return y === maxYear;
      });
      filteredByYearEntries.push(...mostRecent);
    } else {
      filteredByYearEntries.push(...group);
    }
  }

  matchedEntries = filteredByYearEntries;

  const existingNotes = item.note_cross_reference || "";
  const existingSoglia = existingNotes.includes("Soglia convocazione:")
    ? ` | ${existingNotes.split("|").find((s: string) => s.includes("Soglia convocazione:"))?.trim() || ""}`
    : "";

  const label = isTopLevel ? `Top-level "${nom}"` : `Nomina "${nom}"`;

  // 5) Nessun match → "Non disponibile" per posizione/fascia mancanti, "Da verificare manualmente" solo sul punteggio se mancante
  if (matchedEntries.length === 0) {
    const updated = { ...item };
    if (isPunteggioMissing(updated.punteggio)) {
      updated.punteggio = "Da verificare manualmente";
      updated.origine_punteggio = "Non disponibile";
    }
    if (isPosizioneMissing(updated.posizione_graduatoria)) {
      updated.posizione_graduatoria = "Non disponibile";
    }
    if (isFasciaMissing(currentFascia)) {
      if (isTopLevel) {
        (updated as any).graduatoria_fascia = "Non disponibile";
      } else {
        (updated as any).fascia = "Non disponibile";
      }
    }
    onLog?.(`⚠️ ${label} (${itemClass || "N/D"}): nessun riscontro in graduatoria, campi mancanti segnati per verifica manuale`);
    return updated;
  }

  // 5) Più match con fasce diverse e fascia contratto assente → fascia e punteggio "Da verificare manualmente"
  if (!hasValidContractFascia) {
    const distinctFasce = Array.from(
      new Set(
        matchedEntries
          .filter(e => !isFasciaMissing(e.fascia))
          .map(e => normalizeFascia(e.fascia || ""))
          .filter(Boolean)
      )
    );
    if (distinctFasce.length > 1) {
      const updated = { ...item };
      updated.punteggio = "Da verificare manualmente";
      updated.origine_punteggio = "Non disponibile";
      if (isTopLevel) {
        (updated as any).graduatoria_fascia = "Da verificare manualmente";
      } else {
        (updated as any).fascia = "Da verificare manualmente";
      }
      if (isPosizioneMissing(updated.posizione_graduatoria)) {
        updated.posizione_graduatoria = "Da verificare manualmente";
      }
      updated.note_cross_reference = `Ambiguità: rilevati riscontri in fasce diverse (${distinctFasce.join(", ")}). Da verificare manualmente.${existingSoglia}`;
      onLog?.(`⚠️ ${label} (${itemClass || "N/D"}): ambiguità fasce diverse (${distinctFasce.join(", ")}), segnato per verifica manuale`);
      return updated;
    }
  }

  // 2) Se restano punteggi diversi → punteggio "Da verificare manualmente" e nota "punteggi discordanti tra graduatorie"
  const numericScores = matchedEntries
    .map(e => (e.punteggio !== null && e.punteggio !== undefined ? Number(e.punteggio) : null))
    .filter((s): s is number => s !== null && !isNaN(s));

  const distinctScores = Array.from(new Set(numericScores.map(s => Number(s.toFixed(2)))));

  if (distinctScores.length > 1) {
    const updated = { ...item };
    updated.punteggio = "Da verificare manualmente";
    updated.origine_punteggio = "Non disponibile";
    if (isPosizioneMissing(updated.posizione_graduatoria)) {
      updated.posizione_graduatoria = "Non disponibile";
    }
    if (isFasciaMissing(currentFascia)) {
      const distinctFasce = Array.from(
        new Set(
          matchedEntries
            .filter(e => !isFasciaMissing(e.fascia))
            .map(e => normalizeFascia(e.fascia || ""))
            .filter(Boolean)
        )
      );
      if (distinctFasce.length === 1) {
        const formattedF = formatFasciaLabel(distinctFasce[0]);
        if (isTopLevel) {
          (updated as any).graduatoria_fascia = formattedF;
        } else {
          (updated as any).fascia = formattedF;
        }
      } else {
        if (isTopLevel) {
          (updated as any).graduatoria_fascia = "Da verificare manualmente";
        } else {
          (updated as any).fascia = "Da verificare manualmente";
        }
      }
    }
    updated.note_cross_reference = `Da verificare: punteggi discordanti tra graduatorie (${distinctScores.join(" pt vs ")} pt).${existingSoglia}`;
    onLog?.(`⚠️ ${label} (${itemClass || "N/D"}): punteggi discordanti tra graduatorie (${distinctScores.join(" vs ")} pt), segnato per verifica manuale`);
    return updated;
  }

  // Match univoco o coerente: seleziona la miglior entry
  const bestEntry =
    matchedEntries.find(e => e.punteggio !== null && e.punteggio !== undefined && !isNaN(Number(e.punteggio))) ||
    matchedEntries[0];

  const updated = { ...item };
  let punteggioCompilato = false;
  let posizioneCompilata = false;
  let fasciaCompilata = false;

  // Compila SOLO i campi mancanti:
  // - punteggio (origine_punteggio "Incrociato")
  if (isPunteggioMissing(updated.punteggio)) {
    if (bestEntry.punteggio !== null && bestEntry.punteggio !== undefined && !isNaN(Number(bestEntry.punteggio))) {
      updated.punteggio = Number(Number(bestEntry.punteggio).toFixed(2));
      updated.origine_punteggio = "Incrociato";
      punteggioCompilato = true;
    } else {
      updated.punteggio = "Da verificare manualmente";
      updated.origine_punteggio = "Non disponibile";
    }
  }

  // - posizione_graduatoria
  if (isPosizioneMissing(updated.posizione_graduatoria)) {
    if (bestEntry.posizione !== null && bestEntry.posizione !== undefined) {
      updated.posizione_graduatoria = String(bestEntry.posizione);
      posizioneCompilata = true;
    } else {
      updated.posizione_graduatoria = "Non disponibile";
    }
  }

  // - fascia (stessa etichetta del contratto es. "Prima fascia", "Seconda fascia", etc.). Se il contratto ha già una fascia valida NON toccarla
  if (isFasciaMissing(currentFascia)) {
    const rawFascia = bestEntry.fascia;
    if (rawFascia && rawFascia.trim()) {
      const formattedF = formatFasciaLabel(rawFascia);
      if (isTopLevel) {
        (updated as any).graduatoria_fascia = formattedF;
      } else {
        (updated as any).fascia = formattedF;
      }
      fasciaCompilata = true;
    } else {
      if (isTopLevel) {
        (updated as any).graduatoria_fascia = "Non disponibile";
      } else {
        (updated as any).fascia = "Non disponibile";
      }
    }
  }

  // 6) note_cross_reference: elenca solo i campi effettivamente compilati da graduatoria
  // Se il punteggio era esplicito non scrivere "Punteggio incrociato"
  const compiledParts: string[] = [];
  if (punteggioCompilato) {
    compiledParts.push(`Punteggio (${updated.punteggio} pt)`);
  }
  if (posizioneCompilata) {
    compiledParts.push(`posizione (pos. ${updated.posizione_graduatoria})`);
  }
  if (fasciaCompilata) {
    compiledParts.push("fascia");
  }

  let noteDesc = "";
  if (compiledParts.length > 0) {
    // Es. "Punteggio (45.20 pt), posizione (pos. 1) e fascia da graduatoria (URL)"
    if (compiledParts.length === 1) {
      noteDesc = `${compiledParts[0]} da graduatoria (${bestEntry.url})`;
    } else if (compiledParts.length === 2) {
      noteDesc = `${compiledParts[0]} e ${compiledParts[1]} da graduatoria (${bestEntry.url})`;
    } else {
      const last = compiledParts.pop();
      noteDesc = `${compiledParts.join(", ")} e ${last} da graduatoria (${bestEntry.url})`;
    }
  } else {
    noteDesc = `Riscontro in graduatoria (${bestEntry.url})`;
  }

  let fasciaSuffix = "";
  if (hasValidContractFascia && isFasciaMissing(bestEntry.fascia)) {
    fasciaSuffix = " (fascia graduatoria non indicata)";
  }

  const resolvedFascia = isTopLevel ? (updated as any).graduatoria_fascia : (updated as any).fascia;
  updated.note_cross_reference = `${noteDesc}${fasciaSuffix}${existingSoglia}`;

  onLog?.(`✅ ${label} (${itemClass || "N/D"}): punteggio ${updated.punteggio}, pos. ${updated.posizione_graduatoria}, fascia ${resolvedFascia}`);

  return updated;
}

/**
 * TASK 5 — Risolve i campi mancanti (punteggio, posizione, fascia) incrociando le graduatorie scolastiche.
 * Usata da App.tsx sia in modalità singola che batch.
 */
export async function resolveFromGraduatorie<T extends ExtractionData>(
  data: T,
  options: ResolveGraduatorieOptions
): Promise<T> {
  // 1) Trigger: top-level e ogni nomina con nominativo, se manca punteggio OPPURE fascia ("Non disponibile"/vuota) OPPURE posizione_graduatoria.
  const topNeeds = doesItemNeedGraduatoriaResolution({
    nominativo: data.nominativo,
    punteggio: data.punteggio,
    fascia: data.graduatoria_fascia,
    posizione_graduatoria: data.posizione_graduatoria,
  });

  const anyNominaNeeds =
    Array.isArray(data.nomine_contratti) &&
    data.nomine_contratti.some(n => doesItemNeedGraduatoriaResolution(n));

  const shouldTrigger = topNeeds || anyNominaNeeds;

  if (!shouldTrigger && (!options.collectedEntries || options.collectedEntries.length === 0)) {
    return data;
  }

  // 2) Raccogli le entries da TUTTE le pagine/PDF esplorati (nessun break al primo match)
  const collectedEntries: GraduatoriaCollectedEntry[] = [];

  if (options.collectedEntries && options.collectedEntries.length > 0) {
    collectedEntries.push(...options.collectedEntries);
  } else {
    // Costruisci l'elenco delle nomine da verificare e i nominativi per il prompt AI
    const nomineToCheck: any[] = [];
    if (Array.isArray(data.nomine_contratti) && data.nomine_contratti.length > 0) {
      for (const n of data.nomine_contratti) {
        if (n.nominativo && n.nominativo.trim()) {
          nomineToCheck.push(n);
        }
      }
    }
    if (data.nominativo && data.nominativo.trim()) {
      const alreadyIncluded = nomineToCheck.some(n => isNameMatch(n.nominativo, data.nominativo));
      if (!alreadyIncluded) {
        nomineToCheck.push(data);
      }
    }

    const targetNamesSet = new Set<string>();
    for (const n of nomineToCheck) {
      if (n.nominativo && n.nominativo.trim()) {
        targetNamesSet.add(n.nominativo.trim());
      }
    }
    const targetNamesToSearch = Array.from(targetNamesSet);

    if (targetNamesToSearch.length === 0) {
      return data;
    }

    let exploredPages = options.exploredPages || [];
    if (exploredPages.length === 0 && options.fetchProxyFn && options.targetUrl) {
      options.onLog?.("🔎 Cerco in graduatoria...");
      try {
        exploredPages = await searchGraduatoriaPages(
          options.targetUrl,
          options.fetchProxyFn,
          options.onLog,
          options.initialContent,
          options.initialDoc
        );
      } catch (err: any) {
        options.onLog?.(`Avviso ricerca pagine graduatoria: ${err.message}`);
      }
    }

    data.pagine_graduatoria_esplorate = exploredPages.map(p => p.url);

    // TASK 5-quater — Funzione di verifica early exit:
    // valuta per ogni NOMINA (nominativo + sua classe/profilo, con isNameMatch + isClassMatch, entry con classe non vuota),
    // non per solo nome. Esci solo se ogni nomina ha ≥1 entry compatibile con punteggio numerico e fascia (o fascia del contratto già valida).
    const checkAllNamesSatisfied = (): boolean => {
      if (nomineToCheck.length === 0) return false;
      return nomineToCheck.every(nomina => isNominaSatisfiedInEntries(nomina, collectedEntries, data));
    };

    if (exploredPages.length > 0 && options.fetchAiFn) {
      pageLoop: for (const page of exploredPages) {
        // Analisi testo HTML / markdown della pagina
        const pageContent = (page.content || "").trim();
        if (pageContent.length > 50) {
          options.onLog?.(`Estrazione dati graduatoria da: "${page.title}" (${page.url})`);
          try {
            const extractionResult = await extractGraduatoriaWithRetry(
              pageContent,
              targetNamesToSearch,
              options.apiKey || "",
              options.fetchAiFn,
              options.onLog
            );
            const entries = extractionResult?.graduatoria_entries || [];
            for (const entry of entries) {
              if (!entry || !entry.nominativo) continue;
              collectedEntries.push({
                nominativo: entry.nominativo,
                punteggio: entry.punteggio !== undefined ? entry.punteggio : null,
                posizione: entry.posizione !== undefined ? entry.posizione : null,
                fascia: entry.fascia || extractionResult?.meta?.fascia || null,
                classe: entry.classe_concorso || extractionResult?.meta?.profilo_o_cdc || "",
                anno: extractionResult?.meta?.anno_scolastico || null,
                tipologia: extractionResult?.meta?.tipologia_personale || null,
                url: page.url,
              });
            }

            if (checkAllNamesSatisfied()) {
              options.onLog?.("Tutti i nominativi cercati hanno riscontro completo con punteggio e fascia. Interruzione anticipata ricerca graduatorie.");
              break pageLoop;
            }
          } catch (pageErr: any) {
            options.onLog?.(`Avviso estrazione pagina graduatoria ${page.url}: ${pageErr.message}`);
          }
        }

        // Analisi PDF allegati
        if (Array.isArray(page.pdfLinks) && page.pdfLinks.length > 0 && options.fetchProxyFn) {
          const pdfsToScan = page.pdfLinks.slice(0, 3);
          for (const pdfUrl of pdfsToScan) {
            options.onLog?.(`Estrazione da PDF graduatoria allegato: ${pdfUrl}`);
            try {
              let pdfText = "";
              try {
                const fetchRes = await options.fetchProxyFn(pdfUrl, true, options.onLog);
                if (fetchRes?.data && options.pdfTextExtractor) {
                  const { text } = await options.pdfTextExtractor(fetchRes.data as ArrayBuffer, 300);
                  pdfText = text || "";
                }
              } catch (pdfFetchErr: any) {
                options.onLog?.(`Download diretto PDF fallito (${pdfFetchErr.message}), provo fallback AI...`);
              }

              let pdfRes: GraduatoriaExtractionResult | null = null;
              if (pdfText && pdfText.trim().length > 30) {
                pdfRes = await extractGraduatoriaWithRetry(
                  pdfText,
                  targetNamesToSearch,
                  options.apiKey || "",
                  options.fetchAiFn,
                  options.onLog
                );
              } else if (options.pdfAiFallbackFn) {
                const fallbackResult = await options.pdfAiFallbackFn(
                  pdfUrl,
                  GRADUATORIA_EXTRACTION_SYSTEM_PROMPT,
                  targetNamesToSearch
                );
                try {
                  pdfRes = JSON.parse(fallbackResult?.choices?.[0]?.message?.content || "null");
                } catch {}
              }

              const entries = pdfRes?.graduatoria_entries || [];
              for (const entry of entries) {
                if (!entry || !entry.nominativo) continue;
                collectedEntries.push({
                  nominativo: entry.nominativo,
                  punteggio: entry.punteggio !== undefined ? entry.punteggio : null,
                  posizione: entry.posizione !== undefined ? entry.posizione : null,
                  fascia: entry.fascia || pdfRes?.meta?.fascia || null,
                  classe: entry.classe_concorso || pdfRes?.meta?.profilo_o_cdc || "",
                  anno: pdfRes?.meta?.anno_scolastico || null,
                  tipologia: pdfRes?.meta?.tipologia_personale || null,
                  url: pdfUrl,
                });
              }

              if (checkAllNamesSatisfied()) {
                options.onLog?.("Tutti i nominativi cercati hanno riscontro completo con punteggio e fascia. Interruzione anticipata ricerca graduatorie.");
                break pageLoop;
              }
            } catch (pdfErr: any) {
              options.onLog?.(`Avviso estrazione PDF ${pdfUrl}: ${pdfErr.message}`);
            }
          }
        }
      }
    }
  }

  // 3, 4, 5, 6) Risoluzione per ogni nomina
  if (Array.isArray(data.nomine_contratti)) {
    data.nomine_contratti = data.nomine_contratti.map(nomina => {
      if (!nomina.nominativo || !nomina.nominativo.trim()) {
        return nomina;
      }
      return resolveSingleTarget(nomina, collectedEntries, options.onLog, false);
    });
  }

  // Risoluzione per top-level
  if (data.nominativo && data.nominativo.trim()) {
    // Se c'è una nomina in nomine_contratti che corrisponde a data.nominativo
    const matchingNomina = Array.isArray(data.nomine_contratti)
      ? data.nomine_contratti.find(n => isNameMatch(n.nominativo, data.nominativo))
      : undefined;

    if (matchingNomina) {
      if (isPunteggioMissing(data.punteggio)) {
        data.punteggio = matchingNomina.punteggio;
        data.origine_punteggio = matchingNomina.origine_punteggio || "Incrociato";
      }
      if (isPosizioneMissing(data.posizione_graduatoria)) {
        data.posizione_graduatoria = matchingNomina.posizione_graduatoria;
      }
      if (isFasciaMissing(data.graduatoria_fascia)) {
        data.graduatoria_fascia = matchingNomina.fascia;
      }
      if (matchingNomina.note_cross_reference) {
        data.note_cross_reference = matchingNomina.note_cross_reference;
      }
    } else {
      const topResolved = resolveSingleTarget(data, collectedEntries, options.onLog, true);
      data.punteggio = topResolved.punteggio;
      data.origine_punteggio = topResolved.origine_punteggio;
      data.posizione_graduatoria = topResolved.posizione_graduatoria;
      data.graduatoria_fascia = topResolved.graduatoria_fascia;
      data.note_cross_reference = topResolved.note_cross_reference;
    }
  } else if (!data.nominativo && Array.isArray(data.nomine_contratti) && data.nomine_contratti.length === 1) {
    const single = data.nomine_contratti[0];
    if (isPunteggioMissing(data.punteggio)) {
      data.punteggio = single.punteggio;
      data.origine_punteggio = single.origine_punteggio;
    }
    if (isPosizioneMissing(data.posizione_graduatoria)) {
      data.posizione_graduatoria = single.posizione_graduatoria;
    }
    if (isFasciaMissing(data.graduatoria_fascia)) {
      data.graduatoria_fascia = single.fascia;
    }
  }

  return data;
}

/**
 * Suite di test rapidi per graduatorieService (normalizeFascia, isClassMatch, lookupPunteggioGraduatoria):
 * Eseguibile tramite: `npm run test:graduatorie` (oppure `npx tsx scripts/test-graduatorie.ts`)
 */

/**
 * Filtra un documento o testo scolastico in base ai criteri rigorosi richiesti:
 * - Almeno 1 parola chiave positiva
 * - Almeno 1 frase esatta obbligatoria
 * - Nessuna parola chiave o frase negativa (esclusione)
 */
export function filterSchoolDocument(textOrTitle: string): {
  included: boolean;
  reason: string;
  matchedPositive?: string;
  matchedExact?: string;
} {
  const norm = (textOrTitle || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

  // 1. Negative terms (escludere se presente)
  const negativeTerms = [
    "assegnazione ai plessi",
    "assenze",
    "direttiva ds",
    "informativa sindacale",
    "diritto allo studio",
    "permessi",
    "graduatoria provvisoria",
    "sciopero",
    "assemblea",
    "part-time",
    "circolare interna",
    "assemblea sindacale",
    "assegno di ricerca",
    "borsa di studio",
    "pon",
    "pnrr"
  ];

  for (const neg of negativeTerms) {
    if (norm.includes(neg)) {
      return {
        included: false,
        reason: `Escluso: contiene termine negativo "${neg}"`
      };
    }
  }

  // 2. Positive keywords (almeno 1)
  const positiveKeywords = [
    "convocazione",
    "nomina",
    "supplenza",
    "interpello",
    "graduatoria",
    "pensionamento",
    "collocamento",
    "cessazione",
    "ata",
    "decreto di individuazione",
    "conferimento incarico",
    "scorrimento graduatoria",
    "assegnazione sede",
    "classe di concorso",
    "provvedimento di individuazione",
    "atto di nomina",
    "avviso di selezione",
    "avviso di reclutamento",
    "procedura di reclutamento",
    "supplenza breve e saltuaria",
    "proroga",
    "individuazione destinatario",
    "immissione in ruolo",
    "graduatoria di istituto"
  ];

  let matchedPositive: string | undefined = undefined;
  for (const pos of positiveKeywords) {
    if (norm.includes(pos)) {
      matchedPositive = pos;
      break;
    }
  }

  if (!matchedPositive) {
    return {
      included: false,
      reason: "Non contiene alcuna parola chiave positiva richiesta."
    };
  }

  // 3. Mandatory exact phrases (almeno 1)
  const mandatoryExactPhrases = [
    "contratto di supplenza",
    "contratto a tempo determinato",
    "provvedimento di individuazione del destinatario di contratto di lavoro a tempo determinato",
    "individuazione destinatario di proposta di contratto",
    "decreto di individuazione tramite interpello",
    "conferimento di supplenza",
    "avviso per l'individuazione e il reclutamento di personale docente"
  ];

  let matchedExact: string | undefined = undefined;
  for (const exact of mandatoryExactPhrases) {
    if (norm.includes(exact)) {
      matchedExact = exact;
      break;
    }
  }

  if (!matchedExact) {
    return {
      included: false,
      reason: "Non contiene alcuna frase esatta obbligatoria richiesta."
    };
  }

  return {
    included: true,
    reason: `Positiva: "${matchedPositive}" + Frase esatta: "${matchedExact}"`,
    matchedPositive,
    matchedExact
  };
}



