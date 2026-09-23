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

/**
 * Estrae un punteggio mediante analisi euristica e regex avanzata dal testo di un atto o contratto.
 * Gestisce:
 * 1. Soglie di convocazione ("fino a punteggio 12", "fino a punti 11")
 * 2. Punteggi espliciti ("punti 13,17", "punteggio totale: 69,50", "pt. 42.50", "punteggio di 54,00")
 * 3. Valutazioni di merito ("valutazione: 28,00")
 * 4. Punteggio associato a un profilo specifico (AA, AT, CS, ecc.)
 */
export function extractPunteggioHeuristic(
  text: string,
  context?: { profilo?: string; cdc?: string; nominativo?: string }
): { punteggio: number | null; sourcePhrase?: string } {
  if (!text || typeof text !== 'string') {
    return { punteggio: null };
  }

  const cleanText = text.replace(/\s+/g, ' ');

  // 1. Se è specificato un profilo (es. Assistente Amministrativo, Collaboratore Scolastico),
  // cerca prima nelle vicinanze della menzione del profilo (finestra mirata successiva alla menzione)
  if (context?.profilo) {
    const profLower = context.profilo.toLowerCase();
    const candidateKeywords = [];
    if (profLower.includes('amministrativ') || profLower.includes(' aa')) candidateKeywords.push('amministrativ', ' aa ');
    if (profLower.includes('collaborator') || profLower.includes(' cs')) candidateKeywords.push('collaborator', ' cs ');
    if (profLower.includes('tecnico') || profLower.includes(' at')) candidateKeywords.push('tecnico', ' at ');
    if (profLower.includes('docent') || profLower.includes('insegnant') || profLower.includes('maestr')) candidateKeywords.push('docent', 'insegnant', 'posto comune', 'sostegno');
    if (candidateKeywords.length === 0) candidateKeywords.push(profLower.slice(0, 10));

    for (const kw of candidateKeywords) {
      const profIdx = cleanText.toLowerCase().indexOf(kw.trim());
      if (profIdx !== -1) {
        // Finestra specifica che parte dalla menzione del profilo e prosegue fino alla menzione successiva o 300 caratteri
        const windowSnippet = cleanText.slice(profIdx, Math.min(cleanText.length, profIdx + 300));
        const scopedMatch = findScoreInSnippet(windowSnippet);
        if (scopedMatch.punteggio !== null) {
          return scopedMatch;
        }
      }
    }
  }

  // 2. Se è specificato un nominativo, cerca vicino al nominativo
  if (context?.nominativo && context.nominativo.length >= 4) {
    const nomIdx = cleanText.toLowerCase().indexOf(context.nominativo.toLowerCase().trim());
    if (nomIdx !== -1) {
      const windowSnippet = cleanText.slice(Math.max(0, nomIdx - 100), Math.min(cleanText.length, nomIdx + 250));
      const scopedMatch = findScoreInSnippet(windowSnippet);
      if (scopedMatch.punteggio !== null) {
        return scopedMatch;
      }
    }
  }

  // 3. Ricerca su tutto il testo
  return findScoreInSnippet(cleanText);
}

/**
 * Cerca pattern di punteggio all'interno di uno snippet di testo
 */
function findScoreInSnippet(snippet: string): { punteggio: number | null; sourcePhrase?: string } {
  // Pattern 1: Soglie di convocazione ("fino a punteggio 12", "fino a punti 11", "da punti X a punti Y")
  const thresholdRegex = /(?:fino\s+a(?:l)?\s+)?(?:punteggio|punti|pt\.?|p\.ti)\s*(?:complessivo|totale|di)?\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match1 = snippet.match(thresholdRegex);
  if (match1 && match1[1]) {
    const val = parsePunteggioValue(match1[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match1[0] };
    }
  }

  // Pattern 2: "punti 13,17", "punti: 14", "pt 25.5", "punteggio: 89,00"
  const explicitRegex = /\b(?:punteggio|punti|pt\.?|p\.ti|valutazione)\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match2 = snippet.match(explicitRegex);
  if (match2 && match2[1]) {
    const val = parsePunteggioValue(match2[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match2[0] };
    }
  }

  // Pattern 3: "con punti 45,50" o "avente punteggio 32.00"
  const conPuntiRegex = /(?:con|avente|in virtù di|riportando)\s+(?:punti|punteggio)\s+([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match3 = snippet.match(conPuntiRegex);
  if (match3 && match3[1]) {
    const val = parsePunteggioValue(match3[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match3[0] };
    }
  }

  // Pattern 4: Posizione con punti es: "pos. 12 - punti 54.00" o "posto 4 pt 23"
  const posPointsRegex = /\b(?:pos(?:izione)?\.?|posto|n\.)\s*\d{1,4}\s*(?:[-–—/,]|con)?\s*(?:punti|pt\.?|punteggio)\s*[:=\-]?\s*([0-9]{1,3}(?:[.,][0-9]{1,3})?)\b/i;
  const match4 = snippet.match(posPointsRegex);
  if (match4 && match4[1]) {
    const val = parsePunteggioValue(match4[1]);
    if (val !== null) {
      return { punteggio: val, sourcePhrase: match4[0] };
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
