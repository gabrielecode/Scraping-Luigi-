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
  maxPages = 20
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

  const regex = /<a\b[^>]*\bhref=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const rawHref = match[1];
      const rawText = match[2].replace(/<[^>]+>/g, '').trim();
      const resolvedUrl = new URL(rawHref, baseUrl).href;

      if (seenUrls.has(resolvedUrl)) continue;
      seenUrls.add(resolvedUrl);

      // Calcola punteggio di priorità basato su parole chiave
      const combined = `${resolvedUrl} ${rawText}`.toLowerCase();
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
 * Estrae un punteggio mediante analisi euristica e regex dal testo di un atto o contratto.
 * TASK 6/7:
 * - Rimosso il fallback su tutto il testo: l'euristica vale SOLO con nominativo trovato nel testo (finestra ±250 caratteri).
 * - Le soglie ("fino a punteggio 12", "fino a punti 11") NON vanno in punteggio: lasciano punteggio=null
 *   e finiscono in note_cross_reference come "Soglia convocazione: N".
 * - Se il punteggio reale del candidato manca, il TASK 5 si attiva per ricercarlo nelle graduatorie.
 */
export function extractPunteggioHeuristic(
  text: string,
  context?: { profilo?: string; cdc?: string; nominativo?: string }
): HeuristicScoreResult {
  if (!text || typeof text !== 'string') {
    return { punteggio: null, sogliaConvocazione: null };
  }

  const cleanText = text.replace(/\s+/g, ' ');

  // Rileva eventuale soglia di convocazione presente nel documento (es. "fino a punteggio 12", "fino a punti 11")
  const thResult = findThresholdInText(cleanText);
  const sogliaConvocazione = thResult.soglia;
  const sogliaPhrase = thResult.sourcePhrase;

  // L'euristica vale SOLO con nominativo specificato e trovato nel testo (nessun fallback su tutto il testo)
  const nom = context?.nominativo?.trim();
  if (!nom || nom.length < 3) {
    return { punteggio: null, sogliaConvocazione, sogliaPhrase };
  }

  // Normalizzazione caratteri/accenti per il matching del nominativo
  const normClean = cleanText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normNom = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const occurrences: { index: number; length: number }[] = [];

  let idx = normClean.indexOf(normNom);
  while (idx !== -1 && occurrences.length < 10) {
    occurrences.push({ index: idx, length: normNom.length });
    idx = normClean.indexOf(normNom, idx + 1);
  }

  // Prova anche cognome e nome invertiti se composti da 2 parole (es. "Mario Rossi" vs "Rossi Mario")
  const parts = normNom.split(/\s+/).filter(Boolean);
  if (parts.length === 2) {
    const reversed = `${parts[1]} ${parts[0]}`;
    let revIdx = normClean.indexOf(reversed);
    while (revIdx !== -1 && occurrences.length < 10) {
      if (!occurrences.some(o => Math.abs(o.index - revIdx) < 5)) {
        occurrences.push({ index: revIdx, length: reversed.length });
      }
      revIdx = normClean.indexOf(reversed, revIdx + 1);
    }
  }

  // Se il nominativo non compare nel testo, nessun fallback su tutto il testo
  if (occurrences.length === 0) {
    return { punteggio: null, sogliaConvocazione, sogliaPhrase };
  }

  // Analisi mirata sulla finestra ±250 caratteri attorno a ciascuna occorrenza del nominativo
  for (const occ of occurrences) {
    const start = Math.max(0, occ.index - 250);
    const end = Math.min(cleanText.length, occ.index + occ.length + 250);
    const windowSnippet = cleanText.slice(start, end);

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

  // Nessun punteggio reale trovato nella finestra del nominativo -> punteggio = null (nessun fallback su tutto il testo)
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
