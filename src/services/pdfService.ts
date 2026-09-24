/**
 * Servizio avanzato per l'estrazione e l'analisi di documenti PDF scolastici
 * ed estrazione euristica/regex di punteggi, soglie e posizioni da atti e graduatorie.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disabilita l'uso obbligatorio di web worker esterni per massima compatibilità client/server
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/**
 * Estrae il testo completo strutturato da un buffer PDF (ArrayBuffer o Uint8Array)
 * Ricostruisce le righe e le tabelle rispettando la sequenza dei blocchi di testo.
 */
export async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer | Uint8Array,
  maxPages = 100
): Promise<{ text: string; numPages: number }> {
  try {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const pagesToRead = Math.min(numPages, maxPages);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Raggruppa gli item per linea approssimata (usando coordinata Y)
        const items = textContent.items as Array<{ str: string; transform: number[] }>;
        if (!items || items.length === 0) continue;

        // Ordina dall'alto verso il basso (Y decrescente) e da sinistra a destra (X crescente)
        const sortedItems = [...items].sort((a, b) => {
          const yA = a.transform ? a.transform[5] : 0;
          const yB = b.transform ? b.transform[5] : 0;
          const xA = a.transform ? a.transform[4] : 0;
          const xB = b.transform ? b.transform[4] : 0;
          if (Math.abs(yA - yB) > 4) {
            return yB - yA; // Y decrescente (dall'alto in basso)
          }
          return xA - xB; // X crescente (da sinistra a destra)
        });

        let pageStr = '';
        let lastY: number | null = null;

        for (const item of sortedItems) {
          const curY = item.transform ? item.transform[5] : 0;
          if (lastY !== null && Math.abs(curY - lastY) > 4) {
            pageStr += '\n';
          } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
            pageStr += ' ';
          }
          pageStr += item.str;
          lastY = curY;
        }

        fullText += `\n--- PAGINA ${pageNum} DI ${numPages} ---\n${pageStr.trim()}\n`;
      } catch (pageErr: any) {
        fullText += `\n--- PAGINA ${pageNum} (Errore lettura: ${pageErr.message}) ---\n`;
      }
    }

    return { text: fullText.trim(), numPages };
  } catch (err: any) {
    throw new Error(`Estrazione PDF fallita: ${err.message}`);
  }
}

/**
 * Individua tutti i link a documenti PDF all'interno di un documento HTML
 * Ordinati per priorità (avvisi, graduatorie, convocazioni, disponibilità).
 */
export function extractPdfsFromHtml(
  html: string,
  baseUrl: string
): Array<{ url: string; title: string; priority: number }> {
  const pdfLinks: Array<{ url: string; title: string; priority: number }> = [];
  const seenUrls = new Set<string>();

  // Match any <a> tag
  const regex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const rawHref = match[1];
      const rawText = match[2].replace(/<[^>]+>/g, '').trim();
      const resolvedUrl = new URL(rawHref, baseUrl).href;

      if (seenUrls.has(resolvedUrl)) continue;

      const lowerHref = resolvedUrl.toLowerCase();
      const lowerText = rawText.toLowerCase();
      const combined = `${lowerHref} ${lowerText}`;

      // Check if it is likely a PDF or document download
      const isPdfExtension = lowerHref.endsWith('.pdf') || lowerHref.includes('.pdf?') || lowerHref.includes('.pdf/');
      const isDownloadUrl = lowerHref.includes('download') || lowerHref.includes('allegat') || lowerHref.includes('attachment') || lowerHref.includes('document') || lowerHref.includes('visualizza') || lowerHref.includes('getfile') || lowerHref.includes('uploads');
      const hasDocKeyword = lowerText.includes('pdf') || lowerText.includes('allegato') || lowerText.includes('scarica') || lowerText.includes('graduatori') || lowerText.includes('convocazion') || lowerText.includes('supplenz') || lowerText.includes('contratto') || lowerText.includes('nomina') || lowerText.includes('avviso');

      // Exclude non-PDF extensions to avoid false positives
      const isExcluded = lowerHref.endsWith('.zip') || lowerHref.endsWith('.png') || lowerHref.endsWith('.jpg') || lowerHref.endsWith('.jpeg') || lowerHref.endsWith('.doc') || lowerHref.endsWith('.docx') || lowerHref.endsWith('.xls') || lowerHref.endsWith('.xlsx') || lowerHref.endsWith('.mp4') || lowerHref.endsWith('.css') || lowerHref.endsWith('.js');

      if ((isPdfExtension || isDownloadUrl || hasDocKeyword) && !isExcluded) {
        seenUrls.add(resolvedUrl);

        // Calcola punteggio di priorità basato su parole chiave
        let priority = 1;

        if (
          combined.includes('graduatori') ||
          combined.includes('convocazion') ||
          combined.includes('calendario') ||
          combined.includes('supplenz') ||
          combined.includes('disponibilit') ||
          combined.includes('decreto') ||
          combined.includes('individuazion') ||
          combined.includes('assunzion') ||
          combined.includes('interpell') ||
          combined.includes('puntegg') ||
          combined.includes('nomina')
        ) {
          priority += 10;
        }

        if (combined.includes('ata') || combined.includes('docent')) {
          priority += 5;
        }

        // Penalizza moduli generici o privacy se non pertinenti
        if (combined.includes('privacy') || combined.includes('patto') || combined.includes('modulistica')) {
          priority -= 4;
        }

        pdfLinks.push({
          url: resolvedUrl,
          title: rawText || resolvedUrl.split('/').pop() || 'Documento PDF',
          priority,
        });
      }
    } catch {
      // Ignora URL non validi
    }
  }

  // Ordina per priorità decrescente
  return pdfLinks.sort((a, b) => b.priority - a.priority);
}

export interface HeuristicScoreResult {
  punteggio: number | null;
  sourcePhrase?: string;
  sogliaConvocazione?: number | null;
  sogliaPhrase?: string;
}

/**
 * Regex per individuare soglie di convocazione ("fino a punteggio 12", "fino a punti 11", "soglia convocazione: 12", ecc.).
 * Le soglie NON sono il punteggio del candidato e NON devono essere attribuite al campo punteggio:
 * lasciano punteggio=null e vengono salvate come "Soglia convocazione: N" in note_cross_reference.
 */
export const THRESHOLD_CONVOCAZIONE_REGEX = /(?:fino\s+a(?:l)?\s+(?:concorrenza\s+di\s+)?(?:punteggio|punti|pt\.?|p\.ti)|soglia\s*(?:di\s*)?(?:convocazione\s*)?(?:punteggio|punti|pt\.?|p\.ti)?)\s*(?:complessivo|totale|di)?\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;

/**
 * Individua un'eventuale soglia di convocazione all'interno di un testo.
 */
export function findThresholdInText(text: string): { soglia: number | null; sourcePhrase?: string } {
  if (!text || typeof text !== 'string') return { soglia: null };
  const clean = text.replace(/\s+/g, ' ');
  const match = clean.match(THRESHOLD_CONVOCAZIONE_REGEX);
  if (match && match[1]) {
    const val = parsePunteggioValue(match[1]);
    if (val !== null) {
      return { soglia: val, sourcePhrase: match[0] };
    }
  }
  return { soglia: null };
}

/**
 * Lista di coppie di parole maiuscole standard che non rappresentano un nominativo di candidato
 * (es. profili ATA, gradi scolastici, dizioni formali).
 */
const EXCLUDED_UPPERCASE_PAIRS = new Set([
  "COLLABORATORE SCOLASTICO",
  "COLLABORATRICE SCOLASTICA",
  "ASSISTENTE AMMINISTRATIVO",
  "ASSISTENTE AMMINISTRATIVA",
  "ASSISTENTE TECNICO",
  "ASSISTENTE TECNICA",
  "OPERATORE SCOLASTICO",
  "OPERATRICE SCOLASTICA",
  "PRIMA FASCIA",
  "SECONDA FASCIA",
  "TERZA FASCIA",
  "FASCIA GRADUATORIA",
  "GRADUATORIA ISTITUTO",
  "GRADUATORIA PROVINCIALE",
  "POSTO COMUNE",
  "POSTO SOSTEGNO",
  "TEMPO DETERMINATO",
  "TEMPO INDETERMINATO",
  "SCUOLA PRIMARIA",
  "SCUOLA SECONDARIA",
  "SCUOLA INFANZIA",
  "DOCENTE SCUOLA",
  "PERSONALE ATA",
  "PERSONALE DOCENTE",
  "DECRETO PUBBLICAZIONE",
  "CODICE MECCANOGRAFICO",
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeAccentInsensitivePattern(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map(c => {
      const lower = c.toLowerCase();
      switch (lower) {
        case "a": return "[aàáâäãåAÀÁÂÄÃÅ]";
        case "e": return "[eèéêëEÈÉÊË]";
        case "i": return "[iìíîïIÌÍÎÏ]";
        case "o": return "[oòóôöõOÒÓÔÖÕ]";
        case "u": return "[uùúûüUÙÚÛÜ]";
        case "c": return "[cçCÇ]";
        default: return escapeRegExp(c);
      }
    })
    .join("");
}

function isSameCandidateWords(foundText: string, candidateWords: string[]): boolean {
  const foundWords = foundText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/);
  const candWords = candidateWords.map(w =>
    w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  );
  if (foundWords.length === candWords.length) {
    return candWords.every(cw => foundWords.includes(cw));
  }
  return false;
}

/**
 * Estrae un punteggio mediante analisi euristica e regex dal testo di un atto o contratto.
 * TASK 6-bis/6:
 * - La finestra parte dalla FINE del nominativo e arriva a max 120 caratteri o a fine riga
 *   (usa le righe originali del testo, non il testo appiattito) — mai prima del nome.
 * - Se nella finestra compare un altro nominativo (2 parole maiuscole consecutive), tronca lì.
 * - Le soglie ("fino a punteggio 12", "fino a punti 11") NON vanno in punteggio: lasciano punteggio=null
 *   e finiscono in note_cross_reference come "Soglia convocazione: N".
 */
export function extractPunteggioHeuristic(
  text: string,
  context?: { profilo?: string; cdc?: string; nominativo?: string }
): HeuristicScoreResult {
  if (!text || typeof text !== 'string') {
    return { punteggio: null, sogliaConvocazione: null };
  }

  // Rileva eventuale soglia di convocazione presente nel documento (es. "fino a punteggio 12", "fino a punti 11")
  const thResult = findThresholdInText(text);
  const sogliaConvocazione = thResult.soglia;
  const sogliaPhrase = thResult.sourcePhrase;

  // L'euristica vale SOLO con nominativo specificato e trovato nel testo (nessun fallback su tutto il testo)
  const nom = context?.nominativo?.trim();
  if (!nom || nom.length < 3) {
    return { punteggio: null, sogliaConvocazione, sogliaPhrase };
  }

  const cleanNom = nom.replace(/[,.]/g, ' ').trim();
  const words = cleanNom.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return { punteggio: null, sogliaConvocazione, sogliaPhrase };
  }

  // Costruisci la regex per identificare il nominativo nel testo originale
  let nameRegexStr: string;
  if (words.length === 2) {
    const w0 = makeAccentInsensitivePattern(words[0]);
    const w1 = makeAccentInsensitivePattern(words[1]);
    nameRegexStr = `\\b(?:${w0}\\s+${w1}|${w1}\\s+${w0})\\b`;
  } else {
    nameRegexStr = `\\b${words.map(w => makeAccentInsensitivePattern(w)).join("\\s+")}\\b`;
  }

  // TASK 6-bis/6: Usa le righe originali del testo (non il testo appiattito)
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const nameRegex = new RegExp(nameRegexStr, "gi");
    let match: RegExpExecArray | null;

    while ((match = nameRegex.exec(line)) !== null) {
      // La finestra deve partire dalla FINE del nominativo — mai prima del nome
      const windowStart = match.index + match[0].length;
      // Arriva a max 120 caratteri o a fine riga (della riga originale)
      let windowSnippet = line.slice(windowStart, windowStart + 120);

      // Se nella finestra compare un altro nominativo (2 parole maiuscole consecutive), tronca lì
      const anotherNameRegex = /\b([A-ZÀ-ÖØ-Þ]{2,}(?:'[A-ZÀ-ÖØ-Þ]+)?\s+[A-ZÀ-ÖØ-Þ]{2,})\b/g;
      let anotherMatch: RegExpExecArray | null;

      while ((anotherMatch = anotherNameRegex.exec(windowSnippet)) !== null) {
        const candidateFound = anotherMatch[1].replace(/\s+/g, ' ').toUpperCase();
        if (EXCLUDED_UPPERCASE_PAIRS.has(candidateFound)) {
          continue;
        }
        if (isSameCandidateWords(candidateFound, words)) {
          continue;
        }
        // È un altro nominativo: tronca la finestra prima di questo nominativo
        windowSnippet = windowSnippet.slice(0, anotherMatch.index);
        break;
      }

      const scoreMatch = findCandidateScoreInSnippet(windowSnippet);
      if (scoreMatch.punteggio !== null) {
        return {
          punteggio: scoreMatch.punteggio,
          sourcePhrase: scoreMatch.sourcePhrase,
          sogliaConvocazione,
          sogliaPhrase,
        };
      }
    }
  }

  // Nessun punteggio reale trovato nella finestra del nominativo -> punteggio = null
  return { punteggio: null, sogliaConvocazione, sogliaPhrase };
}

/**
 * Cerca il punteggio attribuito al candidato all'interno dello snippet.
 * Maschera preventivamente eventuali soglie di convocazione ("fino a punteggio 12", "fino a punti 11")
 * in modo che non vengano erroneamente considerate come punteggio del candidato.
 */
function findCandidateScoreInSnippet(snippet: string): { punteggio: number | null; sourcePhrase?: string } {
  // Maschera le formule di soglia di convocazione
  const maskedSnippet = snippet.replace(new RegExp(THRESHOLD_CONVOCAZIONE_REGEX.source, 'gi'), ' ');

  // Pattern 1: "con punti 45,50", "avente punteggio 32.00", "in virtù di punti X"
  const conPuntiRegex = /(?:con|avente|in virtù di|riportando)\s+(?:punti|punteggio)\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match1 = maskedSnippet.match(conPuntiRegex);
  if (match1 && match1[1]) {
    const val = parsePunteggioValue(match1[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match1[0] };
    }
  }

  // Pattern 2: Posizione con punti es: "pos. 12 - punti 54.00" o "posto 4 pt 23"
  const posPointsRegex = /\b(?:pos(?:izione)?\.?|posto|n\.)\s*\d{1,4}\s*(?:[-–—/,]|con)?\s*(?:punti|pt\.?|punteggio)\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match2 = maskedSnippet.match(posPointsRegex);
  if (match2 && match2[1]) {
    const val = parsePunteggioValue(match2[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match2[0] };
    }
  }

  // Pattern 3: Punteggio esplicito: "punti 13,17", "punti: 14", "pt 25.5", "punteggio: 89,00", "valutazione: 28,00"
  const explicitRegex = /\b(?:punteggio|punti|pt\.?|p\.ti|valutazione)\s*(?:complessivo|totale|di)?\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match3 = maskedSnippet.match(explicitRegex);
  if (match3 && match3[1]) {
    const val = parsePunteggioValue(match3[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match3[0] };
    }
  }

  return { punteggio: null };
}

/**
 * Converte e valida una stringa di punteggio
 * Evita anni solari (es. 2024, 2025, 2026), numeri di leggi, ore, percentuali errate.
 */
export function parsePunteggioValue(valStr: string): number | null {
  if (!valStr) return null;
  const clean = valStr.trim().replace(',', '.');
  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  // Filtra numeri fuori dal range realistico di punteggi scolastici (0 < punteggio <= 500)
  // ed esclude esplicitamente anni solari (2020-2035)
  if (num <= 0 || num > 500) return null;
  if (num >= 2020 && num <= 2035) return null;

  return Number(num.toFixed(2));
}
