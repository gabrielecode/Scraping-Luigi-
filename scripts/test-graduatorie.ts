/**
 * Test rapidi per le funzioni core di graduatorieService.ts:
 * 1. normalizeFascia
 * 2. isClassMatch
 * 3. lookupPunteggioGraduatoria
 *
 * Esecuzione:
 * npx tsx scripts/test-graduatorie.ts
 */

import {
  normalizeFascia,
  isClassMatch,
  lookupPunteggioGraduatoria
} from "../src/services/graduatorieService";
import { GraduatoriaIstituto } from "../src/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}`, details !== undefined ? details : "");
  }
}

console.log("\n==========================================");
console.log(" 🧪 TEST 1: normalizeFascia");
console.log("==========================================");

assert(normalizeFascia("1") === "1", 'normalizeFascia("1") === "1"');
assert(normalizeFascia("Fascia 1") === "1", 'normalizeFascia("Fascia 1") === "1"');
assert(normalizeFascia("prima fascia") === "1", 'normalizeFascia("prima fascia") === "1"');
assert(normalizeFascia("1^ fascia") === "1", 'normalizeFascia("1^ fascia") === "1"');
assert(normalizeFascia("1° fascia") === "1", 'normalizeFascia("1° fascia") === "1"');
assert(normalizeFascia("permanente 24 mesi") === "1", 'normalizeFascia("permanente 24 mesi") === "1"');
assert(normalizeFascia("Graduatoria permanente") === "1", 'normalizeFascia("Graduatoria permanente") === "1"');
assert(normalizeFascia("seconda fascia") === "2", 'normalizeFascia("seconda fascia") === "2"');
assert(normalizeFascia("2^ fascia") === "2", 'normalizeFascia("2^ fascia") === "2"');
assert(normalizeFascia("Fascia 2") === "2", 'normalizeFascia("Fascia 2") === "2"');
assert(normalizeFascia("terza fascia") === "3", 'normalizeFascia("terza fascia") === "3"');
assert(normalizeFascia("3^ fascia") === "3", 'normalizeFascia("3^ fascia") === "3"');
assert(normalizeFascia("Fascia 3") === "3", 'normalizeFascia("Fascia 3") === "3"');
assert(normalizeFascia("Graduatoria d'Istituto") === "GI", 'normalizeFascia("Graduatoria d\'Istituto") === "GI"');
assert(normalizeFascia("Interpello nazionale") === "INT", 'normalizeFascia("Interpello nazionale") === "INT"');
assert(normalizeFascia("") === "", 'normalizeFascia("") === ""');

console.log("\n==========================================");
console.log(" 🧪 TEST 2: isClassMatch");
console.log("==========================================");

assert(isClassMatch("A-22", "A22") === true, 'isClassMatch("A-22", "A22") === true');
assert(isClassMatch("A-12", "A-12") === true, 'isClassMatch("A-12", "A-12") === true');
assert(isClassMatch("A-12", "A-22") === false, 'isClassMatch("A-12", "A-22") === false');
assert(isClassMatch("ADMM", "Sostegno ADMM") === true, 'isClassMatch("ADMM", "Sostegno ADMM") === true');
assert(isClassMatch("ADMM", "ADSS") === false, 'isClassMatch("ADMM", "ADSS") === false');
assert(isClassMatch("CS", "Collaboratore Scolastico") === true, 'isClassMatch("CS", "Collaboratore Scolastico") === true');
assert(isClassMatch("AA", "Assistente Amministrativo") === true, 'isClassMatch("AA", "Assistente Amministrativo") === true');
assert(isClassMatch("AR02", "Assistente Tecnico AR02") === true, 'isClassMatch("AR02", "Assistente Tecnico AR02") === true');
assert(isClassMatch("AR01", "AR02") === false, 'isClassMatch("AR01", "AR02") === false');
assert(isClassMatch("", "A-22") === false, 'isClassMatch("", "A-22") === false');
assert(isClassMatch(undefined, "A-22") === false, 'isClassMatch(undefined, "A-22") === false');

console.log("\n==========================================");
console.log(" 🧪 TEST 3: lookupPunteggioGraduatoria");
console.log("==========================================");

const mockGraduatorie: GraduatoriaIstituto[] = [
  {
    id: "grad-doc-1",
    codice_meccanografico: "MIRC010008",
    nome_istituto: "IIS Severi Correnti Milano",
    tipologia_personale: "DOCENTE",
    profilo_o_cdc: "A-22",
    fascia: "1",
    graduatoria: [
      { posizione: 1, punteggio: 124.50, cognome_nome: "Rossi Mario" },
      { posizione: 2, punteggio: 98.00, cognome_nome: "Bianchi Luigi" },
      { posizione: 3, punteggio: 65.25, cognome_nome: "Verdi Anna" }
    ]
  },
  {
    id: "grad-ata-1",
    codice_meccanografico: "MIRC010008",
    nome_istituto: "IIS Severi Correnti Milano",
    tipologia_personale: "ATA",
    profilo_o_cdc: "CS",
    fascia: "1",
    graduatoria: [
      { posizione: 1, punteggio: 45.10, cognome_nome: "Ferrari Paolo" },
      { posizione: 2, punteggio: 38.00, cognome_nome: "Esposito Maria" }
    ]
  }
];

// 3.1 Match per posizione, scuola e CDC docente
const resPosDoc = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "MIRC010008",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  fascia: "1",
  posizione: 1
});
assert(resPosDoc !== null && resPosDoc.punteggio === 124.50, 'Lookup per posizione docente (pos. 1 -> 124.50 pt)', resPosDoc);

// 3.2 Match per nominativo (incluso nome/cognome invertito)
const resNomDoc = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "MIRC010008",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  nominativo: "Mario Rossi"
});
assert(resNomDoc !== null && resNomDoc.punteggio === 124.50, 'Lookup per nominativo docente ("Mario Rossi" -> 124.50 pt)', resNomDoc);

// 3.3 Match per nominativo cognome prima
const resNomDocRev = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "MIRC010008",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  nominativo: "Bianchi Luigi"
});
assert(resNomDocRev !== null && resNomDocRev.punteggio === 98.00, 'Lookup per nominativo cognome/nome ("Bianchi Luigi" -> 98.00 pt)', resNomDocRev);

// 3.4 Match ATA per posizione e profilo CS
const resAtaPos = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "MIRC010008",
  tipologia_personale: "ATA",
  profilo_o_cdc: "Collaboratore Scolastico",
  posizione: 2
});
assert(resAtaPos !== null && resAtaPos.punteggio === 38.00, 'Lookup ATA posizione (pos. 2 CS -> 38.00 pt)', resAtaPos);

// 3.5 Match per solo nome istituto quando il codice meccanografico manca
const resNomeScuola = lookupPunteggioGraduatoria(mockGraduatorie, {
  nome_istituto: "IIS Severi Correnti Milano",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  posizione: 3
});
assert(resNomeScuola !== null && resNomeScuola.punteggio === 65.25, 'Lookup per solo nome scuola normalizzato (pos. 3 -> 65.25 pt)', resNomeScuola);

// 3.6 Mancata corrispondenza: codice meccanografico errato
const resWrongSchool = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "ROMA999999",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  posizione: 1
});
assert(resWrongSchool === null, 'Lookup scuola non corrispondente -> null', resWrongSchool);

// 3.7 Mancata corrispondenza: posizione inesistente nella graduatoria
const resMissingPos = lookupPunteggioGraduatoria(mockGraduatorie, {
  codice_meccanografico: "MIRC010008",
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  posizione: 99
});
assert(resMissingPos === null, 'Lookup posizione inesistente -> null', resMissingPos);

// 3.8 Mancata corrispondenza: criteri senza scuola (mai match per sola posizione)
const resNoSchool = lookupPunteggioGraduatoria(mockGraduatorie, {
  tipologia_personale: "DOCENTE",
  profilo_o_cdc: "A-22",
  posizione: 1
});
assert(resNoSchool === null, 'Lookup senza scuola -> null (vietato match per sola posizione)', resNoSchool);

console.log("\n==========================================");
console.log(` 🏁 RISULTATO: ${passedCount} superati, ${failedCount} falliti`);
console.log("==========================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
