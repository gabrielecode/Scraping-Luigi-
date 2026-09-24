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
  lookupPunteggioGraduatoria,
  resolveFromGraduatorie,
  GraduatoriaCollectedEntry,
  filterSchoolDocument
} from "../src/services/graduatorieService";
import { extractPunteggioHeuristic } from "../src/services/pdfService";
import { GraduatoriaIstituto, ExtractionData } from "../src/types";

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

async function runTests() {
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

  // TASK 1-bis/1: 2 graduatorie stessa scuola/profilo, fasce 2 e 3, pos. 5
  const mockGraduatorieFasceMulti: GraduatoriaIstituto[] = [
    {
      id: "grad-fascia-2",
      codice_meccanografico: "MIRC010008",
      nome_istituto: "IIS Severi Correnti Milano",
      tipologia_personale: "DOCENTE",
      profilo_o_cdc: "A-22",
      fascia: "2",
      graduatoria: [
        { posizione: 5, punteggio: 48.00, cognome_nome: "Galli Roberto" },
      ],
    },
    {
      id: "grad-fascia-3",
      codice_meccanografico: "MIRC010008",
      nome_istituto: "IIS Severi Correnti Milano",
      tipologia_personale: "DOCENTE",
      profilo_o_cdc: "A-22",
      fascia: "3",
      graduatoria: [
        { posizione: 5, punteggio: 65.50, cognome_nome: "Galli Roberto" },
      ],
    },
  ];

  // 3.9 Se fascia non è nei criteri e più graduatorie candidate hanno la posizione con punteggi diversi → return null (mai la prima)
  const resNoFasciaPos5 = lookupPunteggioGraduatoria(mockGraduatorieFasceMulti, {
    codice_meccanografico: "MIRC010008",
    tipologia_personale: "DOCENTE",
    profilo_o_cdc: "A-22",
    posizione: 5,
  });
  assert(
    resNoFasciaPos5 === null,
    '3.9 2 graduatorie stessa scuola/profilo, fasce 2 e 3, pos. 5 senza fascia -> null',
    resNoFasciaPos5
  );

  // 3.10 Con fascia "3" specificata nei criteri → punteggio di fascia 3 (65.50 pt)
  const resFascia3Pos5 = lookupPunteggioGraduatoria(mockGraduatorieFasceMulti, {
    codice_meccanografico: "MIRC010008",
    tipologia_personale: "DOCENTE",
    profilo_o_cdc: "A-22",
    fascia: "3",
    posizione: 5,
  });
  assert(
    resFascia3Pos5 !== null && resFascia3Pos5.punteggio === 65.50,
    '3.10 Con fascia "3" -> punteggio di fascia 3 (65.50 pt)',
    resFascia3Pos5
  );

  // 3.11 Stesso test per nominativo: senza fascia nei criteri con punteggi discordanti -> null, con fascia -> punteggio
  const resNoFasciaNom = lookupPunteggioGraduatoria(mockGraduatorieFasceMulti, {
    codice_meccanografico: "MIRC010008",
    tipologia_personale: "DOCENTE",
    profilo_o_cdc: "A-22",
    nominativo: "Galli Roberto",
  });
  assert(
    resNoFasciaNom === null,
    '3.11 2 graduatorie stessa scuola/profilo, fasce 2 e 3, per nominativo senza fascia -> null',
    resNoFasciaNom
  );

  const resFascia2Nom = lookupPunteggioGraduatoria(mockGraduatorieFasceMulti, {
    codice_meccanografico: "MIRC010008",
    tipologia_personale: "DOCENTE",
    profilo_o_cdc: "A-22",
    fascia: "2",
    nominativo: "Galli Roberto",
  });
  assert(
    resFascia2Nom !== null && resFascia2Nom.punteggio === 48.00,
    '3.12 Con fascia "2" -> punteggio di fascia 2 per nominativo (48.00 pt)',
    resFascia2Nom
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 4: resolveFromGraduatorie");
  console.log("==========================================");

  // 4.1 Più nomine: risoluzione indipendente e corretta di ciascuna nomina (vietato mescolare nome e classe)
  const mockDataMulti: ExtractionData = {
    nome_istituto: "IC Manzoni Milano",
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni Milano",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Rossi Mario",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "",
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc1",
      },
      {
        nome_istituto: "IC Manzoni Milano",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Bianchi Luigi",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Assistente Amministrativo",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "",
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc2",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedMulti: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Rossi Mario",
      punteggio: 45.20,
      posizione: 1,
      fascia: "1",
      classe: "CS",
      url: "http://example.com/grad_cs.html",
      tipologia: "ATA",
    },
    {
      nominativo: "Bianchi Luigi",
      punteggio: 62.00,
      posizione: 4,
      fascia: "2",
      classe: "AA",
      url: "http://example.com/grad_aa.html",
      tipologia: "ATA",
    },
  ];

  const resMulti = await resolveFromGraduatorie(mockDataMulti, {
    collectedEntries: mockCollectedMulti,
  });

  const n1 = resMulti.nomine_contratti![0];
  const n2 = resMulti.nomine_contratti![1];

  assert(
    n1.punteggio === 45.20 &&
    n1.posizione_graduatoria === "1" &&
    (n1.fascia === "Prima fascia" || n1.fascia === "1") &&
    n1.origine_punteggio === "Incrociato",
    "4.1 Più nomine: Nomina 1 (Rossi Mario, CS) risolta correttamente con punteggio 45.2, pos. 1, fascia 'Prima fascia'",
    n1
  );

  assert(
    n2.punteggio === 62.00 &&
    n2.posizione_graduatoria === "4" &&
    (n2.fascia === "Seconda fascia" || n2.fascia === "2") &&
    n2.origine_punteggio === "Incrociato",
    "4.1 Più nomine: Nomina 2 (Bianchi Luigi, AA) risolta correttamente con punteggio 62.0, pos. 4, fascia 'Seconda fascia'",
    n2
  );

  // 4.2 Fascia del contratto preservata: se il contratto ha già fascia valida ("2"), NON toccarla e considera solo entries di fascia "2"
  const mockDataPreserve: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "Liceo Parini Milano",
        codice_meccanografico: "MIPC01000C",
        nominativo: "Verdi Giuseppe",
        tipologia_personale: "DOCENTE",
        profilo_lavorativo: "Docente",
        classe_concorso_area_lab: "A-22",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "2", // Fascia 2 già nota dal contratto
        ore_settimanali: "18",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc3",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedPreserve: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Verdi Giuseppe",
      punteggio: 30.00,
      posizione: 12,
      fascia: "1", // Entry fascia 1 deve essere ignorata
      classe: "A-22",
      url: "http://example.com/grad_f1.pdf",
      tipologia: "DOCENTE",
    },
    {
      nominativo: "Verdi Giuseppe",
      punteggio: 85.50,
      posizione: 2,
      fascia: "2", // Entry fascia 2 deve essere selezionata
      classe: "A-22",
      url: "http://example.com/grad_f2.pdf",
      tipologia: "DOCENTE",
    },
  ];

  const resPreserve = await resolveFromGraduatorie(mockDataPreserve, {
    collectedEntries: mockCollectedPreserve,
  });
  const nPreserve = resPreserve.nomine_contratti![0];

  assert(
    nPreserve.fascia === "2" &&
    nPreserve.punteggio === 85.50 &&
    nPreserve.posizione_graduatoria === "2",
    "4.2 Fascia del contratto preservata: fascia '2' mantenuta e abbinata alla sola entry di fascia 2 (85.50 pt, pos. 2)",
    nPreserve
  );

  // 4.3 Ambiguità: più match con fasce diverse ("1" e "2") e fascia contratto assente → fascia e punteggio "Da verificare manualmente"
  const mockDataAmbiguity: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Test",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Neri Franco",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "", // Nessuna fascia nel contratto
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc4",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedAmbiguity: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Neri Franco",
      punteggio: 40.00,
      posizione: 5,
      fascia: "1",
      classe: "CS",
      url: "http://example.com/grad_f1.pdf",
      tipologia: "ATA",
    },
    {
      nominativo: "Neri Franco",
      punteggio: 55.00,
      posizione: 1,
      fascia: "2",
      classe: "CS",
      url: "http://example.com/grad_f2.pdf",
      tipologia: "ATA",
    },
  ];

  const resAmbiguity = await resolveFromGraduatorie(mockDataAmbiguity, {
    collectedEntries: mockCollectedAmbiguity,
  });
  const nAmbiguity = resAmbiguity.nomine_contratti![0];

  assert(
    nAmbiguity.fascia === "Da verificare manualmente" &&
    nAmbiguity.punteggio === "Da verificare manualmente" &&
    nAmbiguity.origine_punteggio === "Non disponibile",
    "4.3 Ambiguità: fascia e punteggio segnati come 'Da verificare manualmente'",
    nAmbiguity
  );

  // 4.4 Nessun match: candidato assente dalla graduatoria → "Da verificare manualmente" solo sui campi ancora mancanti
  const mockDataNoMatch: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Test",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Sconosciuto Antonio",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1", // Fascia già nota, non deve diventare "Da verificare manualmente"
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc5",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedNoMatch: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Altro Candidato",
      punteggio: 70.00,
      posizione: 1,
      fascia: "1",
      classe: "CS",
      url: "http://example.com/grad.pdf",
      tipologia: "ATA",
    },
  ];

  const resNoMatch = await resolveFromGraduatorie(mockDataNoMatch, {
    collectedEntries: mockCollectedNoMatch,
  });
  const nNoMatch = resNoMatch.nomine_contratti![0];

  assert(
    nNoMatch.fascia === "1" &&
    nNoMatch.punteggio === "Da verificare manualmente" &&
    (nNoMatch.posizione_graduatoria === "Non disponibile" || nNoMatch.posizione_graduatoria === "Da verificare manualmente") &&
    nNoMatch.origine_punteggio === "Non disponibile",
    "4.4 Nessun match: fascia '1' preservata, punteggio mancante 'Da verificare manualmente', posizione 'Non disponibile'",
    nNoMatch
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 5: TASK 5-bis");
  console.log("==========================================");

  // 5.1 Riga senza classe → nessun match
  const mockDataNoClass: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Rossi Mario",
        tipologia_personale: "DOCENTE",
        profilo_lavorativo: "Docente",
        classe_concorso_area_lab: "A-22",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "18",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedEmptyClass: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Rossi Mario",
      punteggio: 85.00,
      posizione: 1,
      fascia: "1",
      classe: "", // Riga senza classe
      url: "http://example.com/grad_noclass.pdf",
      tipologia: "DOCENTE",
    },
  ];

  const resEmptyClass = await resolveFromGraduatorie(mockDataNoClass, {
    collectedEntries: mockCollectedEmptyClass,
  });
  const nEmptyClass = resEmptyClass.nomine_contratti![0];

  assert(
    nEmptyClass.punteggio === "Da verificare manualmente" &&
    nEmptyClass.origine_punteggio === "Non disponibile",
    "5.1 Riga senza classe → nessun match (esclusa dal match per solo nome)",
    nEmptyClass
  );

  // 5.2 2 punteggi stessa fascia senza anno → verifica manuale con nota punteggi discordanti
  const mockDataSameFasciaNoAnno: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Bianchi Anna",
        tipologia_personale: "DOCENTE",
        profilo_lavorativo: "Docente",
        classe_concorso_area_lab: "A-22",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "18",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedSameFasciaNoAnno: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Bianchi Anna",
      punteggio: 80.00,
      posizione: 2,
      fascia: "1",
      classe: "A-22",
      anno: null,
      url: "http://example.com/grad_1.pdf",
      tipologia: "DOCENTE",
    },
    {
      nominativo: "Bianchi Anna",
      punteggio: 95.00,
      posizione: 1,
      fascia: "1",
      classe: "A-22",
      anno: null,
      url: "http://example.com/grad_2.pdf",
      tipologia: "DOCENTE",
    },
  ];

  const resSameFasciaNoAnno = await resolveFromGraduatorie(mockDataSameFasciaNoAnno, {
    collectedEntries: mockCollectedSameFasciaNoAnno,
  });
  const nSameFasciaNoAnno = resSameFasciaNoAnno.nomine_contratti![0];

  assert(
    nSameFasciaNoAnno.punteggio === "Da verificare manualmente" &&
    !!nSameFasciaNoAnno.note_cross_reference?.includes("punteggi discordanti tra graduatorie"),
    "5.2 2 punteggi stessa fascia senza anno → verifica manuale con nota punteggi discordanti tra graduatorie",
    nSameFasciaNoAnno
  );

  // 5.3 Con anni diversi → vince il più recente
  const mockDataDiffAnno: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Verdi Marco",
        tipologia_personale: "DOCENTE",
        profilo_lavorativo: "Docente",
        classe_concorso_area_lab: "A-22",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "18",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedDiffAnno: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Verdi Marco",
      punteggio: 80.00,
      posizione: 5,
      fascia: "1",
      classe: "A-22",
      anno: "2022/2023",
      url: "http://example.com/grad_old.pdf",
      tipologia: "DOCENTE",
    },
    {
      nominativo: "Verdi Marco",
      punteggio: 95.00,
      posizione: 1,
      fascia: "1",
      classe: "A-22",
      anno: "2023/2024",
      url: "http://example.com/grad_new.pdf",
      tipologia: "DOCENTE",
    },
  ];

  const resDiffAnno = await resolveFromGraduatorie(mockDataDiffAnno, {
    collectedEntries: mockCollectedDiffAnno,
  });
  const nDiffAnno = resDiffAnno.nomine_contratti![0];

  assert(
    nDiffAnno.punteggio === 95.00 &&
    nDiffAnno.posizione_graduatoria === "1" &&
    nDiffAnno.origine_punteggio === "Incrociato",
    "5.3 Con anni diversi → vince il più recente (95.00 pt)",
    nDiffAnno
  );

  // 5.4 Fascia contratto + entry senza fascia → punteggio trovato
  const mockDataFasciaNullEntry: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Ferrari Luca",
        tipologia_personale: "DOCENTE",
        profilo_lavorativo: "Docente",
        classe_concorso_area_lab: "A-22",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "2", // Contratto ha fascia 2
        ore_settimanali: "18",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedFasciaNullEntry: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Ferrari Luca",
      punteggio: 50.00,
      posizione: 10,
      fascia: "1", // Fascia diversa (1 !== 2) -> deve essere scartata
      classe: "A-22",
      url: "http://example.com/grad_f1.pdf",
      tipologia: "DOCENTE",
    },
    {
      nominativo: "Ferrari Luca",
      punteggio: 72.50,
      posizione: 3,
      fascia: null, // Senza fascia -> NON viene scartata (non contraddice)
      classe: "A-22",
      url: "http://example.com/grad_nofascia.pdf",
      tipologia: "DOCENTE",
    },
  ];

  const resFasciaNullEntry = await resolveFromGraduatorie(mockDataFasciaNullEntry, {
    collectedEntries: mockCollectedFasciaNullEntry,
  });
  const nFasciaNullEntry = resFasciaNullEntry.nomine_contratti![0];

  assert(
    nFasciaNullEntry.punteggio === 72.50 &&
    nFasciaNullEntry.fascia === "2" &&
    nFasciaNullEntry.posizione_graduatoria === "3" &&
    nFasciaNullEntry.origine_punteggio === "Incrociato" &&
    !!nFasciaNullEntry.note_cross_reference?.includes("fascia graduatoria non indicata"),
    "5.4 Fascia contratto + entry senza fascia → punteggio trovato (72.50 pt) con nota 'fascia graduatoria non indicata'",
    nFasciaNullEntry
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 6: TASK 5-ter");
  console.log("==========================================");

  // 6.1 Trigger: la posizione mancante da sola NON avvia la ricerca
  const mockDataOnlyPosMissing: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Test",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Test Posizione",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: 50.00, // punteggio presente
        posizione_graduatoria: "Non disponibile", // solo posizione mancante
        fascia: "Prima fascia", // fascia presente
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const resOnlyPos = await resolveFromGraduatorie(mockDataOnlyPosMissing, {
    // anche se passassimo opzioni o esplorazione, non dovrebbe triggerare
  });
  const nOnlyPos = resOnlyPos.nomine_contratti![0];
  assert(
    nOnlyPos.punteggio === 50.00 && nOnlyPos.posizione_graduatoria === "Non disponibile",
    "6.1 Trigger: sola posizione mancante non avvia la ricerca (posizione rimane 'Non disponibile')",
    nOnlyPos
  );

  // 6.2 note_cross_reference: elenca solo i campi effettivamente compilati (se punteggio esplicito, non scrivere 'Punteggio incrociato')
  const mockDataExplicitScore: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Test",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Esplicito Mario",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: 40.00, // punteggio già esplicito
        posizione_graduatoria: "Non disponibile", // mancante
        fascia: "", // mancante -> avvia la ricerca
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedExplicit: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Esplicito Mario",
      punteggio: 40.00,
      posizione: 5,
      fascia: "1",
      classe: "CS",
      url: "http://example.com/grad_exp.html",
      tipologia: "ATA",
    },
  ];

  const resExplicit = await resolveFromGraduatorie(mockDataExplicitScore, {
    collectedEntries: mockCollectedExplicit,
  });
  const nExp = resExplicit.nomine_contratti![0];
  assert(
    nExp.punteggio === 40.00 &&
    nExp.posizione_graduatoria === "5" &&
    nExp.fascia === "Prima fascia" &&
    !nExp.note_cross_reference?.includes("Punteggio incrociato") &&
    !!nExp.note_cross_reference?.includes("posizione (pos. 5) e fascia da graduatoria"),
    "6.2 note_cross_reference elenca solo i campi compilati (posizione e fascia) senza 'Punteggio incrociato' quando il punteggio era già presente",
    nExp
  );

  // 6.3 Fascia ricavata da graduatoria con etichetta estesa del contratto ("Prima fascia", "Seconda fascia", etc.)
  assert(
    nExp.fascia === "Prima fascia",
    "6.3 Fascia ricavata con etichetta estesa del contratto ('Prima fascia')",
    nExp.fascia
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 7: TASK 5-quater");
  console.log("==========================================");

  // 7.1 Ramo "punteggi discordanti": posizione_graduatoria = "Non disponibile" (solo punteggio "Da verificare manualmente")
  const mockDataDiscordanti: ExtractionData = {
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Galli Roberto",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const mockCollectedDiscordanti: GraduatoriaCollectedEntry[] = [
    {
      nominativo: "Galli Roberto",
      punteggio: 42.00,
      posizione: 3,
      fascia: "1",
      classe: "CS",
      anno: null,
      url: "http://example.com/grad_1.pdf",
      tipologia: "ATA",
    },
    {
      nominativo: "Galli Roberto",
      punteggio: 56.50,
      posizione: 1,
      fascia: "1",
      classe: "CS",
      anno: null,
      url: "http://example.com/grad_2.pdf",
      tipologia: "ATA",
    },
  ];

  const resDiscordanti = await resolveFromGraduatorie(mockDataDiscordanti, {
    collectedEntries: mockCollectedDiscordanti,
  });
  const nDiscordanti = resDiscordanti.nomine_contratti![0];

  assert(
    nDiscordanti.punteggio === "Da verificare manualmente" &&
    nDiscordanti.posizione_graduatoria === "Non disponibile" &&
    nDiscordanti.origine_punteggio === "Non disponibile",
    "7.1 Ramo punteggi discordanti: posizione_graduatoria = 'Non disponibile' e solo punteggio 'Da verificare manualmente'",
    nDiscordanti
  );

  // 7.2 Stesso nome in CS (pagina 1) e AA (pagina 2), contratto AA:
  // la ricerca legge anche pagina 2 e restituisce il punteggio AA
  const pagesReadAA: string[] = [];
  const mockPagesExplored: Array<{
    url: string;
    title: string;
    keywordMatched: string;
    content: string;
    format: "html";
    pdfLinks: string[];
  }> = [
    {
      url: "http://scuola.edu.it/graduatorie-cs",
      title: "Graduatoria d'Istituto ATA CS Collaboratore Scolastico",
      keywordMatched: "graduatoria/e",
      content: "GRADUATORIA D'ISTITUTO ATA PROFILO CS COLLABORATORE SCOLASTICO ANNO 2024/2025\n1 45.00 ROSSI MARIO",
      format: "html",
      pdfLinks: [],
    },
    {
      url: "http://scuola.edu.it/graduatorie-aa",
      title: "Graduatoria d'Istituto ATA AA Assistente Amministrativo",
      keywordMatched: "graduatoria/e",
      content: "GRADUATORIA D'ISTITUTO ATA PROFILO AA ASSISTENTE AMMINISTRATIVO ANNO 2024/2025\n2 60.00 ROSSI MARIO",
      format: "html",
      pdfLinks: [],
    },
  ];

  const mockFetchAiMultiPage = (pagesTracker: string[]) => async (promptText: string) => {
    if (promptText.includes("CS") || promptText.includes("Collaboratore") || promptText.includes("COLLABORATORE")) {
      pagesTracker.push("page_1_CS");
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                meta: {
                  tipologia_personale: "ATA",
                  fascia: "1",
                  profilo_o_cdc: "CS",
                  anno_scolastico: "2024/2025",
                },
                graduatoria_entries: [
                  {
                    nominativo: "Rossi Mario",
                    punteggio: 45.0,
                    posizione: 1,
                    classe_concorso: "CS",
                    fascia: "1",
                  },
                ],
              }),
            },
          },
        ],
      };
    }
    if (promptText.includes("AA") || promptText.includes("Amministrativo") || promptText.includes("AMMINISTRATIVO")) {
      pagesTracker.push("page_2_AA");
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                meta: {
                  tipologia_personale: "ATA",
                  fascia: "1",
                  profilo_o_cdc: "AA",
                  anno_scolastico: "2024/2025",
                },
                graduatoria_entries: [
                  {
                    nominativo: "Rossi Mario",
                    punteggio: 60.0,
                    posizione: 2,
                    classe_concorso: "AA",
                    fascia: "1",
                  },
                ],
              }),
            },
          },
        ],
      };
    }
    return { choices: [{ message: { content: "{}" } }] };
  };

  const mockDataContrattoAA: ExtractionData = {
    nome_istituto: "IC Manzoni",
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Rossi Mario",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Assistente Amministrativo",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc_aa",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const resContrattoAA = await resolveFromGraduatorie(mockDataContrattoAA, {
    exploredPages: mockPagesExplored,
    fetchAiFn: mockFetchAiMultiPage(pagesReadAA),
  });
  const nResAA = resContrattoAA.nomine_contratti![0];

  assert(
    pagesReadAA.includes("page_1_CS") &&
    pagesReadAA.includes("page_2_AA"),
    "7.2 Contratto AA: la ricerca legge anche la pagina 2 (pagine lette: CS e AA)",
    pagesReadAA
  );

  assert(
    nResAA.punteggio === 60.00 &&
    nResAA.posizione_graduatoria === "2" &&
    nResAA.origine_punteggio === "Incrociato",
    "7.2 Contratto AA: restituisce il punteggio AA (60.00 pt, pos. 2)",
    nResAA
  );

  // 7.3 Stesso nome in CS (pagina 1) e AA (pagina 2), contratto CS:
  // la ricerca si ferma alla pagina 1
  const pagesReadCS: string[] = [];

  const mockDataContrattoCS: ExtractionData = {
    nome_istituto: "IC Manzoni",
    nomine_contratti: [
      {
        nome_istituto: "IC Manzoni",
        codice_meccanografico: "MIIC81000A",
        nominativo: "Rossi Mario",
        tipologia_personale: "ATA",
        profilo_lavorativo: "Collaboratore Scolastico",
        classe_concorso_area_lab: "Non applicabile",
        tipo_posto: "comune",
        punteggio: null,
        posizione_graduatoria: "Non disponibile",
        fascia: "1",
        ore_settimanali: "36",
        decorrenza_contratto: "01/09/2024",
        durata_contratto_mesi: "10",
        durata_contratto_giorni: "0",
        link_del_documento: "http://example.com/doc_cs",
      },
    ],
    convocazioni_collaboratore_scolastico: 0,
    convocazioni_assistente_amministrativo: 0,
    convocazioni_docenti: 0,
    convocazioni_assistente_tecnico: 0,
    convocazioni_cuoco: 0,
    convocazioni_assistente_agrario: 0,
    pensionamenti_collaboratore_scolastico: 0,
    pensionamenti_assistente_amministrativo: 0,
    pensionamenti_docenti: 0,
    pensionamenti_assistente_tecnico: 0,
    pensionamenti_cuoco: 0,
    pensionamenti_assistente_agrario: 0,
  };

  const resContrattoCS = await resolveFromGraduatorie(mockDataContrattoCS, {
    exploredPages: mockPagesExplored,
    fetchAiFn: mockFetchAiMultiPage(pagesReadCS),
  });
  const nResCS = resContrattoCS.nomine_contratti![0];

  assert(
    pagesReadCS.includes("page_1_CS") &&
    !pagesReadCS.includes("page_2_AA"),
    "7.3 Contratto CS: si ferma alla pagina 1 (pagina 2 AA non viene letta)",
    pagesReadCS
  );

  assert(
    nResCS.punteggio === 45.00 &&
    nResCS.posizione_graduatoria === "1" &&
    nResCS.origine_punteggio === "Incrociato",
    "7.3 Contratto CS: restituisce il punteggio CS (45.00 pt, pos. 1)",
    nResCS
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 8: TASK 6-bis/6 (extractPunteggioHeuristic)");
  console.log("==========================================");

  // Test: "BIANCHI LUCA punti 40,50. ROSSI MARIO punti 54,00. VERDI ANNA punti 33,00" → Rossi = 54; Bianchi = 40.5
  const multiCandidateText = "BIANCHI LUCA punti 40,50. ROSSI MARIO punti 54,00. VERDI ANNA punti 33,00";

  const resRossi = extractPunteggioHeuristic(multiCandidateText, {
    nominativo: "Rossi Mario",
  });
  assert(
    resRossi.punteggio === 54,
    '8.1 extractPunteggioHeuristic: Rossi = 54',
    resRossi
  );

  const resBianchi = extractPunteggioHeuristic(multiCandidateText, {
    nominativo: "Bianchi Luca",
  });
  assert(
    resBianchi.punteggio === 40.5,
    '8.2 extractPunteggioHeuristic: Bianchi = 40.5',
    resBianchi
  );

  const resVerdi = extractPunteggioHeuristic(multiCandidateText, {
    nominativo: "Verdi Anna",
  });
  assert(
    resVerdi.punteggio === 33,
    '8.3 extractPunteggioHeuristic: Verdi = 33',
    resVerdi
  );

  console.log("\n==========================================");
  console.log(" 🧪 TEST 9: filterSchoolDocument (Criteri bandi e nomine scolastiche)");
  console.log("==========================================");

  // 9.1 Valido: positivo ("convocazione") + frase esatta ("contratto di supplenza") senza negativi
  const testValid1 = filterSchoolDocument("Convocazione urgente per stipula contratto di supplenza annuale docente");
  assert(testValid1.included === true, '9.1 Valido: convocazione + contratto di supplenza', testValid1);

  // 9.2 Valido: positivo ("interpello") + frase esatta ("decreto di individuazione tramite interpello")
  const testValid2 = filterSchoolDocument("Decreto di individuazione tramite interpello per docenti classe di concorso A-22");
  assert(testValid2.included === true, '9.2 Valido: interpello + decreto di individuazione tramite interpello', testValid2);

  // 9.3 Scartato per assenza frase esatta obbligatoria
  const testInvalidNoExact = filterSchoolDocument("Graduatoria d'istituto pubblicata per eventuali nomine");
  assert(testInvalidNoExact.included === false, '9.3 Scartato per mancanza frase esatta obbligatoria', testInvalidNoExact);

  // 9.4 Scartato per presenza di termine negativo ("assenze" o "assemblea sindacale")
  const testNegative = filterSchoolDocument("Convocazione assemblea sindacale e contratto di supplenza");
  assert(testNegative.included === false, '9.4 Scartato per presenza termine negativo (assemblea sindacale)', testNegative);

  // 9.5 Scartato per assenza di positivo
  const testNoPositive = filterSchoolDocument("Contratto a tempo determinato stipulato");
  assert(testNoPositive.included === false, '9.5 Scartato per assenza di parola chiave positiva', testNoPositive);

  console.log("\n==========================================");
  console.log(` 🏁 RISULTATO: ${passedCount} superati, ${failedCount} falliti`);
  console.log("==========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Errore critico durante i test:", err);
  process.exit(1);
});

