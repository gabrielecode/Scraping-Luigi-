import { ExtractionData, GraduatoriaIstituto, OriginePunteggio, NominaContrattoItem, TipologiaPersonale, TipoPosto } from "../types";
import { 
  extractCodiceMeccanograficoFromText, 
  crossReferenceNomina, 
  resolveFromGraduatorie,
  extractWithOpenRouter,
  isNameMatch,
  formatFasciaLabel
} from "./graduatorieService";

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

  // Spezza il testo in blocchi/paragrafi/righe
  const blocks = text.split(/(?:\r?\n){1,2}|<br\s*\/?>|<\/p>|<\/li>|<\/tr>|##\s+/i)
    .map(b => b.replace(/<[^>]+>/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim())
    .filter(b => b.length > 15);

  const seenNomineKeys = new Set<string>();

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

      // Estrai o inferisci i dettagli della posizione/nomina
      let punteggio: number | null = null;
      const puntMatch = block.match(/(?:punteggio|punti|pt\.?|votazione)[:\s]+([0-9]{1,3}(?:[.,][0-9]{1,2})?)/i);
      if (puntMatch) {
        punteggio = parseFloat(puntMatch[1].replace(",", "."));
      }

      let posStr = "Da graduatoria d'istituto";
      const posMatch = block.match(/(?:pos(?:izione)?\.?|posto|graduatoria n\.?)[:\s#]+([0-9]{1,4})/i);
      if (posMatch) {
        posStr = `Pos. ${posMatch[1]}`;
      }

      let fasciaStr = "Graduatoria d'Istituto";
      const fasciaMatch = block.match(/(?:fascia|graduatoria di)[:\s]+([1-3]|prima|seconda|terza|I|II|III)\b/i);
      if (fasciaMatch) {
        fasciaStr = formatFasciaLabel(fasciaMatch[1]);
      }

      // Ore settimanali
      let oreStr = "";
      const oreMatch = block.match(/([0-9]{1,2}(?:\/[0-9]{1,2})?)\s*(?:ore|h\b|settimanali)/i);
      if (oreMatch) {
        oreStr = `${oreMatch[1]} ore settimanali`;
      }

      // Decorrenza
      let decStr = "";
      const decMatch = block.match(/(?:dal|decorrenza)[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})(?:\s+(?:al|fino al)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}|termine delle attivit[àa]))?/i);
      if (decMatch) {
        decStr = decMatch[2] ? `${decMatch[1]} - ${decMatch[2]}` : decMatch[1];
      } else if (lower.includes("30/06") || lower.includes("30 giugno") || lower.includes("termine delle attivit")) {
        decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      } else if (lower.includes("31/08") || lower.includes("31 agosto") || lower.includes("annuale")) {
        decStr = "Fino al termine dell'anno scolastico (31/08/2026)";
      } else if (lower.includes("avente diritto")) {
        decStr = "Fino all'avente diritto";
      }

      // Tipologia, Profilo, Classe di concorso, Tipo posto
      let tipologia: TipologiaPersonale = "ATA";
      let profilo = "Collaboratore scolastico";
      let cdc = "CS";
      let tipoPosto: TipoPosto = lower.includes("sostegno") ? "sostegno" : "comune";

      if (isDocente) {
        tipologia = "DOCENTE";
        profilo = "Docente Scuola Secondaria / Primaria";
        cdc = "A-22";

        // Estrazione classe di concorso
        const cdcMatch = block.match(/\b([A-B]-?[0-9]{2}|ADMM|ADSS|ADEE|AAAA|EEEE|AB24|AA24|AC24)\b/i);
        if (cdcMatch) {
          cdc = cdcMatch[1].toUpperCase();
          if (cdc === "ADMM") {
            profilo = "Docente Sostegno Scuola Secondaria I Grado";
            tipoPosto = "sostegno";
          } else if (cdc === "ADSS") {
            profilo = "Docente Sostegno Scuola Secondaria II Grado";
            tipoPosto = "sostegno";
          } else if (cdc === "ADEE") {
            profilo = "Docente Sostegno Scuola Primaria";
            tipoPosto = "sostegno";
          } else if (cdc === "EEEE") {
            profilo = "Docente Scuola Primaria";
          } else if (cdc === "AAAA") {
            profilo = "Docente Scuola dell'Infanzia";
          } else {
            profilo = `Docente Classe di Concorso ${cdc}`;
          }
        } else if (lower.includes("primaria")) {
          profilo = "Docente Scuola Primaria";
          cdc = tipoPosto === "sostegno" ? "ADEE" : "EEEE";
        } else if (lower.includes("infanzia")) {
          profilo = "Docente Scuola dell'Infanzia";
          cdc = "AAAA";
        } else if (lower.includes("secondaria")) {
          profilo = "Docente Scuola Secondaria";
          cdc = tipoPosto === "sostegno" ? "ADMM" : "A-22";
        }

        if (!oreStr) {
          oreStr = lower.includes("primaria") ? "24 ore settimanali" : lower.includes("infanzia") ? "25 ore settimanali" : "18 ore settimanali (Cattedra)";
        }
        if (!decStr) {
          decStr = "Fino al termine delle attività didattiche (30/06/2026)";
        }
      } else if (isAA) {
        tipologia = "ATA";
        profilo = "Assistente Amministrativo";
        cdc = "AA";
        if (!oreStr) oreStr = "36 ore settimanali (Tempo pieno)";
        if (!decStr) decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      } else if (isAT) {
        tipologia = "ATA";
        profilo = "Assistente Tecnico";
        cdc = "AT";
        if (!oreStr) oreStr = "36 ore settimanali (Tempo pieno)";
        if (!decStr) decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      } else if (isCuoco) {
        tipologia = "ATA";
        profilo = "Cuoco";
        cdc = "CS";
        if (!oreStr) oreStr = "36 ore settimanali (Tempo pieno)";
        if (!decStr) decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      } else if (isAgrario) {
        tipologia = "ATA";
        profilo = "Addetto alle aziende agrarie";
        cdc = "CR";
        if (!oreStr) oreStr = "36 ore settimanali (Tempo pieno)";
        if (!decStr) decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      } else {
        tipologia = "ATA";
        profilo = "Collaboratore Scolastico";
        cdc = "CS";
        if (!oreStr) oreStr = "36 ore settimanali (Tempo pieno)";
        if (!decStr) decStr = "Fino al termine delle attività didattiche (30/06/2026)";
      }

      // Nominativo
      let candidateName = targetNominativo || (block.match(/(?:nominativo|candidat[oa]|docente|supplente|alla sig\.?ra|al sig\.?|individuato|assegnato a)[:\s]+([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){1,3})/)?.[1]);
      if (!candidateName) {
        candidateName = lower.includes("interpell") ? "Interpello aperto / Selezione pubblica" : "Convocazione / Selezione aperta";
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
          punteggio: punteggio !== null ? punteggio : "Da graduatoria d'istituto",
          origine_punteggio: punteggio !== null ? "Esplicito" : "Non disponibile",
          posizione_graduatoria: posStr,
          fascia: fasciaStr,
          ore_settimanali: oreStr,
          decorrenza_contratto: decStr,
          durata_contratto_mesi: "",
          durata_contratto_giorni: "",
          link_del_documento: url
        });
      }
    }
  }

  // Se sono state contate convocazioni (es. 15 Docenti o 3 ATA) ma non c'erano blocchi singoli in nomine:
  // sintetizza automaticamente le posizioni corrispondenti
  const schoolProfile = deduceSchoolOrderAndProfile(schoolNameHint || "");

  if (conv.docenti > 0 && !nomine.some(n => n.tipologia_personale === "DOCENTE")) {
    nomine.push({
      nome_istituto: "",
      codice_meccanografico: "",
      nominativo: targetNominativo || `Interpello aperto (${conv.docenti} posti/avvisi)`,
      tipologia_personale: "DOCENTE",
      profilo_lavorativo: schoolProfile.tipologiaDocente,
      classe_concorso_area_lab: schoolProfile.defaultCdc,
      tipo_posto: "comune",
      punteggio: "Da graduatoria d'istituto",
      origine_punteggio: "Non disponibile",
      posizione_graduatoria: "Da graduatoria d'istituto",
      fascia: "Graduatoria d'Istituto Docenti (I/II/III Fascia)",
      ore_settimanali: schoolProfile.defaultOreDocente,
      decorrenza_contratto: "Fino al termine delle attività didattiche (30/06/2026)",
      durata_contratto_mesi: "9 mesi",
      durata_contratto_giorni: "",
      link_del_documento: url
    });
  }

  if (conv.collaboratore_scolastico > 0 && !nomine.some(n => n.profilo_lavorativo.includes("Collaboratore"))) {
    nomine.push({
      nome_istituto: "",
      codice_meccanografico: "",
      nominativo: targetNominativo || `Convocazione aperta (${conv.collaboratore_scolastico} posti/avvisi)`,
      tipologia_personale: "ATA",
      profilo_lavorativo: "Collaboratore Scolastico",
      classe_concorso_area_lab: "CS",
      tipo_posto: "comune",
      punteggio: "Da graduatoria d'istituto",
      origine_punteggio: "Non disponibile",
      posizione_graduatoria: "Da graduatoria d'istituto",
      fascia: "Graduatoria ATA 24 Mesi / Terza Fascia",
      ore_settimanali: "36 ore settimanali (Tempo pieno)",
      decorrenza_contratto: "Fino al termine delle attività didattiche (30/06/2026)",
      durata_contratto_mesi: "9 mesi",
      durata_contratto_giorni: "",
      link_del_documento: url
    });
  }

  if (conv.assistente_amministrativo > 0 && !nomine.some(n => n.profilo_lavorativo.includes("Amministrativo"))) {
    nomine.push({
      nome_istituto: "",
      codice_meccanografico: "",
      nominativo: targetNominativo || `Convocazione aperta (${conv.assistente_amministrativo} posti/avvisi)`,
      tipologia_personale: "ATA",
      profilo_lavorativo: "Assistente Amministrativo",
      classe_concorso_area_lab: "AA",
      tipo_posto: "comune",
      punteggio: "Da graduatoria d'istituto",
      origine_punteggio: "Non disponibile",
      posizione_graduatoria: "Da graduatoria d'istituto",
      fascia: "Graduatoria ATA 24 Mesi / Terza Fascia",
      ore_settimanali: "36 ore settimanali (Tempo pieno)",
      decorrenza_contratto: "Fino al termine delle attività didattiche (30/06/2026)",
      durata_contratto_mesi: "9 mesi",
      durata_contratto_giorni: "",
      link_del_documento: url
    });
  }

  if (conv.assistente_tecnico > 0 && !nomine.some(n => n.profilo_lavorativo.includes("Tecnico"))) {
    nomine.push({
      nome_istituto: "",
      codice_meccanografico: "",
      nominativo: targetNominativo || `Convocazione aperta (${conv.assistente_tecnico} posti/avvisi)`,
      tipologia_personale: "ATA",
      profilo_lavorativo: "Assistente Tecnico",
      classe_concorso_area_lab: "AT",
      tipo_posto: "comune",
      punteggio: "Da graduatoria d'istituto",
      origine_punteggio: "Non disponibile",
      posizione_graduatoria: "Da graduatoria d'istituto",
      fascia: "Graduatoria ATA 24 Mesi / Terza Fascia",
      ore_settimanali: "36 ore settimanali (Tempo pieno)",
      decorrenza_contratto: "Fino al termine delle attività didattiche (30/06/2026)",
      durata_contratto_mesi: "9 mesi",
      durata_contratto_giorni: "",
      link_del_documento: url
    });
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
 * Ricerca web di fallback per interrogare gli interpelli e gli atti ufficiali dell'istituto.
 */
export async function searchSchoolActsFallback(
  schoolName: string,
  cityName?: string
): Promise<{ text: string; discoveredUrl?: string }> {
  try {
    const query = encodeURIComponent(`${schoolName} ${cityName || ''} albo pretorio interpelli convocazioni supplenze site:edu.it OR site:it`);
    const searchUrl = `https://r.jina.ai/https://html.duckduckgo.com/html/?q=${query}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!res.ok) return { text: "" };
    const content = await res.text();

    // Cerca nei risultati un URL .edu.it ufficiale attivo della scuola
    const eduMatch = content.match(/https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.edu\.it)/i);
    const discoveredUrl = eduMatch ? `https://${eduMatch[1]}` : undefined;

    return {
      text: content.slice(0, 15000),
      discoveredUrl
    };
  } catch {
    return { text: "" };
  }
}

/**
 * Estrae e analizza i dati di una scuola esplorando la homepage, le sezioni chiave e l'indice atti.
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

  // 1. Se il testo della homepage è scarso o assente (es. sito non raggiungibile o plesso), esegui ricerca web atti
  if (aggregatedText.length < 200 && effectiveNome) {
    const webResult = await searchSchoolActsFallback(effectiveNome);
    if (webResult.text) {
      aggregatedText += `\n--- ATTI E INTERPELLI WEB UFFICIALI ---\n${webResult.text}`;
    }
    if (webResult.discoveredUrl) {
      effectiveUrl = webResult.discoveredUrl;
    }
  }

  // 2. Se abbiamo un fetcher per sottopagine, esplora le sezioni interne (Albo / Circolari / Bandi)
  if (fetchSubPageFn && aggregatedText.length > 200) {
    const internalLinks = findSchoolInternalLinks(homepageHtml, effectiveUrl);
    for (const subLink of internalLinks.slice(0, 2)) {
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

  // Se i conteggi sono ancora a zero e abbiamo il nome della scuola, interroga l'indice pubblico degli interpelli
  const totalConvocazioni = Object.values(heuristicResult.convocazioni).reduce((a, b) => a + b, 0);
  if (totalConvocazioni === 0 && effectiveNome) {
    const searchFall = await searchSchoolActsFallback(effectiveNome);
    if (searchFall.text) {
      const extraHeuristic = analyzeSchoolContentHeuristic(searchFall.text, effectiveUrl, singleNominativo, effectiveNome);
      heuristicResult = {
        convocazioni: {
          collaboratore_scolastico: Math.max(heuristicResult.convocazioni.collaboratore_scolastico, extraHeuristic.convocazioni.collaboratore_scolastico),
          assistente_amministrativo: Math.max(heuristicResult.convocazioni.assistente_amministrativo, extraHeuristic.convocazioni.assistente_amministrativo),
          docenti: Math.max(heuristicResult.convocazioni.docenti, extraHeuristic.convocazioni.docenti),
          assistente_tecnico: Math.max(heuristicResult.convocazioni.assistente_tecnico, extraHeuristic.convocazioni.assistente_tecnico),
          cuoco: Math.max(heuristicResult.convocazioni.cuoco, extraHeuristic.convocazioni.cuoco),
          assistente_agrario: Math.max(heuristicResult.convocazioni.assistente_agrario, extraHeuristic.convocazioni.assistente_agrario),
        },
        pensionamenti: {
          collaboratore_scolastico: Math.max(heuristicResult.pensionamenti.collaboratore_scolastico, extraHeuristic.pensionamenti.collaboratore_scolastico),
          assistente_amministrativo: Math.max(heuristicResult.pensionamenti.assistente_amministrativo, extraHeuristic.pensionamenti.assistente_amministrativo),
          docenti: Math.max(heuristicResult.pensionamenti.docenti, extraHeuristic.pensionamenti.docenti),
          assistente_tecnico: Math.max(heuristicResult.pensionamenti.assistente_tecnico, extraHeuristic.pensionamenti.assistente_tecnico),
          cuoco: Math.max(heuristicResult.pensionamenti.cuoco, extraHeuristic.pensionamenti.cuoco),
          assistente_agrario: Math.max(heuristicResult.pensionamenti.assistente_agrario, extraHeuristic.pensionamenti.assistente_agrario),
        },
        nomine: [...heuristicResult.nomine, ...extraHeuristic.nomine]
      };
      if (searchFall.discoveredUrl && (effectiveUrl.includes("gov.itit") || !effectiveUrl.startsWith("http"))) {
        effectiveUrl = searchFall.discoveredUrl;
      }
    }
  }

  // 4. Se è configurata una chiave AI, affina i risultati
  let aiNomine: NominaContrattoItem[] = [];
  if (apiKey && apiKey.trim()) {
    try {
      const sampleForAi = aggregatedText
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 8000);

      const prompt = `Analizza il testo della scuola "${effectiveNome}" per estrarre contratti o nomine concluse o interpelli docenti/ATA.
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
      "punteggio": null,
      "posizione_graduatoria": "Pos. 1 o Da graduatoria",
      "fascia": "Prima fascia o Seconda fascia",
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
            punteggio: typeof n.punteggio === "number" ? n.punteggio : "Da graduatoria d'istituto",
            origine_punteggio: typeof n.punteggio === "number" ? "Esplicito" : "Non disponibile",
            posizione_graduatoria: n.posizione_graduatoria || "Da graduatoria d'istituto",
            fascia: n.fascia || "Graduatoria d'Istituto",
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
        origine_punteggio: "Non disponibile",
        posizione_graduatoria: "Da verificare in graduatoria",
        fascia: "",
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
    origine_punteggio: firstNom?.origine_punteggio || "Non disponibile",
    confidence: firstNom?.confidence,
    posizione_graduatoria: firstNom?.posizione_graduatoria || "Non disponibile",
    graduatoria_fascia: firstNom?.fascia || "",
    ore_settimanali: firstNom?.ore_settimanali || "",
    decorrenza_contratto: firstNom?.decorrenza_contratto || "",
    note_cross_reference: firstNom?.note_cross_reference || ""
  };

  // Se ci sono graduatorie caricate nel sistema, applica resolveFromGraduatorie
  if (graduatorie && graduatorie.length > 0) {
    try {
      const resolved = await resolveFromGraduatorie(finalData, {
        targetUrl: effectiveUrl,
        initialContent: aggregatedText
      });
      return resolved;
    } catch {
      return finalData;
    }
  }

  return finalData;
}
