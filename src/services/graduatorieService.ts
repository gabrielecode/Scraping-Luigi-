import { GraduatoriaIstituto, GraduatoriaIstitutoEntry, NominaContrattoItem, AlboPretorioContract, OriginePunteggio } from "../types";

const STORAGE_KEY = "scuola_graduatorie_istituto";

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
  if (!val) return "";
  const s = val.trim().toUpperCase();

  // Docenti sostegno
  if (s.includes("ADMM")) return "ADMM";
  if (s.includes("ADSS")) return "ADSS";
  if (s.includes("ADAA")) return "ADAA";
  if (s.includes("ADEE")) return "ADEE";

  // Infanzia / Primaria
  if (s.includes("AAAA") || s.includes("INFANZIA")) return "AAAA";
  if (s.includes("EEEE") || s.includes("PRIMARIA")) return "EEEE";

  // CDC tipo A-12 o A12 o B-02
  const cdcMatch = s.match(/\b([AB])-?(\d{2})\b/);
  if (cdcMatch) {
    return `${cdcMatch[1]}-${cdcMatch[2]}`;
  }

  // ATA
  if (s.includes("COLLABORATORE") || s === "CS") return "CS";
  if (s.includes("AMMINISTRATIVO") || s === "AA") return "AA";
  if (s.includes("TECNICO") || s === "AT") {
    // Se c'è anche l'area es. AR02
    const arMatch = s.match(/\b(AR\d{2})\b/);
    if (arMatch) return `AT_${arMatch[1]}`;
    return "AT";
  }
  if (s.includes("CUOCO") || s === "CU") return "CU";
  if (s.includes("AGRARIO") || s === "CR") return "CR";
  if (s.includes("GUARDAROBIERE") || s === "GU") return "GU";
  if (s.includes("OPERATORE") || s === "OS") return "OS";

  return s;
}

/**
 * Normalizza la fascia: "1", "2", "3" o "Prima", "Seconda", "Terza"
 */
export function normalizeFascia(val: string): string {
  if (!val) return "";
  const s = val.toLowerCase();
  if (s.includes("1") || s.includes("prima") || s.includes("i fascia")) return "1";
  if (s.includes("2") || s.includes("seconda") || s.includes("ii fascia")) return "2";
  if (s.includes("3") || s.includes("terza") || s.includes("iii fascia")) return "3";
  if (s.includes("istituto")) return "GI";
  if (s.includes("interpello")) return "INT";
  return s.trim();
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
 * Carica le graduatorie salvate in LocalStorage
 */
export function getStoredGraduatorie(): GraduatoriaIstituto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultDemoGraduatorie();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultDemoGraduatorie();
  } catch (e) {
    console.error("Errore lettura graduatorie da LocalStorage:", e);
    return getDefaultDemoGraduatorie();
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
 * Cerca un candidato per posizione in una graduatoria specifica
 */
export function lookupPunteggioGraduatoria(
  graduatorie: GraduatoriaIstituto[],
  criteri: {
    codice_meccanografico?: string;
    nome_istituto?: string;
    tipologia_personale?: "ATA" | "DOCENTE";
    profilo_o_cdc?: string;
    fascia?: string;
    posizione: number;
  }
): { punteggio: number; entry?: GraduatoriaIstitutoEntry; graduatoriaMatched?: GraduatoriaIstituto } | null {
  const normCodice = normalizeCodiceMeccanografico(criteri.codice_meccanografico);
  const normProfilo = normalizeProfiloOrCdc(criteri.profilo_o_cdc || "");
  const normFascia = normalizeFascia(criteri.fascia || "");

  // Filtriamo le graduatorie candidate
  const candidateGrad = graduatorie.filter(g => {
    // Se c'è codice meccanografico e coincide, priorità
    if (normCodice && g.codice_meccanografico) {
      if (normalizeCodiceMeccanografico(g.codice_meccanografico) !== normCodice) {
        return false;
      }
    }

    // Tipologia personale
    if (criteri.tipologia_personale && g.tipologia_personale !== criteri.tipologia_personale) {
      return false;
    }

    // Profilo o CDC
    const gProfilo = normalizeProfiloOrCdc(g.profilo_o_cdc);
    if (normProfilo && gProfilo && !gProfilo.includes(normProfilo) && !normProfilo.includes(gProfilo)) {
      return false;
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

  for (const g of candidateGrad) {
    const entry = g.graduatoria.find(e => e.posizione === criteri.posizione);
    if (entry && typeof entry.punteggio === "number" && !isNaN(entry.punteggio)) {
      return {
        punteggio: Number(entry.punteggio.toFixed(2)),
        entry,
        graduatoriaMatched: g,
      };
    }
  }

  // Fallback se non abbiamo filtrato per codice (cerca se c'è corrispondenza generica sul profilo e fascia)
  if (!normCodice) {
    for (const g of candidateGrad) {
      const entry = g.graduatoria.find(e => e.posizione === criteri.posizione);
      if (entry && typeof entry.punteggio === "number" && !isNaN(entry.punteggio)) {
        return {
          punteggio: Number(entry.punteggio.toFixed(2)),
          entry,
          graduatoriaMatched: g,
        };
      }
    }
  }

  return null;
}

/**
 * Incrocia automaticamente una singola nomina/contratto con le graduatorie disponibili.
 * Se la nomina ha già un punteggio esplicito (diverso da null), lo preserva con origine "Esplicito".
 * Se la nomina ha punteggio null ma ha una posizione in graduatoria valida, tenta il lookup.
 */
export function crossReferenceNomina<T extends NominaContrattoItem | AlboPretorioContract>(
  item: T,
  graduatorie: GraduatoriaIstituto[],
  scuolaContext?: { codice_meccanografico?: string; nome_istituto?: string }
): T & { punteggio: number | null; origine_punteggio: OriginePunteggio; note_cross_reference?: string } {
  // Se ha già un punteggio esplicito valido
  if (item.punteggio !== null && item.punteggio !== undefined && !isNaN(Number(item.punteggio))) {
    return {
      ...item,
      punteggio: Number(Number(item.punteggio).toFixed(2)),
      origine_punteggio: "Esplicito",
      note_cross_reference: "Punteggio estratto direttamente dal testo del documento/contratto.",
    };
  }

  // Se manca il punteggio, verifichiamo se possiamo risalire tramite posizione
  const posNum = parsePosizioneNumber(item.posizione_graduatoria);
  if (!posNum) {
    return {
      ...item,
      punteggio: null,
      origine_punteggio: "Non disponibile",
      note_cross_reference: "Punteggio non presente nel documento e posizione non specificata.",
    };
  }

  const codMec = (item as any).codice_meccanografico || scuolaContext?.codice_meccanografico;
  const nomeScuola = (item as any).nome_istituto || scuolaContext?.nome_istituto;
  const tipologia = (item as any).tipologia_personale || "ATA";
  const profilo = (item as any).profilo_lavorativo || (item as any).profilo_professionale || (item as any).classe_concorso_area_lab || (item as any).classe_di_concorso || "";
  const fascia = (item as any).fascia || (item as any).graduatoria_fascia || "";

  const match = lookupPunteggioGraduatoria(graduatorie, {
    codice_meccanografico: codMec,
    nome_istituto: nomeScuola,
    tipologia_personale: tipologia,
    profilo_o_cdc: profilo,
    fascia,
    posizione: posNum,
  });

  if (match) {
    const nomeGrad = match.graduatoriaMatched?.nome_istituto || match.graduatoriaMatched?.codice_meccanografico || "Graduatoria d'Istituto";
    return {
      ...item,
      codice_meccanografico: (item as any).codice_meccanografico || match.graduatoriaMatched?.codice_meccanografico || "",
      punteggio: match.punteggio,
      origine_punteggio: "Incrociato",
      note_cross_reference: `Punteggio incrociato con ${nomeGrad} (${match.graduatoriaMatched?.profilo_o_cdc}, Fascia ${match.graduatoriaMatched?.fascia}): pos. ${posNum} = ${match.punteggio.toFixed(2)} pt${match.entry?.cognome_nome ? ` [${match.entry.cognome_nome}]` : ""}`,
    } as any;
  }

  return {
    ...item,
    punteggio: null,
    origine_punteggio: "Non disponibile",
    note_cross_reference: `Posizione ${posNum} presente, ma nessuna graduatoria caricata corrisponde a [${profilo} - Fascia ${fascia || "N/D"}].`,
  };
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
    nome_istituto: metadata.nome_istituto?.trim(),
    tipologia_personale: metadata.tipologia_personale,
    profilo_o_cdc: normalizeProfiloOrCdc(metadata.profilo_o_cdc),
    fascia: normalizeFascia(metadata.fascia),
    anno_scolastico: metadata.anno_scolastico || "2024/2025 - 2026/2027",
    graduatoria: entries,
  };
}

/**
 * Graduatorie demo pre-caricate per consentire test immediati senza dover caricare a mano
 */
function getDefaultDemoGraduatorie(): GraduatoriaIstituto[] {
  return [
    {
      id: "demo_cs_fascia3",
      nome_istituto: "Istituto Comprensivo Statale",
      codice_meccanografico: "CHIC81000A",
      tipologia_personale: "ATA",
      profilo_o_cdc: "CS",
      fascia: "3",
      anno_scolastico: "2024/2027",
      graduatoria: [
        { posizione: 1, punteggio: 19.80, cognome_nome: "ROSSI M." },
        { posizione: 2, punteggio: 18.55, cognome_nome: "BIANCHI G." },
        { posizione: 15, punteggio: 15.20, cognome_nome: "VERDI A." },
        { posizione: 42, punteggio: 13.90, cognome_nome: "FERRARI E." },
        { posizione: 87, punteggio: 12.50, cognome_nome: "ESPOSITO C." },
        { posizione: 120, punteggio: 11.35, cognome_nome: "ROMANO F." },
        { posizione: 313, punteggio: 13.17, cognome_nome: "CANDIDATO 313" },
        { posizione: 342, punteggio: 12.57, cognome_nome: "CANDIDATO 342" },
      ]
    },
    {
      id: "demo_aa_fascia3",
      nome_istituto: "Istituto Comprensivo Statale",
      codice_meccanografico: "CHIC81000A",
      tipologia_personale: "ATA",
      profilo_o_cdc: "AA",
      fascia: "3",
      anno_scolastico: "2024/2027",
      graduatoria: [
        { posizione: 1, punteggio: 35.50, cognome_nome: "MARINO S." },
        { posizione: 5, punteggio: 28.30, cognome_nome: "GRECO D." },
        { posizione: 12, punteggio: 22.10, cognome_nome: "BRUNO P." },
        { posizione: 25, punteggio: 17.80, cognome_nome: "GALLO L." },
      ]
    },
    {
      id: "demo_docenti_a22",
      nome_istituto: "IIS Schiaparelli - Gramsci",
      codice_meccanografico: "MIIS00100B",
      tipologia_personale: "DOCENTE",
      profilo_o_cdc: "A-22",
      fascia: "2",
      anno_scolastico: "2024/2026",
      graduatoria: [
        { posizione: 1, punteggio: 112.50, cognome_nome: "CONTI R." },
        { posizione: 5, punteggio: 88.00, cognome_nome: "DE LUCA F." },
        { posizione: 14, punteggio: 69.50, cognome_nome: "COSTA M." },
        { posizione: 28, punteggio: 54.00, cognome_nome: "GIORDANO A." },
      ]
    },
    {
      id: "demo_docenti_admm",
      nome_istituto: "IC Ripa Teatina",
      codice_meccanografico: "CHIC81000A",
      tipologia_personale: "DOCENTE",
      profilo_o_cdc: "ADMM",
      fascia: "1",
      anno_scolastico: "2024/2026",
      graduatoria: [
        { posizione: 1, punteggio: 140.00, cognome_nome: "RIZZO E." },
        { posizione: 3, punteggio: 118.50, cognome_nome: "LOMBARDI S." },
        { posizione: 8, punteggio: 95.00, cognome_nome: "BARBIERI T." },
      ]
    }
  ];
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
  const combined = `${text || ""} ${href || ""}`.toLowerCase();

  // 1. graduatoria / graduatorie (priorità massima)
  if (/\bgraduatorie?\b/i.test(combined) || combined.includes("graduatoria") || combined.includes("graduatorie")) {
    return { matches: true, keyword: "graduatoria/e", priority: 10 };
  }

  // 2. albo pretorio / albo online / pubblicità legale
  if (
    combined.includes("albo pretorio") ||
    combined.includes("albo-pretorio") ||
    combined.includes("albopretorio") ||
    combined.includes("albo online") ||
    combined.includes("albo-online") ||
    combined.includes("/albo/") ||
    combined.includes("albipretorionline") ||
    combined.includes("pubblicita legale") ||
    combined.includes("pubblicità legale")
  ) {
    return { matches: true, keyword: "albo pretorio", priority: 6 };
  }

  // 3. amministrazione trasparente / trasparenza
  if (
    combined.includes("amministrazione trasparente") ||
    combined.includes("amministrazione-trasparente") ||
    combined.includes("amministrazionetrasparente") ||
    combined.includes("/amministrazione_trasparente") ||
    combined.includes("/trasparenza") ||
    combined.includes("trasparenza-pa")
  ) {
    return { matches: true, keyword: "amministrazione trasparente", priority: 5 };
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
 * Trova i link candidati relativi a graduatoria, amministrazione trasparente o albo pretorio
 * filtrando RIGOROSAMENTE sullo stesso dominio di base.
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

      // Stesso dominio: verifica se il dominio corrisponde
      const linkDomain = normalizeDomainForComparison(resolved);
      if (linkDomain !== baseDomain) {
        return; // Salta link esterni fuori dal dominio scolastico
      }

      const match = isGraduatoriaLink(title, resolved);
      if (match.matches) {
        seen.add(resolved);
        candidates.push({
          url: resolved,
          title: (title || resolved).trim(),
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
        title: current.title,
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

export const GRADUATORIA_EXTRACTION_SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrazione precisa di dati da graduatorie d'istituto scolastiche italiane (Docenti e Personale ATA) pubblicate su pagine web, albi pretori o file PDF.

Il tuo compito è individuare e estrarre tutti i candidati/nominativi presenti nella graduatoria o elenco con il relativo punteggio e la classe di concorso o profilo professionale.

SCHEMA JSON OBBLIGATORIO:
{
  "graduatoria_entries": [
    {
      "nominativo": "COGNOME NOME o NOME COGNOME del candidato",
      "punteggio": 54.5,
      "classe_concorso": "Codice classe di concorso (es. A-22, A-12, A-28, ADMM, ADSS) oppure profilo ATA (es. Collaboratore Scolastico, Assistente Amministrativo, Assistente Tecnico)"
    }
  ]
}

REGOLE CRITICHE:
1. "nominativo": Riporta il nome completo del candidato esattamente come scritto nel documento (es. "ROSSI MARIO", "MARIO ROSSI").
2. "punteggio": Deve essere un valore numerico (es. 54.5, 88.0, 112.5). Se il punteggio non è esplicitato o non è presente, imposta RIGOROSAMENTE null. MAI restituire 0 se il punteggio è assente.
3. "classe_concorso": Riporta la classe di concorso per docenti (es. "A-22", "A-12", "A-28", "ADMM") o il profilo ATA (es. "AA", "CS", "AT", "Collaboratore Scolastico", "Assistente Amministrativo").
4. Rispondi RIGOROSAMENTE ed ESCLUSIVAMENTE con l'oggetto JSON richiesto, senza markdown o commenti esterni.`;

export interface GraduatoriaExtractedEntry {
  nominativo: string;
  punteggio: number | null;
  classe_concorso?: string;
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
 * Normalizza classe di concorso o profilo professionale per il matching
 */
export function normalizeCdcOrProfile(val?: string): string {
  if (!val) return "";
  const s = val.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Mappatura ATA
  if (s.includes("collaboratore") || s === "cs" || s.includes("scolastico")) return "cs";
  if (s.includes("amministrativo") || s === "aa") return "aa";
  if (s.includes("tecnico") || s === "at") return "at";
  if (s.includes("cuoco") || s === "cu") return "cu";
  if (s.includes("agrario") || s === "cr") return "cr";
  if (s.includes("guardarob") || s === "gu") return "gu";
  if (s.includes("inferm") || s === "if") return "if";

  // Docenti: rimozione zeri iniziali e standardizzazione (es. a022 -> a22)
  return s.replace(/^a0+([1-9])/i, "a$1");
}

/**
 * Confronta due classi di concorso o profili professionali
 */
export function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return false;
  const normA = normalizeCdcOrProfile(classA);
  const normB = normalizeCdcOrProfile(classB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  return false;
}


