import { ExtractionData, GraduatoriaIstituto, OriginePunteggio, NominaContrattoItem } from "../types";
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
    if (/(?:ic|i\.c\.|istituto|iis|i\.i\.s\.|liceo|direzione|omnicomprensivo|io\b)/i.test(lastPart)) {
      clean = lastPart;
    } else if (/(?:ic|i\.c\.|istituto|iis|i\.i\.s\.|liceo|direzione|omnicomprensivo|io\b)/i.test(parts[0])) {
      clean = parts[0].trim();
    }
  }

  // Pulisci prefissi comuni
  clean = clean.replace(/^(?:SC\.?\s*INFANZIA|SCUOLA\s*PRIMARIA|INFANZIA|PRIMARIA|SECONDARIA)\s+/i, "");
  return clean.trim();
}

/**
 * Analizzatore euristico ad alta precisione per estrarre convocazioni, pensionamenti e contratti
 * direttamente dal testo della pagina o dai risultati di ricerca atti.
 */
export function analyzeSchoolContentHeuristic(
  text: string,
  url: string,
  targetNominativo?: string
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

    // Rileva Convocazioni / Interpelli / Supplenze
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
      lower.includes("messa a disposizione")
    );

    if (isConvocazioneOrInterpello) {
      if (lower.includes("collaboratore scolastic") || lower.includes("profilo cs") || (lower.includes(" ata") && !lower.includes("amministrativ"))) {
        conv.collaboratore_scolastico++;
      }
      if (lower.includes("assistente amministrativ") || lower.includes("profilo aa")) {
        conv.assistente_amministrativo++;
      }
      if (
        lower.includes("docent") ||
        lower.includes("insegnant") ||
        lower.includes("classe di concorso") ||
        lower.includes("scuola primaria") ||
        lower.includes("scuola secondaria") ||
        lower.includes("scuola dell'infanzia") ||
        /\b[a-z]{1,2}-[0-9]{2}\b/i.test(lower) ||
        lower.includes("sostegno")
      ) {
        conv.docenti++;
      }
      if (lower.includes("assistente tecnic") || lower.includes("profilo at")) {
        conv.assistente_tecnico++;
      }
      if (lower.includes("cuoco")) {
        conv.cuoco++;
      }
      if (lower.includes("assistente agrari") || lower.includes("profilo cr")) {
        conv.assistente_agrario++;
      }

      // Rileva se è una nomina o contratto con dettagli candidato
      const isNomina = (
        lower.includes("decreto di individuazione") ||
        lower.includes("stipula contratto") ||
        lower.includes("contratto di supplenza") ||
        lower.includes("individuato") ||
        lower.includes("assegnazione incarico") ||
        lower.includes("aggiudicazione") ||
        (targetNominativo && isNameMatch(block, targetNominativo))
      );

      if (isNomina) {
        let punteggio: number | null = null;
        const puntMatch = block.match(/(?:punteggio|punti|pt\.?|votazione)[:\s]+([0-9]{1,3}(?:[.,][0-9]{1,2})?)/i);
        if (puntMatch) {
          punteggio = parseFloat(puntMatch[1].replace(",", "."));
        }

        let posStr = "Non disponibile";
        const posMatch = block.match(/(?:pos(?:izione)?\.?|posto|graduatoria n\.?)[:\s#]+([0-9]{1,4})/i);
        if (posMatch) {
          posStr = posMatch[1];
        }

        let fasciaStr = "";
        const fasciaMatch = block.match(/(?:fascia|graduatoria di)[:\s]+([1-3]|prima|seconda|terza|I|II|III)\b/i);
        if (fasciaMatch) {
          fasciaStr = formatFasciaLabel(fasciaMatch[1]);
        }

        let oreStr = "";
        const oreMatch = block.match(/([0-9]{1,2}(?:\/[0-9]{1,2})?)\s*(?:ore|h\b|settimanali)/i);
        if (oreMatch) {
          oreStr = `${oreMatch[1]} ore`;
        }

        let decStr = "";
        const decMatch = block.match(/(?:dal|decorrenza)[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})(?:\s+(?:al|fino al)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}|termine delle attivit[àa]))?/i);
        if (decMatch) {
          decStr = decMatch[2] ? `${decMatch[1]} - ${decMatch[2]}` : decMatch[1];
        }

        let profilo = "Collaboratore scolastico";
        let tipologia: "ATA" | "DOCENTE" = "ATA";
        let cdc = "";

        if (lower.includes("docent") || lower.includes("primaria") || lower.includes("secondaria") || /\b[a-z]{1,2}-[0-9]{2}\b/i.test(lower)) {
          tipologia = "DOCENTE";
          profilo = "Docente";
          const cdcMatch = block.match(/\b([A-Z]{1,2}-?[0-9]{2})\b/i);
          if (cdcMatch) {
            cdc = cdcMatch[1].toUpperCase();
            profilo = `Docente ${cdc}`;
          }
        } else if (lower.includes("amministrativ")) {
          profilo = "Assistente amministrativo";
          cdc = "AA";
        } else if (lower.includes("tecnic")) {
          profilo = "Assistente tecnico";
          cdc = "AT";
        } else if (lower.includes("cuoco")) {
          profilo = "Cuoco";
          cdc = "CS";
        }

        const candidateName = targetNominativo || (block.match(/(?:nominativo|candidat[oa]|docente|supplente|alla sig\.?ra|al sig\.?)[:\s]+([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){1,3})/)?.[1]);

        const key = `${candidateName || ''}_${profilo}_${decStr}`;
        if (!seenNomineKeys.has(key)) {
          seenNomineKeys.add(key);
          nomine.push({
            nome_istituto: "",
            codice_meccanografico: "",
            nominativo: candidateName,
            tipologia_personale: tipologia,
            profilo_lavorativo: profilo,
            classe_concorso_area_lab: cdc,
            tipo_posto: lower.includes("sostegno") ? "sostegno" : "comune",
            punteggio,
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
  let heuristicResult = analyzeSchoolContentHeuristic(aggregatedText, effectiveUrl, singleNominativo);

  // Se i conteggi sono ancora a zero e abbiamo il nome della scuola, interroga l'indice pubblico degli interpelli
  const totalConvocazioni = Object.values(heuristicResult.convocazioni).reduce((a, b) => a + b, 0);
  if (totalConvocazioni === 0 && effectiveNome) {
    const searchFall = await searchSchoolActsFallback(effectiveNome);
    if (searchFall.text) {
      const extraHeuristic = analyzeSchoolContentHeuristic(searchFall.text, effectiveUrl, singleNominativo);
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
      if (searchFall.discoveredUrl && effectiveUrl.includes("gov.itit") || !effectiveUrl.startsWith("http")) {
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

      const prompt = `Analizza il testo della scuola "${effectiveNome}" per estrarre contratti o nomine concluse.
${singleNominativo ? `Cerca con priorità assoluta il candidato "${singleNominativo}".` : ""}

Rispondi SOLO in JSON:
{
  "nome_istituto": "${effectiveNome}",
  "codice_meccanografico": "${detectedMecc || ''}",
  "nomine": [
    {
      "nominativo": "Nome Cognome",
      "tipologia_personale": "ATA o DOCENTE",
      "profilo_lavorativo": "Collaboratore scolastico / Docente A-22 / ecc.",
      "punteggio": null,
      "posizione_graduatoria": "Non disponibile",
      "fascia": "",
      "ore_settimanali": "36 ore",
      "decorrenza_contratto": "01/10/2024 - 30/06/2025"
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
          if (n.nominativo || singleNominativo) {
            aiNomine.push({
              nome_istituto: effectiveNome,
              codice_meccanografico: detectedMecc || "",
              nominativo: n.nominativo || singleNominativo,
              tipologia_personale: n.tipologia_personale === "DOCENTE" ? "DOCENTE" : "ATA",
              profilo_lavorativo: n.profilo_lavorativo || "Collaboratore scolastico",
              classe_concorso_area_lab: "",
              tipo_posto: "comune",
              punteggio: typeof n.punteggio === "number" ? n.punteggio : null,
              origine_punteggio: typeof n.punteggio === "number" ? "Esplicito" : "Non disponibile",
              posizione_graduatoria: n.posizione_graduatoria || "Non disponibile",
              fascia: n.fascia || "",
              ore_settimanali: n.ore_settimanali || "",
              decorrenza_contratto: n.decorrenza_contratto || "",
              durata_contratto_mesi: "",
              durata_contratto_giorni: "",
              link_del_documento: effectiveUrl
            });
          }
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
    const key = `${n.nominativo || ''}_${n.profilo_lavorativo}_${n.decorrenza_contratto}`;
    if (!seenNomine.has(key)) {
      seenNomine.add(key);
      combinedNomine.push(n);
    }
  }

  if (singleNominativo && singleNominativo.trim() && combinedNomine.length === 0) {
    combinedNomine.push({
      nome_istituto: effectiveNome,
      codice_meccanografico: detectedMecc || "",
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
      link_del_documento: effectiveUrl
    });
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

    tipologia_personale: firstNom?.tipologia_personale || "ATA",
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
