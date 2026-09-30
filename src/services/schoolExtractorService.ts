import { ExtractionData, GraduatoriaIstituto, OriginePunteggio, NominaContrattoItem, TipologiaPersonale, TipoPosto } from "../types";
import { 
  extractCodiceMeccanograficoFromText, 
  crossReferenceNomina, 
  resolveFromGraduatorie,
  extractWithOpenRouter,
  isNameMatch,
  formatFasciaLabel
} from "./graduatorieService";
import { extractTextFromPdfBuffer, extractPdfsFromHtml } from "./pdfService";

/**
 * Normalizza il nome della scuola estraendo l'Istituto Principale / Comprensivo
 * quando il record si riferisce a un singolo plesso (es. "ALTINO - IC CASOLI" -> "IC CASOLI")
 */
export function extractMainInstituteName(rawName?: string): string {
  if (!rawName) return "";
  let clean = rawName.replace(/["']/g, "").replace(/\s+/g, " ").trim();

  // Pattern "PLESSO - ISTITUTO COMPRENSIVO"
  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    const lastPart = parts[parts.length - 1].trim();
    if (/(?:ic|i\.c\.|istituto|iis|i\.i\.s\.|liceo|direzione|omnicomprensivo|io\b|ipseoa|itcg|itis)/i.test(lastPart)) {
      clean = lastPart;
    } else if (/(?:ic|i\.c\.|istituto|iis|i\.i\.s\.|liceo|direzione|omnicomprensivo|io\b|ipseoa|itcg|itis)/i.test(parts[0])) {
      clean = parts[0].trim();
    }
  }

  // Pulisci prefissi comuni
  clean = clean.replace(/^(?:SC\.?\s*INFANZIA|SCUOLA\s*PRIMARIA|INFANZIA|PRIMARIA|SECONDARIA)\s+/i, "");
  return clean.trim();
}

/**
 * Deduce l'ordine e il profilo tipico della scuola a partire dalla sua denominazione.
 */
export function deduceSchoolOrderAndProfile(schoolName: string): {
  tipologiaDocente: string;
  defaultCdc: string;
  defaultOreDocente: string;
} {
  const lower = (schoolName || "").toLowerCase();

  if (lower.includes("liceo")) {
    return {
      tipologiaDocente: "Docente Scuola Secondaria II Grado (Liceo)",
      defaultCdc: "A-12 / A-26 / Materie Curricolari",
      defaultOreDocente: "18 ore settimanali (Cattedra ordinaria)"
    };
  }
  if (lower.includes("ipseoa") || lower.includes("alberghiero")) {
    return {
      tipologiaDocente: "Docente Scuola Secondaria II Grado (Alberghiero)",
      defaultCdc: "B-20 / B-21 / Materie Professionali",
      defaultOreDocente: "18 ore settimanali (Cattedra ordinaria)"
    };
  }
  if (lower.includes("tecnico") || lower.includes("itcg") || lower.includes("itis") || lower.includes("commerciale")) {
    return {
      tipologiaDocente: "Docente Scuola Secondaria II Grado (Istituto Tecnico)",
      defaultCdc: "A-45 / A-46 / A-41 / Discipline Tecniche",
      defaultOreDocente: "18 ore settimanali (Cattedra ordinaria)"
    };
  }
  if (lower.includes("cpia") || lower.includes("c.t.p.") || lower.includes("ctp")) {
    return {
      tipologiaDocente: "Docente Istruzione Adulti (CPIA)",
      defaultCdc: "A-22 / A-28 / Italiano L2",
      defaultOreDocente: "18 ore settimanali"
    };
  }
  if (lower.includes("circolo") || lower.includes("direzione didattica")) {
    return {
      tipologiaDocente: "Docente Scuola Primaria / Infanzia",
      defaultCdc: "EEEE / AAAA",
      defaultOreDocente: "24 ore settimanali"
    };
  }

  // Default: Istituto Comprensivo (Primaria e Secondaria di I Grado)
  return {
    tipologiaDocente: "Docente Scuola Primaria e Secondaria I Grado",
    defaultCdc: "EEEE / A-22 / ADMM (Sostegno)",
    defaultOreDocente: "18 ore (Secondaria) / 24 ore (Primaria)"
  };
}

/**
 * Estrae un punteggio numerico reale con altissima precisione da una riga o blocco di testo.
 * Riconosce:
 * - "punti 14.50", "punteggio: 38.20", "pt. 45", "votazione: 60"
 * - "14.50 punti", "38,20 pt", "45,50 p.ti"
 * - "con punti 15"
 * - Valori decimali tipici in tabelle ministeriali escludendo date e ore
 */
export function extractScoreRobust(line: string): number | null {
  if (!line) return null;

  // 1. Prefisso: punti 14.50, pt. 45, totale: 38.2
  const m1 = line.match(/(?:punteggio|punti|pt\.?|p\.ti|votazione|valutazione|totale\s*punti|totale)[:=\s]+([0-9]{1,3}(?:[.,][0-9]{1,2})?)/i);
  if (m1) {
    const v = parseFloat(m1[1].replace(',', '.'));
    if (!isNaN(v) && v > 0 && v <= 300) return Number(v.toFixed(2));
  }

  // 2. Suffisso: 14.50 punti, 38.20 pt, 45,50 p.ti
  const m2 = line.match(/([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*(?:punti|p\.ti|pt\.?)\b/i);
  if (m2) {
    const v = parseFloat(m2[1].replace(',', '.'));
    if (!isNaN(v) && v > 0 && v <= 300) return Number(v.toFixed(2));
  }

  // 3. 'con punti 15' o 'avente 18 punti'
  const m3 = line.match(/(?:con|avente)\s+([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s+punti/i);
  if (m3) {
    const v = parseFloat(m3[1].replace(',', '.'));
    if (!isNaN(v) && v > 0 && v <= 300) return Number(v.toFixed(2));
  }

  // 4. Numero decimale tipico in riga tabellare (esclude date come 12/05/1990 o orari 18/36 ore)
  const cleanLine = line
    .replace(/[0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}/g, ' ')
    .replace(/[0-9]{1,2}\s*(?:ore|h\b|anni|mesi|giorni)/gi, ' ')
    .replace(/(?:a\.s\.|anno)\s*[0-9]{2,4}(?:[\/-][0-9]{2,4})?/gi, ' ')
    .replace(/\b(?:202[0-9]|19[0-9]{2})\b/g, ' ');

  const floats = [...cleanLine.matchAll(/\b([0-9]{1,3}[.,][0-9]{1,2})\b/g)];
  for (const f of floats) {
    const val = parseFloat(f[1].replace(',', '.'));
    if (val >= 4.0 && val <= 300.0) {
      return Number(val.toFixed(2));
    }
  }

  return null;
}

/**
 * Restituisce valori vuoti/non disponibili per punteggio e origine senza formule inventate.
 */
export function deriveCertainScore(posStr: string, tipologia: string, fascia: string): { punteggio: number | null; origine: string } {
  return { punteggio: null, origine: "Non disponibile" };
}

/**
 * Parser specializzato per righe di graduatorie definitive o decreti di individuazione/nomina.
 * Riconosce formati ministeriali tabulari e testuali:
 * - "Pos. 1 - ROSSI MARIO - Punti 48.50 - Prima Fascia (24 Mesi)"
 * - "DECRETA l'individuazione di BIANCHI LUIGI, collocato al posto 2 con punti 38.20"
 */
export function extractGraduatoriaTableEntries(text: string, schoolUrl: string): NominaContrattoItem[] {
  const items: NominaContrattoItem[] = [];
  const lines = text.split(/(?:\r?\n){1,2}|<br\s*\/?>|<\/tr>|<\/li>|##\s+/i);
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (line.length < 15) continue;
    const lower = line.toLowerCase();

    // Rileva riga con posizione e/o punteggio
    const posMatch = line.match(/(?:pos(?:izione)?\.?|posto|n\.)\s*[:=\s#]*([0-9]{1,4})\b/i);
    const puntDetected = extractScoreRobust(line);
    const fasciaMatch = line.match(/(?:prima|seconda|terza|[1-3]\^?|[1-3]°)\s*fascia\b/i);
    const oreMatch = line.match(/([0-9]{1,2}(?:\/[0-9]{1,2})?)\s*(?:ore|h\b|settimanali)/i);

    // Se la riga ha almeno punteggio o posizione unita a profilo/nomina
    if (puntDetected !== null || (posMatch && (fasciaMatch || lower.includes("decreto") || lower.includes("individuato")))) {
      let posStr = posMatch ? `Pos. ${posMatch[1]}` : "Non disponibile";
      let fasciaStr = fasciaMatch ? formatFasciaLabel(fasciaMatch[0]) : "Non disponibile";
      let oreStr = oreMatch ? `${oreMatch[1]} ore settimanali` : "Non disponibile";

      let tipologia: TipologiaPersonale = lower.includes("docent") || lower.includes("prof") || lower.includes("insegnant") || /\b[a-z]{1,2}-[0-9]{2}\b/i.test(lower) ? "DOCENTE" : "ATA";
      let profilo = "Non disponibile";
      let cdc = "Non disponibile";
      let tipoPosto: TipoPosto = lower.includes("sostegno") ? "sostegno" : "comune";

      if (tipologia === "DOCENTE") {
        profilo = "Docente";
        cdc = "Non disponibile";
        const cdcM = line.match(/\b([A-B]-?[0-9]{2}|ADMM|ADSS|ADEE|AAAA|EEEE)\b/i);
        if (cdcM) {
          cdc = cdcM[1].toUpperCase();
          profilo = cdc.startsWith("AD") ? `Docente Sostegno ${cdc}` : `Docente ${cdc}`;
        }
        if (oreMatch) oreStr = `${oreMatch[1]} ore settimanali`;
      } else if (lower.includes("amministrativ") || lower.includes("profilo aa")) {
        profilo = "Assistente Amministrativo";
        cdc = "AA";
      } else if (lower.includes("tecnic") || lower.includes("profilo at")) {
        profilo = "Assistente Tecnico";
        cdc = "AT";
      } else if (lower.includes("collaboratore") || lower.includes("scolastico") || lower.includes("profilo cs")) {
        profilo = "Collaboratore Scolastico";
        cdc = "CS";
      }

      let punteggio: number | null = puntDetected;
      let originePunteggio: string = puntDetected !== null ? (lower.includes("decreto") ? "Decreto di Individuazione" : "Graduatoria Ufficiale") : "Non disponibile";

      // Nominativo
      const nomMatch = line.match(/[-–]\s*([A-Z\s]{4,30})\s*[-–]/) ||
                       line.match(/(?:candidat[oa]|nominat[oa]|individuato|a favore di|al sig\.?|alla sig\.?ra)[:\s]+([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){1,3})/i);
      const nominativo = nomMatch ? nomMatch[1].trim() : "Non disponibile";

      const key = `${tipologia}_${profilo}_${punteggio}_${posStr}_${nominativo}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          nome_istituto: "",
          codice_meccanografico: "",
          nominativo,
          tipologia_personale: tipologia,
          profilo_lavorativo: profilo,
          classe_concorso_area_lab: cdc,
          tipo_posto: tipoPosto,
          punteggio,
          origine_punteggio: originePunteggio,
          posizione_graduatoria: posStr,
          fascia: fasciaStr,
          ore_settimanali: oreStr,
          decorrenza_contratto: "Non disponibile",
          durata_contratto_mesi: "Non disponibile",
          durata_contratto_giorni: "",
          link_del_documento: schoolUrl
        });
      }
    }
  }

  return items;
}

/**
 * Analizzatore euristico ad alta precisione per estrarre convocazioni, pensionamenti e contratti
 * direttamente dal testo della pagina o dai risultati di ricerca atti.
 */
export function analyzeSchoolContentHeuristic(
  text: string,
  url: string,
  targetNominativo?: string,
  schoolNameHint?: string
): {
  convocazioni: {
    collaboratore_scolastico: number;
    assistente_amministrativo: number;
    docenti: number;
    assistente_tecnico: number;
    cuoco: number;
    assistente_agrario: number;
  };
  pensionamenti: {
    collaboratore_scolastico: number;
    assistente_amministrativo: number;
    docenti: number;
    assistente_tecnico: number;
    cuoco: number;
    assistente_agrario: number;
  };
  nomine: NominaContrattoItem[];
} {
  const conv = {
    collaboratore_scolastico: 0,
    assistente_amministrativo: 0,
    docenti: 0,
    assistente_tecnico: 0,
    cuoco: 0,
    assistente_agrario: 0
  };

  const pens = {
    collaboratore_scolastico: 0,
    assistente_amministrativo: 0,
    docenti: 0,
    assistente_tecnico: 0,
    cuoco: 0,
    assistente_agrario: 0
  };

  const nomine: NominaContrattoItem[] = [];

  // 1. Estrazione tabellare di graduatorie e decreti
  const tableEntries = extractGraduatoriaTableEntries(text, url);
  for (const entry of tableEntries) {
    nomine.push(entry);
    if (entry.tipologia_personale === "DOCENTE") conv.docenti++;
    else if (entry.profilo_lavorativo.includes("Collaboratore")) conv.collaboratore_scolastico++;
    else if (entry.profilo_lavorativo.includes("Amministrativo")) conv.assistente_amministrativo++;
    else if (entry.profilo_lavorativo.includes("Tecnico")) conv.assistente_tecnico++;
  }

  // 2. Spezza il testo in blocchi per analisi semantica e conteggi
  const blocks = text.split(/(?:\r?\n){1,2}|<br\s*\/?>|<\/p>|<\/li>|<\/tr>|##\s+/i)
    .map(b => b.replace(/<[^>]+>/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim())
    .filter(b => b.length > 15);

  const seenNomineKeys = new Set<string>(tableEntries.map(e => `${e.tipologia_personale}_${e.profilo_lavorativo}_${e.classe_concorso_area_lab}_${e.nominativo}`));

  for (const block of blocks) {
    const lower = block.toLowerCase();

    // Scarta categoricamente se contiene termini negativi tipici
    if (
      lower.includes("assemblea sindacale") ||
      lower.includes("sciopero") ||
      lower.includes("assegnazione ai plessi") ||
      lower.includes("orario ricevimento") ||
      lower.includes("permessi retribuiti") ||
      lower.includes("assenze docente") ||
      lower.includes("visita guidata") ||
      lower.includes("viaggio d'istruzione")
    ) {
      continue;
    }

    // Rileva Pensionamenti / Cessazioni
    const isPensionamento = (
      lower.includes("pensionament") ||
      lower.includes("cessazion") ||
      lower.includes("collocamento a riposo") ||
      lower.includes("quiescenza") ||
      lower.includes("dimissioni dal servizio")
    );

    if (isPensionamento) {
      if (lower.includes("collaborator") || lower.includes("personale ata") || lower.includes(" ata ")) {
        pens.collaboratore_scolastico++;
      }
      if (lower.includes("amministrativ")) {
        pens.assistente_amministrativo++;
      }
      if (lower.includes("docent") || lower.includes("insegnant") || lower.includes("primaria") || lower.includes("secondaria")) {
        pens.docenti++;
      }
      if (lower.includes("tecnic")) {
        pens.assistente_tecnico++;
      }
      if (lower.includes("cuoc")) {
        pens.cuoco++;
      }
      if (lower.includes("agrari")) {
        pens.assistente_agrario++;
      }
    }

    // Rileva Convocazioni / Interpelli / Supplenze / Contratti
    const isConvocazioneOrInterpello = (
      lower.includes("convocazion") ||
      lower.includes("interpell") ||
      lower.includes("supplenz") ||
      lower.includes("reclutamento") ||
      lower.includes("individuazion") ||
      lower.includes("stipula contratt") ||
      lower.includes("conferimento incarico") ||
      lower.includes("avviso di selezione") ||
      lower.includes("bando ata") ||
      lower.includes("bando docent") ||
      lower.includes("messa a disposizione") ||
      lower.includes("graduatorie di istituto") ||
      lower.includes("graduatorie d'istituto") ||
      lower.includes("graduatorie definitive") ||
      (targetNominativo && isNameMatch(block, targetNominativo))
    );

    if (isConvocazioneOrInterpello) {
      const isDocente = (
        lower.includes("docent") ||
        lower.includes("insegnant") ||
        lower.includes("classe di concorso") ||
        lower.includes("scuola primaria") ||
        lower.includes("scuola secondaria") ||
        lower.includes("scuola dell'infanzia") ||
        /\b[a-z]{1,2}-[0-9]{2}\b/i.test(lower) ||
        lower.includes("sostegno")
      );

      const isCS = lower.includes("collaboratore scolastic") || lower.includes("profilo cs") || (lower.includes(" ata") && !lower.includes("amministrativ") && !isDocente);
      const isAA = lower.includes("assistente amministrativ") || lower.includes("profilo aa");
      const isAT = lower.includes("assistente tecnic") || lower.includes("profilo at");
      const isCuoco = lower.includes("cuoco");
      const isAgrario = lower.includes("assistente agrari") || lower.includes("profilo cr");

      if (isDocente) conv.docenti++;
      if (isCS) conv.collaboratore_scolastico++;
      if (isAA) conv.assistente_amministrativo++;
      if (isAT) conv.assistente_tecnico++;
      if (isCuoco) conv.cuoco++;
      if (isAgrario) conv.assistente_agrario++;

      // Estrai dettagli numerici esatti
      const puntDetected = extractScoreRobust(block);

      const posMatch = block.match(/(?:pos(?:izione)?\.?|posto|graduatoria n\.?)[:\s#]+([0-9]{1,4})/i);
      let posStr = posMatch ? `Pos. ${posMatch[1]}` : "Non disponibile";

      const fasciaMatch = block.match(/(?:fascia|graduatoria di)[:\s]+([1-3]|prima|seconda|terza|I|II|III)\b/i);
      let fasciaStr = fasciaMatch ? formatFasciaLabel(fasciaMatch[1]) : (lower.includes("24 mesi") ? "Prima Fascia (24 Mesi)" : "Non disponibile");

      const oreMatch = block.match(/([0-9]{1,2}(?:\/[0-9]{1,2})?)\s*(?:ore|h\b|settimanali)/i);
      let oreStr = oreMatch ? `${oreMatch[1]} ore settimanali` : "Non disponibile";

      // Decorrenza
      let decStr = "Non disponibile";
      const decMatch = block.match(/(?:dal|decorrenza)[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})(?:\s+(?:al|fino al)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}|termine delle attivit[àa]))?/i);
      if (decMatch) {
        decStr = decMatch[2] ? `${decMatch[1]} - ${decMatch[2]}` : decMatch[1];
      } else if (lower.includes("30/06") || lower.includes("30 giugno")) {
        decStr = "30/06/2026";
      } else if (lower.includes("31/08") || lower.includes("31 agosto")) {
        decStr = "31/08/2026";
      }

      // Tipologia, Profilo, Classe di concorso, Tipo posto
      let tipologia: TipologiaPersonale = lower.includes("docent") || lower.includes("prof") || lower.includes("insegnant") || /\b[a-z]{1,2}-[0-9]{2}\b/i.test(lower) ? "DOCENTE" : "ATA";
      let profilo = "Non disponibile";
      let cdc = "Non disponibile";
      let tipoPosto: TipoPosto = lower.includes("sostegno") ? "sostegno" : "comune";

      if (tipologia === "DOCENTE") {
        profilo = "Docente";
        const cdcMatch = block.match(/\b([A-B]-?[0-9]{2}|ADMM|ADSS|ADEE|AAAA|EEEE|AB24|AA24|AC24)\b/i);
        if (cdcMatch) {
          cdc = cdcMatch[1].toUpperCase();
          profilo = cdc.startsWith("AD") ? `Docente Sostegno ${cdc}` : `Docente ${cdc}`;
        }
      } else if (isAA) {
        profilo = "Assistente Amministrativo";
        cdc = "AA";
      } else if (isAT) {
        profilo = "Assistente Tecnico";
        cdc = "AT";
      } else if (isCuoco) {
        profilo = "Cuoco";
        cdc = "CS";
      } else if (isAgrario) {
        profilo = "Addetto alle aziende agrarie";
        cdc = "CR";
      } else if (isCS || lower.includes("collaboratore")) {
        profilo = "Collaboratore Scolastico";
        cdc = "CS";
      }

      let punteggio: number | null = puntDetected;
      let originePunteggio: string = puntDetected !== null ? (lower.includes("decreto") ? "Decreto di Individuazione" : "Graduatoria Ufficiale") : "Non disponibile";

      // Nominativo
      let candidateName = targetNominativo || (block.match(/(?:nominativo|candidat[oa]|docente|supplente|alla sig\.?ra|al sig\.?|individuato|assegnato a)[:\s]+([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){1,3})/)?.[1]);
      if (!candidateName) {
        candidateName = "Non disponibile";
      }

      const key = `${tipologia}_${profilo}_${cdc}_${decStr}`;
      if (!seenNomineKeys.has(key)) {
        seenNomineKeys.add(key);
        nomine.push({
          nome_istituto: "",
          codice_meccanografico: "",
          nominativo: candidateName,
          tipologia_personale: tipologia,
          profilo_lavorativo: profilo,
          classe_concorso_area_lab: cdc,
          tipo_posto: tipoPosto,
          punteggio,
          origine_punteggio: originePunteggio,
          posizione_graduatoria: posStr,
          fascia: fasciaStr,
          ore_settimanali: oreStr,
          decorrenza_contratto: decStr,
          durata_contratto_mesi: "Non disponibile",
          durata_contratto_giorni: "",
          link_del_documento: url
        });
      }
    }
  }

  return {
    convocazioni: conv,
    pensionamenti: pens,
    nomine
  };
}

/**
 * Trova i link delle sezioni rilevanti (Albo, Circolari, Graduatorie, Bandi) da una pagina HTML.
 */
export function findSchoolInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  let baseDomain = "";

  try {
    baseDomain = new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return [];
  }

  const anchorRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    const anchorText = match[2]?.replace(/<[^>]+>/g, " ").trim().toLowerCase();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:")) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, baseUrl).href;
      const resolvedHost = new URL(resolved).hostname.toLowerCase().replace(/^www\./, "");

      const isAllowedDomain = resolvedHost === baseDomain || 
        resolvedHost.includes("albipretorionline.com") ||
        resolvedHost.includes("portaleargo.it") ||
        resolvedHost.includes("axioscloud.it") ||
        resolvedHost.includes("spaggiari.eu") ||
        resolvedHost.includes("trasparenzascuole.it");

      if (!isAllowedDomain) continue;

      const combined = `${anchorText} ${resolved.toLowerCase()}`;
      const isRelevant = 
        combined.includes("albo") ||
        combined.includes("bacheca") ||
        combined.includes("circolari") ||
        combined.includes("avvisi") ||
        combined.includes("graduatorie") ||
        combined.includes("interpelli") ||
        combined.includes("bandi") ||
        combined.includes("trasparenza");

      if (isRelevant && !seen.has(resolved)) {
        seen.add(resolved);
        links.push(resolved);
        if (links.length >= 4) break;
      }
    } catch {
      // Ignora URL non validi
    }
  }

  return links;
}

/**
 * Ricerca web avanzata per interrogare sia interpelli sia le graduatorie definitive e decreti con punteggi.
 */
export async function searchSchoolActsFallback(
  schoolName: string,
  cityName?: string
): Promise<{ text: string; discoveredUrl?: string }> {
  try {
    // Query 1: Atti e interpelli generali
    const q1 = encodeURIComponent(`${schoolName} ${cityName || ''} albo pretorio interpelli convocazioni supplenze site:edu.it OR site:it`);
    // Query 2: Graduatorie definitive, nomine, punteggi e posizioni
    const q2 = encodeURIComponent(`${schoolName} graduatoria definitiva istituto docenti ata punti pos. decreto individuazione`);

    const [res1, res2] = await Promise.all([
      fetch(`https://r.jina.ai/https://html.duckduckgo.com/html/?q=${q1}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      }).catch(() => null),
      fetch(`https://r.jina.ai/https://html.duckduckgo.com/html/?q=${q2}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      }).catch(() => null)
    ]);

    let combinedText = "";
    if (res1 && res1.ok) {
      combinedText += (await res1.text()) + "\n";
    }
    if (res2 && res2.ok) {
      combinedText += (await res2.text()) + "\n";
    }

    const eduMatch = combinedText.match(/https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.edu\.it)/i);
    const discoveredUrl = eduMatch ? `https://${eduMatch[1]}` : undefined;

    return {
      text: combinedText.slice(0, 30000),
      discoveredUrl
    };
  } catch {
    return { text: "" };
  }
}

/**
 * Estrae e analizza i dati di una scuola esplorando la homepage, le sezioni chiave, PDF e graduatorie.
 */
export async function extractSchoolData(
  homepageHtml: string,
  url: string,
  apiKey: string,
  graduatorie: GraduatoriaIstituto[] = [],
  singleNominativo?: string,
  initialHint?: { nome_istituto?: string; codice_meccanografico?: string },
  fetchSubPageFn?: (subUrl: string) => Promise<string>
): Promise<ExtractionData> {
  const mainInstituteName = extractMainInstituteName(initialHint?.nome_istituto) || initialHint?.nome_istituto || "";
  const detectedMecc = initialHint?.codice_meccanografico || extractCodiceMeccanograficoFromText(homepageHtml, url);
  let effectiveNome = mainInstituteName || url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  let effectiveUrl = url;

  let aggregatedText = (homepageHtml || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  // 1. Ricerca web avanzata per interrogare sia interpelli sia graduatorie definitive con punteggi
  if (effectiveNome) {
    const webResult = await searchSchoolActsFallback(effectiveNome);
    if (webResult.text) {
      aggregatedText += `\n--- ATTI E GRADUATORIE WEB UFFICIALI ---\n${webResult.text}`;
    }
    if (webResult.discoveredUrl && (!effectiveUrl.startsWith("http") || effectiveUrl.includes("gov.itit"))) {
      effectiveUrl = webResult.discoveredUrl;
    }
  }

  // 2. Se abbiamo un fetcher per sottopagine, esplora le sezioni interne (Albo / Circolari / Graduatorie)
  if (fetchSubPageFn && aggregatedText.length > 200) {
    const internalLinks = findSchoolInternalLinks(homepageHtml, effectiveUrl);
    for (const subLink of internalLinks.slice(0, 3)) {
      try {
        const subHtml = await fetchSubPageFn(subLink);
        if (subHtml && subHtml.length > 100) {
          const cleanSub = subHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
          aggregatedText += `\n--- SEZIONE ${subLink} ---\n${cleanSub}`;
        }
      } catch {
        // procedi
      }
    }
  }

  // 3. Esegui analisi euristica ad alta precisione
  let heuristicResult = analyzeSchoolContentHeuristic(aggregatedText, effectiveUrl, singleNominativo, effectiveNome);

  // 4. Se è configurata una chiave AI, affina i risultati
  let aiNomine: NominaContrattoItem[] = [];
  if (apiKey && apiKey.trim()) {
    try {
      const sampleForAi = aggregatedText
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 9000);

      const prompt = `Analizza il testo della scuola "${effectiveNome}" per estrarre contratti, nomine concluse, graduatorie o interpelli docenti/ATA.
${singleNominativo ? `Cerca con priorità assoluta il candidato "${singleNominativo}".` : ""}

Rispondi SOLO in JSON:
{
  "nome_istituto": "${effectiveNome}",
  "codice_meccanografico": "${detectedMecc || ''}",
  "nomine": [
    {
      "nominativo": "Nome Cognome o Interpello aperto",
      "tipologia_personale": "DOCENTE o ATA",
      "profilo_lavorativo": "Docente Scuola Secondaria / Collaboratore scolastico",
      "classe_concorso_area_lab": "A-22 o CS o AA",
      "punteggio": 48.5,
      "origine_punteggio": "Decreto di Individuazione o Graduatoria Definitiva",
      "posizione_graduatoria": "Pos. 1",
      "fascia": "Prima Fascia (24 Mesi) o Seconda Fascia o Terza Fascia",
      "ore_settimanali": "18 ore settimanali",
      "decorrenza_contratto": "30/06/2026"
    }
  ]
}

Testo:
"""${sampleForAi}"""`;

      const aiResponse = await extractWithOpenRouter(
        prompt,
        apiKey.trim(),
        "Sei un assistente per l'analisi di contratti scolastici italiani. Rispondi solo in JSON valido."
      );

      const cleanJson = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedAi = JSON.parse(cleanJson);
      if (Array.isArray(parsedAi?.nomine)) {
        for (const n of parsedAi.nomine) {
          aiNomine.push({
            nome_istituto: effectiveNome,
            codice_meccanografico: detectedMecc || "",
            nominativo: n.nominativo || singleNominativo || "Interpello aperto / Convocazione",
            tipologia_personale: n.tipologia_personale === "DOCENTE" ? "DOCENTE" : "ATA",
            profilo_lavorativo: n.profilo_lavorativo || (n.tipologia_personale === "DOCENTE" ? "Docente" : "Collaboratore scolastico"),
            classe_concorso_area_lab: n.classe_concorso_area_lab || (n.tipologia_personale === "DOCENTE" ? "Curricolare" : "CS"),
            tipo_posto: "comune",
            punteggio: typeof n.punteggio === "number" ? n.punteggio : null,
            origine_punteggio: typeof n.punteggio === "number" ? (n.origine_punteggio || "Decreto di Individuazione") : "Graduatoria Definitiva d'Istituto",
            posizione_graduatoria: n.posizione_graduatoria || "Pos. 1",
            fascia: n.fascia || "Prima Fascia",
            ore_settimanali: n.ore_settimanali || (n.tipologia_personale === "DOCENTE" ? "18 ore settimanali" : "36 ore settimanali"),
            decorrenza_contratto: n.decorrenza_contratto || "Fino al termine delle attività didattiche (30/06/2026)",
            durata_contratto_mesi: "",
            durata_contratto_giorni: "",
            link_del_documento: effectiveUrl
          });
        }
      }
    } catch {
      // AI fallback ignored
    }
  }

  // 5. Combina le nomine trovate
  const combinedNomine: NominaContrattoItem[] = [];
  const seenNomine = new Set<string>();

  for (const n of [...heuristicResult.nomine, ...aiNomine]) {
    n.nome_istituto = effectiveNome;
    n.codice_meccanografico = detectedMecc || "";
    const key = `${n.tipologia_personale}_${n.profilo_lavorativo}_${n.classe_concorso_area_lab}_${n.nominativo || ''}`;
    if (!seenNomine.has(key)) {
      seenNomine.add(key);
      combinedNomine.push(n);
    }
  }

  // Se l'utente cercava un nominativo specifico, crea o aggiorna il record prioritario
  if (singleNominativo && singleNominativo.trim()) {
    const existingNom = combinedNomine.find(n => isNameMatch(n.nominativo, singleNominativo));
    if (!existingNom) {
      combinedNomine.unshift({
        nome_istituto: effectiveNome,
        codice_meccanografico: detectedMecc || "",
        nominativo: singleNominativo.trim(),
        tipologia_personale: heuristicResult.convocazioni.docenti > heuristicResult.convocazioni.collaboratore_scolastico ? "DOCENTE" : "ATA",
        profilo_lavorativo: heuristicResult.convocazioni.docenti > heuristicResult.convocazioni.collaboratore_scolastico ? "Docente" : "Collaboratore scolastico",
        classe_concorso_area_lab: heuristicResult.convocazioni.docenti > heuristicResult.convocazioni.collaboratore_scolastico ? "Curricolare" : "CS",
        tipo_posto: "comune",
        punteggio: null,
        origine_punteggio: "Graduatoria Definitiva d'Istituto",
        posizione_graduatoria: "Pos. 1",
        fascia: "Prima Fascia",
        ore_settimanali: "",
        decorrenza_contratto: "",
        durata_contratto_mesi: "",
        durata_contratto_giorni: "",
        link_del_documento: effectiveUrl
      });
    }
  }

  // 6. Cross-reference con le graduatorie salvate nel local storage
  const processedNomine = combinedNomine.map(nom => {
    return crossReferenceNomina(nom, graduatorie, {
      codice_meccanografico: detectedMecc || undefined,
      nome_istituto: effectiveNome
    });
  });

  const firstNom = processedNomine[0];

  const finalData: ExtractionData = {
    nome_istituto: effectiveNome,
    codice_meccanografico: detectedMecc || "",
    nominativo: singleNominativo || firstNom?.nominativo,
    nomine_contratti: processedNomine,

    convocazioni_collaboratore_scolastico: heuristicResult.convocazioni.collaboratore_scolastico,
    convocazioni_assistente_amministrativo: heuristicResult.convocazioni.assistente_amministrativo,
    convocazioni_docenti: heuristicResult.convocazioni.docenti,
    convocazioni_assistente_tecnico: heuristicResult.convocazioni.assistente_tecnico,
    convocazioni_cuoco: heuristicResult.convocazioni.cuoco,
    convocazioni_assistente_agrario: heuristicResult.convocazioni.assistente_agrario,

    pensionamenti_collaboratore_scolastico: heuristicResult.pensionamenti.collaboratore_scolastico,
    pensionamenti_assistente_amministrativo: heuristicResult.pensionamenti.assistente_amministrativo,
    pensionamenti_docenti: heuristicResult.pensionamenti.docenti,
    pensionamenti_assistente_tecnico: heuristicResult.pensionamenti.assistente_tecnico,
    pensionamenti_cuoco: heuristicResult.pensionamenti.cuoco,
    pensionamenti_assistente_agrario: heuristicResult.pensionamenti.assistente_agrario,

    tipologia_personale: firstNom?.tipologia_personale || (heuristicResult.convocazioni.docenti > 0 ? "DOCENTE" : "ATA"),
    profilo_lavorativo: firstNom?.profilo_lavorativo || "",
    classe_concorso_area_lab: firstNom?.classe_concorso_area_lab || "",
    tipo_posto: firstNom?.tipo_posto || "comune",
    punteggio: firstNom?.punteggio !== undefined ? firstNom.punteggio : null,
    origine_punteggio: firstNom?.origine_punteggio || "Graduatoria Definitiva d'Istituto",
    confidence: firstNom?.confidence,
    posizione_graduatoria: firstNom?.posizione_graduatoria || "Pos. 1",
    graduatoria_fascia: firstNom?.fascia || "Prima Fascia",
    ore_settimanali: firstNom?.ore_settimanali || "",
    decorrenza_contratto: firstNom?.decorrenza_contratto || "",
    note_cross_reference: firstNom?.note_cross_reference || ""
  };

  // Applica resolveFromGraduatorie con fetchProxyFn, fetchAiFn e pdfTextExtractor
  try {
    const resolved = await resolveFromGraduatorie(finalData, {
      apiKey: apiKey,
      targetUrl: effectiveUrl,
      initialContent: aggregatedText,
      fetchProxyFn: async (subUrl: string, asArrayBuffer?: boolean) => {
        if (!fetchSubPageFn) {
          return { data: null, format: "html" };
        }
        const targetFetchUrl = asArrayBuffer ? `${subUrl}${subUrl.includes('?') ? '&' : '?'}raw=1` : subUrl;
        const resText = await fetchSubPageFn(targetFetchUrl);
        if (asArrayBuffer) {
          const buf = new TextEncoder().encode(resText).buffer;
          return { data: buf, format: "buffer" };
        }
        return { data: resText, format: "html" };
      },
      fetchAiFn: async (promptText: string, sysPrompt: string) => {
        if (!apiKey || !apiKey.trim()) throw new Error("API Key mancante");
        const resStr = await extractWithOpenRouter(promptText, apiKey, sysPrompt);
        try {
          return JSON.parse(resStr);
        } catch {
          return resStr;
        }
      },
      pdfTextExtractor: async (buffer: ArrayBuffer, maxPages?: number) => {
        const res = await extractTextFromPdfBuffer(new Uint8Array(buffer), maxPages);
        return { text: res.text, numPages: res.numPages };
      }
    });
    return resolved;
  } catch {
    return finalData;
  }
}
