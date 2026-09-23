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
      punteggio: match.punteggio,
      origine_punteggio: "Incrociato",
      note_cross_reference: `Punteggio incrociato con ${nomeGrad} (${match.graduatoriaMatched?.profilo_o_cdc}, Fascia ${match.graduatoriaMatched?.fascia}): pos. ${posNum} = ${match.punteggio.toFixed(2)} pt${match.entry?.cognome_nome ? ` [${match.entry.cognome_nome}]` : ""}`,
    };
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
