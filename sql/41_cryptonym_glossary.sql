-- 41_cryptonym_glossary.sql
--
-- Purpose:
--   Hand-curated glossary of CIA cryptonyms commonly encountered in the
--   JFK records. The site previously framed cryptonym mentions in Open
--   Questions threads as "unexplained references" without distinguishing
--   ones that have been publicly identified by Church / HSCA / ARRB
--   from ones that remain genuinely unidentified.
--
--   This table powers two surfaces:
--     1. CryptonymMention tooltips in the UI — hover any AMLASH /
--        ZRRIFLE / LIENVOY token to see the canonical meaning.
--     2. Open Questions auto-tagging in sql/42 — threads whose question
--        or summary references a declassified cryptonym in this table
--        get status='resolved' with resolution_text generated from the
--        glossary entry.
--
-- Schema:
--   cryptonym             The token as it appears in records (e.g. AMLASH).
--   meaning               Plain-language description of the operation /
--                         asset / file. Empty when the cryptonym is
--                         documented as a placeholder with no further
--                         context (rare).
--   status                'declassified' | 'partial' | 'unresolved'
--   first_public_source   Which body first publicly identified it (e.g.
--                         "Church Committee Final Report (1976)",
--                         "HSCA Report (1979)", "Lopez Report (1978)").
--   source_citation_id    Foreign key into jfk_curated.citation_registry
--                         where applicable.
--   related_entity_ids    Slugs in jfk_curated.jfk_entities that the
--                         cryptonym refers to or is associated with.
--   notes                 Optional one-line clarification.

create or replace table jfk_curated.cryptonym_glossary as
select * from unnest([
  struct<
    cryptonym             string,
    meaning               string,
    status                string,
    first_public_source   string,
    source_citation_id    string,
    related_entity_ids    array<string>,
    notes                 string
  >(
    'AMLASH',
    'CIA cryptonym for the operation to recruit a Cuban government insider to assassinate Fidel Castro.',
    'declassified',
    'Church Committee Interim Report (1975)',
    'CHURCH-INTERIM',
    ['cubela','cia'],
    'Operation ran 1961-1965. Asset designation was AMLASH-1.'
  ),
  ('AMLASH-1',
    'Rolando Cubela Secades, the Cuban Army officer recruited by CIA in the AMLASH operation.',
    'declassified', 'Church Committee Interim Report (1975)', 'CHURCH-INTERIM',
    ['cubela'], 'Met with case officer in Paris on Nov 22, 1963.'),
  ('AMWHIP',
    'CIA cryptonym for Carlos Tepedino, jeweler and intermediary who introduced Cubela to the CIA.',
    'declassified', 'Church Committee Interim Report (1975)', 'CHURCH-INTERIM',
    ['cubela'], ''),
  ('AMWORLD',
    'CIA support program for Cuban exile leader Manuel Artime and his MRR organization, post-Bay of Pigs.',
    'declassified', 'HSCA Final Report (1979)', 'HSCA-FINAL',
    ['cia'], ''),
  ('AMSPELL',
    'CIA cryptonym for Directorio Revolucionario Estudiantil (DRE), the Cuban Student Directorate.',
    'declassified', 'HSCA Final Report (1979)', 'HSCA-FINAL',
    ['cia'], 'Oswald had a New Orleans street altercation with DRE-affiliated Carlos Bringuier in August 1963.'),
  ('AMTRUNK',
    'CIA program to develop dissident contacts inside the Cuban government.',
    'declassified', 'HSCA Final Report (1979)', 'HSCA-FINAL',
    ['cia'], ''),
  ('ZRRIFLE',
    'CIA Executive Action program for the development of stand-by capability for assassinations of foreign leaders.',
    'declassified', 'Church Committee Interim Report (1975)', 'CHURCH-INTERIM',
    ['cia'], 'Chief was William Harvey; the program is documented as having been activated against Fidel Castro.'),
  ('LIENVOY',
    'CIA telephone-tap operation against the Soviet and Cuban embassies in Mexico City.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], 'Joint with Mexican DFS. Captured the Sept-Oct 1963 calls relevant to the Oswald visit.'),
  ('LIFEAT',
    'CIA microphone surveillance operation against the Soviet Embassy in Mexico City.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], 'Audio counterpart to LIENVOY.'),
  ('LIHUFF',
    'CIA photo surveillance program against Cuban Embassy and consulate vehicles in Mexico City.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], ''),
  ('LIEMPTY',
    'CIA photo surveillance operation against the Soviet Embassy in Mexico City.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], 'Static cameras across from the embassy gates.'),
  ('LIONION',
    'CIA photo surveillance operation, Mexico City station.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], ''),
  ('LIOSAGE',
    'CIA photo surveillance operation, Mexico City station.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], ''),
  ('LIERODE',
    'CIA Mexico City photo surveillance operation against the Cuban Embassy.',
    'declassified', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], ''),
  ('LICOZY',
    'CIA cryptonym for an asset / operation in the Mexico City station.',
    'partial', 'Lopez Report (1978)', 'HSCA-FINAL',
    ['cia','win-scott'], 'Some operational details remain redacted in released documents.'),
  ('LCFLUTTER',
    'CIA polygraph (lie detector) program designation.',
    'declassified', 'Church Committee Final Report (1976)', 'CHURCH-FINAL',
    ['cia'], ''),
  ('KUBARK',
    'CIA cryptonym for the Agency itself, used internally as a routing prefix.',
    'declassified', 'CIA in-house publications (1990s)', '',
    ['cia'], 'Title of the 1963 KUBARK Counterintelligence Interrogation manual.'),
  ('ODENVY',
    'CIA cryptonym for the FBI in inter-agency correspondence.',
    'declassified', 'Multiple released cables', '',
    ['fbi','cia'], ''),
  ('ODACID',
    'CIA cryptonym for the U.S. Department of State.',
    'declassified', 'Multiple released cables', '',
    ['cia'], ''),
  ('PBRUMEN',
    'CIA cryptonym for Cuba in operational cables.',
    'declassified', 'Church Committee Final Report (1976)', 'CHURCH-FINAL',
    ['cia'], ''),
  ('MHCHAOS',
    'CIA domestic mail-opening and surveillance program targeting U.S. dissidents and antiwar groups.',
    'declassified', 'Church Committee Final Report (1976)', 'CHURCH-FINAL',
    ['cia'], 'Ran 1967-1974; documented as exceeding the Agency\'s charter.'),
  ('HTLINGUAL',
    'CIA mail-opening program targeting correspondence to and from the Soviet Union.',
    'declassified', 'Church Committee Final Report (1976)', 'CHURCH-FINAL',
    ['cia','angleton'], 'Operated by the Counterintelligence Staff under James Angleton.'),
  ('GPFLOOR',
    'CIA cryptonym for Lee Harvey Oswald in some pre-assassination cables.',
    'declassified', 'HSCA Final Report (1979)', 'HSCA-FINAL',
    ['oswald','cia'], 'Use of GP-prefixed cryptonyms for individuals is irregular.'),
  ('GPIDEAL',
    'CIA cryptonym for President John F. Kennedy in some cables.',
    'declassified', 'HSCA Final Report (1979)', 'HSCA-FINAL',
    ['cia'], '')
]);
