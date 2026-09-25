/**
 * Parser CSV universale e robusto per elenchi scuole e URL.
 * Gestisce:
 * - Separatori multipli: virgola (,), punto e virgola (;), tabulazione (\t)
 * - Campi racchiusi da virgolette con separatori interni
 * - Intestazioni con nomi variabili (SITOWEB, SITO_WEB, URL, LINK, INDIRIZZO_WEB, ecc.)
 * - URL posizionati in qualsiasi colonna (non solo la prima)
 * - URL senza protocollo (es. www.scuola.edu.it o icgaribaldi.edu.it)
 * - Estrazione contestuale di codice meccanografico e denominazione scuola
 */

export interface ParsedSchoolUrlItem {
  url: string;
  nome_istituto?: string;
  codice_meccanografico?: string;
  originalRowIndex?: number;
}

/**
 * Divide una riga CSV in campi rispettando le virgolette.
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Rileva il delimitatore più probabile (',', ';', '\t')
 */
export function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const countComma = (firstLines.match(/,/g) || []).length;
  const countSemicolon = (firstLines.match(/;/g) || []).length;
  const countTab = (firstLines.match(/\t/g) || []).length;

  if (countSemicolon >= countComma && countSemicolon >= countTab && countSemicolon > 0) {
    return ';';
  }
  if (countTab > countComma && countTab > countSemicolon) {
    return '\t';
  }
  return ',';
}

/**
 * Normalizza e convalida una stringa per verificare se rappresenta un URL.
 */
export function cleanAndValidateUrl(rawVal: string): string | null {
  if (!rawVal) return null;
  let val = rawVal.replace(/^["']|["']$/g, '').trim();

  // Rimuovi spazi interni accidentali
  val = val.replace(/\s+/g, '');

  if (val.length < 4) return null;

  // Se inizia con http:// o https://
  if (/^https?:\/\//i.test(val)) {
    try {
      new URL(val);
      return val;
    } catch {
      return null;
    }
  }

  // Se inizia con www.
  if (/^www\./i.test(val)) {
    const formatted = `https://${val}`;
    try {
      new URL(formatted);
      return formatted;
    } catch {
      return null;
    }
  }

  // Se sembra un dominio scuola (es. .edu.it, .gov.it, .istruzione.it, o dominio con estensione nota)
  if (/\.(edu\.it|gov\.it|istruzione\.it|it|com|org|net)(\/|$)/i.test(val)) {
    const formatted = `https://${val}`;
    try {
      new URL(formatted);
      return formatted;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Estrae l'elenco degli URL dal testo CSV, cercando nelle colonne appropriate.
 */
export function parseSchoolUrlsFromCsv(csvText: string): ParsedSchoolUrlItem[] {
  if (!csvText || !csvText.trim()) return [];

  const rawLines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const delimiter = detectDelimiter(csvText);
  const items: ParsedSchoolUrlItem[] = [];
  const seenUrls = new Set<string>();

  let urlColIdx = -1;
  let meccColIdx = -1;
  let nomeColIdx = -1;
  let startLineIdx = 0;

  // Analizza prima riga per vedere se è un header
  const firstRowFields = splitCsvLine(rawLines[0], delimiter).map(f => f.replace(/^["']|["']$/g, '').trim());
  
  // Se la prima riga è costituita da un solo campo ed è un URL, o se contiene già un URL nella colonna, non considerarla header se non ha intestazioni tipiche
  const isFirstRowHeader = firstRowFields.some(f => {
    // Se è un URL valido, non è una parola chiave di header
    if (cleanAndValidateUrl(f) !== null) return false;
    const lower = f.toLowerCase();
    return (
      lower === 'url' ||
      lower === 'link' ||
      lower === 'sito' ||
      lower === 'sito web' ||
      lower === 'sito_web' ||
      lower === 'sitoweb' ||
      lower === 'web' ||
      lower === 'website' ||
      lower === 'indirizzo web' ||
      lower === 'indirizzo_web' ||
      lower.includes('codice') ||
      lower.includes('meccanografico') ||
      lower.includes('denominazione') ||
      lower === 'scuola' ||
      lower === 'istituto'
    );
  });

  if (isFirstRowHeader) {
    firstRowFields.forEach((f, idx) => {
      const lower = f.toLowerCase();
      if (urlColIdx === -1 && (lower.includes('url') || lower.includes('link') || lower.includes('sito') || lower.includes('web') || lower.includes('pagina'))) {
        urlColIdx = idx;
      }
      if (meccColIdx === -1 && (lower.includes('meccanografico') || lower.includes('mecc') || lower === 'codice' || lower.includes('codice_scuola'))) {
        meccColIdx = idx;
      }
      if (nomeColIdx === -1 && (lower.includes('denominazione') || lower.includes('nome_istituto') || lower.includes('nome scuola') || lower === 'scuola' || lower === 'istituto')) {
        nomeColIdx = idx;
      }
    });
    startLineIdx = 1;
  }

  for (let i = startLineIdx; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith('#') || line.startsWith('//')) continue;

    const fields = splitCsvLine(line, delimiter);
    let extractedUrl: string | null = null;
    let codiceMecc: string | undefined = undefined;
    let nomeIstituto: string | undefined = undefined;

    // Se abbiamo identificato la colonna URL dall'header
    if (urlColIdx !== -1 && urlColIdx < fields.length) {
      extractedUrl = cleanAndValidateUrl(fields[urlColIdx]);
    }

    // Se non trovato nella colonna header (o header assente), scansiona TUTTE le colonne della riga
    if (!extractedUrl) {
      for (let c = 0; c < fields.length; c++) {
        const candidate = cleanAndValidateUrl(fields[c]);
        if (candidate) {
          extractedUrl = candidate;
          break;
        }
      }
    }

    // Estrai codice meccanografico e denominazione se presenti
    if (meccColIdx !== -1 && meccColIdx < fields.length) {
      const rawMecc = fields[meccColIdx].replace(/^["']|["']$/g, '').trim().toUpperCase();
      if (/^[A-Z]{4}[0-9]{5}[A-Z0-9]$/i.test(rawMecc) || /^[A-Z]{2}[0-9]{2,}$/i.test(rawMecc)) {
        codiceMecc = rawMecc;
      }
    } else {
      // Cerca in tutte le celle un codice meccanografico
      for (const f of fields) {
        const cleanF = f.replace(/^["']|["']$/g, '').trim().toUpperCase();
        if (/^[A-Z]{4}[0-9]{5}[A-Z0-9]$/i.test(cleanF)) {
          codiceMecc = cleanF;
          break;
        }
      }
    }

    if (nomeColIdx !== -1 && nomeColIdx < fields.length) {
      const rawNome = fields[nomeColIdx].replace(/^["']|["']$/g, '').trim();
      if (rawNome.length > 2 && !rawNome.startsWith('http')) {
        nomeIstituto = rawNome;
      }
    }

    if (extractedUrl) {
      const normalizedUrl = extractedUrl.toLowerCase().replace(/\/+$/, '');
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        items.push({
          url: extractedUrl,
          codice_meccanografico: codiceMecc,
          nome_istituto: nomeIstituto,
          originalRowIndex: i + 1
        });
      }
    }
  }

  return items;
}
