-- 16_entity_sources.sql
--
-- Purpose:
--   Lightweight provenance for entity bios: a small, curated list of the
--   primary documents and allowlisted secondary sources that ground each
--   entity's biography + timeline. Rendered as a numbered "Sources" block
--   at the bottom of each entity page so readers can trace bio claims to
--   verifiable archival material.
--
--   This is the Phase 0 precursor to a full per-sentence citation registry
--   (Phase 1, BQ-1H). It intentionally uses hand-curated lists rather than
--   Gemini-generated citations; the full citation_registry + regeneration
--   lands with Phase 1.
--
-- Dependencies: (none — optional sidecar to jfk_curated.jfk_entities)
--
-- `kind` values:
--   - 'NARA'     — NARA finding aid or record description
--   - 'WC'       — Warren Commission Report or Hearings
--   - 'HSCA'     — HSCA Report or Volumes
--   - 'ARRB'     — ARRB Final Report or staff materials
--   - 'CHURCH'   — Church Committee Book V
--   - 'REFERENCE'— allowlisted reference source (Britannica, archives.gov)

create or replace table jfk_curated.jfk_entity_sources as
select * from unnest([
  struct<
    entity_id      string,
    sort_order     int64,
    label          string,
    url            string,
    kind           string,
    note           string
  >(
    'oswald', 1,
    'Warren Commission Report, Appendix 13: Biography of Lee Harvey Oswald',
    'https://www.archives.gov/research/jfk/warren-commission-report/appendix-13.html',
    'WC',
    'Service record, travels 1956–1963, and pre-assassination timeline.'
  ),
  ('oswald', 2,
    'HSCA Final Report (1979), Vol. I',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Re-examines Oswald biographical record with access to post-WC declassifications.'
  ),
  ('oswald', 3,
    'ARRB Final Report (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'Declassified material on Oswald 201 file and Mexico City contacts.'
  ),

  ('ruby', 1,
    'Warren Commission Report, Appendix 16: Biography of Jack Ruby',
    'https://www.archives.gov/research/jfk/warren-commission-report/appendix-16.html',
    'WC',
    'Early life, Dallas club operations, and events of November 24, 1963.'
  ),
  ('ruby', 2,
    'Ruby v. Texas, 407 S.W.2d 793 (Tex. Crim. App. 1966)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Texas Court of Criminal Appeals reversal of the 1964 conviction.'
  ),

  ('marina-oswald', 1,
    'Warren Commission Hearings, Vol. I (Marina Oswald testimony)',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    'Primary biographical source; four separate appearances before the Commission.'
  ),

  ('hoover', 1,
    'FBI Records Vault — J. Edgar Hoover Official and Confidential files',
    'https://vault.fbi.gov/hoovers-official-and-confidential-file',
    'NARA',
    'Bureau memoranda documenting Hoover\'s direction of the Dallas investigation.'
  ),
  ('hoover', 2,
    'Church Committee, Book III: Supplementary Detailed Staff Reports',
    'https://www.intelligence.senate.gov/resources/intelligence-related-commissions',
    'CHURCH',
    'Contextual record of Hoover-era FBI operations.'
  ),

  ('angleton', 1,
    'Church Committee, Book V: The Investigation of the Assassination of President John F. Kennedy',
    'https://www.intelligence.senate.gov/resources/intelligence-related-commissions',
    'CHURCH',
    'CIA counterintelligence handling of the Oswald file.'
  ),
  ('angleton', 2,
    'ARRB Final Report (1998), Chapter 6',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'CI/SIG routing and the pre-assassination Oswald cable traffic.'
  ),

  ('cia', 1,
    'NARA JFK Assassination Records Collection — CIA records',
    'https://www.archives.gov/research/jfk/cia-records',
    'NARA',
    'Finding aid for the Agency\'s JFK holdings.'
  ),
  ('cia', 2,
    'Church Committee, Book V',
    'https://www.intelligence.senate.gov/resources/intelligence-related-commissions',
    'CHURCH',
    'Comprehensive congressional review of CIA conduct around the assassination.'
  ),

  ('fbi', 1,
    'NARA JFK Assassination Records Collection — FBI records',
    'https://www.archives.gov/research/jfk/fbi-records',
    'NARA',
    'Bureau records transferred to NARA under the JFK Records Act.'
  ),
  ('fbi', 2,
    'FBI Records Vault — JFK Assassination',
    'https://vault.fbi.gov/John%20F.%20Kennedy%20Assassination%20File',
    'NARA',
    'Digitized Bureau files on Oswald, Ruby, and the Dallas investigation.'
  ),

  ('warren-commission', 1,
    'Report of the President\'s Commission on the Assassination of President Kennedy (1964)',
    'https://www.archives.gov/research/jfk/warren-commission-report',
    'WC',
    'The 888-page final report.'
  ),
  ('warren-commission', 2,
    'Warren Commission Hearings and Exhibits (26 volumes)',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    '552 witness testimonies and documentary exhibits.'
  ),

  ('hsca', 1,
    'HSCA Final Report (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'The committee\'s conclusions, including the acoustic finding.'
  ),
  ('hsca', 2,
    'National Research Council, Report of the Committee on Ballistic Acoustics (1982)',
    'https://nap.nationalacademies.org/catalog/10264/report-of-the-committee-on-ballistic-acoustics',
    'REFERENCE',
    'The NAS/Ramsey Panel review rejecting the HSCA acoustic conclusion.'
  ),
  ('hsca', 3,
    'U.S. Department of Justice letter to the Speaker of the House, March 28, 1988',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'REFERENCE',
    'DOJ declines to reopen investigation, citing the NAS findings.'
  ),

  -- Phase 2-A Wave 1 entity sources (2026-04-19)
  ('tippit', 1,
    'Warren Commission Report, Ch. 4: The Assassin',
    'https://www.archives.gov/research/jfk/warren-commission-report/chapter-4.html',
    'WC',
    'Primary account of the Tippit shooting, witness identifications, and lineup procedures.'
  ),
  ('tippit', 2,
    'Warren Commission Hearings, Vol. III — Cortlandt Cunningham (FBI) ballistics testimony',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    'FBI Laboratory ballistic comparison of the four shell cases to CE-143.'
  ),

  ('zapruder', 1,
    'Abraham Zapruder testimony, Warren Commission Hearings, Vol. VII',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    'Zapruder\'s own account of filming the motorcade on November 22, 1963.'
  ),
  ('zapruder', 2,
    'ARRB Final Report, Ch. 2 (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'Formal designation of the original film as an assassination record and acquisition record.'
  ),

  ('connally', 1,
    'John Connally testimony, Warren Commission Hearings, Vol. IV (April 21, 1964)',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    'Primary testimony on wounds and in-limousine sequence.'
  ),
  ('connally', 2,
    'HSCA Final Report, Sec. I (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'HSCA re-interview and forensic re-examination of Connally wound trajectory.'
  ),

  ('earl-warren', 1,
    'Executive Order 11130 (Nov 29, 1963)',
    'https://www.archives.gov/research/jfk/warren-commission-report',
    'REFERENCE',
    'Establishment of the Commission and appointment of Warren as chair.'
  ),
  ('earl-warren', 2,
    'Warren Commission Report, Foreword (1964)',
    'https://www.archives.gov/research/jfk/warren-commission-report',
    'WC',
    'Commission\'s own account of its formation, members, methodology.'
  ),

  ('dulles', 1,
    'Church Committee Book IV — Supplementary Staff Reports',
    'https://www.intelligence.senate.gov/resources/intelligence-related-commissions',
    'CHURCH',
    'Dulles-era CIA operations and Bay of Pigs context.'
  ),
  ('dulles', 2,
    'ARRB Final Report (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'WC membership, conflict-of-interest analysis, and declassified post-WC correspondence.'
  ),

  ('blakey', 1,
    'HSCA Final Report (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Blakey\'s direction of the Committee is recorded in the Final Report and staff list.'
  ),

  ('church-committee', 1,
    'Church Committee Final Report, Books I-VI (1976)',
    'https://www.intelligence.senate.gov/resources/intelligence-related-commissions',
    'CHURCH',
    'Full six-book Senate Select Committee final report (S. Rep. No. 94-755).'
  ),
  ('church-committee', 2,
    'Church Committee Book V: The Investigation of the Assassination of President John F. Kennedy',
    'https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-94755-v.pdf',
    'CHURCH',
    'Book V — indexed in this site as a primary-source report.'
  ),

  ('arrb', 1,
    'ARRB Final Report of the Assassination Records Review Board (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'Board\'s own final report describing its mandate, methodology, and outcomes.'
  ),
  ('arrb', 2,
    'President John F. Kennedy Assassination Records Collection Act of 1992',
    'https://www.archives.gov/research/jfk/jfk-act',
    'REFERENCE',
    'Enabling legislation (P.L. 102-526).'
  ),

  ('duran', 1,
    'HSCA Final Report, Vol. III (Lopez Report), 1978',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Lopez Report staff analysis of Oswald\'s Mexico City visit, including Duran\'s interactions.'
  ),
  ('duran', 2,
    'ARRB Final Report, Ch. 6 (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'Declassified CIA Mexico City cables on Duran\'s detention and interrogation.'
  ),

  ('phillips', 1,
    'HSCA Final Report, Vol. X (Mexico City Station) and Sec. I-C, 1978-79',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Phillips\' role at Mexico City station; Veciana "Maurice Bishop" identification and Phillips\'s denial.'
  ),
  ('phillips', 2,
    'Church Committee Book V (1976)',
    'https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-94755-v.pdf',
    'CHURCH',
    'CIA Cuban operations context in which Phillips operated.'
  ),

  ('win-scott', 1,
    'ARRB Final Report, Ch. 6 (1998)',
    'https://www.archives.gov/research/jfk/review-board/report',
    'ARRB',
    'Scott\'s 13-year tenure as Mexico City Chief of Station; LIENVOY / LIEMPTY / LIHUFF / LIONION operations.'
  ),
  ('win-scott', 2,
    'HSCA Final Report, Vol. X (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Examination of post-mortem handling of Scott\'s safe contents and manuscript.'
  ),

  -- Wave 2 (April 2026)

  ('kostikov', 1,
    'HSCA Final Report, Vol. III, pp. 565-571',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Identification of Kostikov as KGB and the Department 13 attribution.'
  ),
  ('kostikov', 2,
    'Lopez Report (1978)',
    'https://www.archives.gov/research/jfk/select-committee-report/part-2.html',
    'HSCA',
    'HSCA staff analysis of CIA Mexico City station product on the September 1963 Oswald contacts.'
  ),

  ('de-mohrenschildt', 1,
    'Warren Commission Hearings, Vol. 9 (de Mohrenschildt testimony, April 22-23, 1964)',
    'https://www.archives.gov/research/jfk/warren-commission-hearings',
    'WC',
    'Sworn testimony covering background, Oswald contact period, and travels.'
  ),
  ('de-mohrenschildt', 2,
    'HSCA Final Report (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Witness-mortality review including the March 29, 1977 death.'
  ),

  ('cubela', 1,
    'Church Committee Interim Report on Alleged Assassination Plots Involving Foreign Leaders (1975), pp. 86-89',
    'https://www.intelligence.senate.gov/sites/default/files/94465.pdf',
    'CHURCH',
    'Identification of Cubela as AMLASH-1 and the November 22, 1963 Paris meeting.'
  ),
  ('cubela', 2,
    'HSCA Final Report (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Re-examination of the AMLASH operation and the Paris meeting timing.'
  ),

  -- Wave 3 (April 2026)

  ('specter', 1,
    'Warren Commission Report, Chapter III (1964)',
    'https://www.archives.gov/research/jfk/warren-commission-report/chapter-3.html',
    'WC',
    'Chapter Specter drafted; presents the single-bullet conclusion and the motorcade shot-sequence analysis.'
  ),
  ('specter', 2,
    'HSCA Final Report, §I.B (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Acoustic and ballistic re-examination that contested portions of the single-bullet conclusion.'
  ),

  ('marcello', 1,
    'HSCA Volume IX, §III — Carlos Marcello',
    'https://history-matters.com/archive/jfk/hsca/reportvols/vol9/pdf/HSCA_Vol9_3_Marcello.pdf',
    'HSCA',
    'HSCA\'s full examination of Marcello, including the Becker allegation and the "motive, means, opportunity" finding.'
  ),
  ('marcello', 2,
    'HSCA Final Report, §I.C.2 (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Final-report language on Marcello and the Kennedy assassination.'
  ),

  ('trafficante', 1,
    'HSCA Volume V, pp. 345–416 (September 28, 1978 testimony)',
    'http://aarclibrary.org/publib/jfk/hsca/reportvols/vol5/pdf/HSCA_Vol5_0928_1_Traffican.pdf',
    'HSCA',
    'Public hearing testimony under court-ordered grant of immunity.'
  ),
  ('trafficante', 2,
    'Church Committee Interim Report (1975), pp. 74–82',
    'https://www.intelligence.senate.gov/sites/default/files/94465.pdf',
    'CHURCH',
    'CIA-Mafia Castro plots; the three-figure recruitment via Robert Maheu.'
  ),

  ('giancana', 1,
    'Church Committee Interim Report (1975), pp. 74–82',
    'https://www.intelligence.senate.gov/sites/default/files/94465.pdf',
    'CHURCH',
    'Giancana\'s role in the CIA-Mafia Castro plots, pre-murder.'
  ),
  ('giancana', 2,
    'FBI Top Hoodlum Program file (declassified, partial)',
    'https://vault.fbi.gov/Sam%20Giancana%20',
    'REFERENCE',
    'Allowlisted FBI Vault release covering the Chicago Outfit leadership period.'
  ),

  ('roselli', 1,
    'Church Committee Interim Report (1975), pp. 74–85',
    'https://www.intelligence.senate.gov/sites/default/files/94465.pdf',
    'CHURCH',
    'Roselli\'s role in the CIA-Mafia Castro plots; transcripts referenced in both 1975 testimonies.'
  ),
  ('roselli', 2,
    'New York Times, "Rosselli Called a Victim of Mafia Because of His Senate Testimony" (Feb 25, 1977)',
    'https://www.nytimes.com/1977/02/25/archives/rosselli-called-a-victim-of-mafia-because-of-his-senate-testimony.html',
    'REFERENCE',
    'Contemporary investigation identifying Trafficante as the likely source of the 1976 killing.'
  ),

  ('garrison', 1,
    'Clay Shaw Trial Transcripts (History Matters archive)',
    'https://www.history-matters.com/archive/contents/garr/contents_garr_trial.htm',
    'REFERENCE',
    'Full trial transcripts of State v. Clay Shaw (1969), the Garrison prosecution.'
  ),
  ('garrison', 2,
    'CIA "GARRISON INVESTIGATION" document (CIA FOIA)',
    'https://www.cia.gov/readingroom/docs/CIA-RDP79-00632A000100100007-2.pdf',
    'REFERENCE',
    'CIA internal file on the Garrison investigation; documents agency monitoring and counter-messaging.'
  ),

  ('clay-shaw', 1,
    'Clay Shaw Trial Transcripts (History Matters archive)',
    'https://www.history-matters.com/archive/contents/garr/contents_garr_trial.htm',
    'REFERENCE',
    'Full trial transcripts; Shaw\'s own testimony and the one-hour acquittal verdict.'
  ),
  ('clay-shaw', 2,
    'HSCA Final Report, §I.C (1979)',
    'https://www.archives.gov/research/jfk/select-committee-report',
    'HSCA',
    'Helms Congressional testimony confirming Shaw\'s Domestic Contact Service role.'
  ),

  ('goodpasture', 1,
    'ARRB Deposition of Anne Goodpasture, December 15, 1995',
    'https://aarclibrary.org/publib/jfk/arrb/cia_testimony/pdf/Goodpasture_12-15-95.pdf',
    'ARRB',
    'First ARRB deposition; Mexico City station operations and the handling of Oswald-related cable traffic.'
  ),
  ('goodpasture', 2,
    'ARRB Deposition of Anne Goodpasture, April 23, 1998',
    'http://aarclibrary.org/publib/jfk/arrb/cia_testimony/pdf/Goodpasture_4-23-98.pdf',
    'ARRB',
    'Follow-up deposition addressing gaps in the 1995 session; contains the Phillips "lazy Soviet desk officer" rebuttal.'
  ),

  ('jane-roman', 1,
    'History Matters — "What Jane Roman Said" (Newman interview)',
    'https://www.history-matters.com/essays/frameup/WhatJaneRomanSaid/WhatJaneRomanSaid_2.htm',
    'REFERENCE',
    'John M. Newman\'s 1994–95 interviews; Roman\'s own account of the October 10, 1963 cable.'
  ),
  ('jane-roman', 2,
    'ARRB records on the October 10, 1963 Mexico City cable',
    'https://www.archives.gov/research/jfk/review-board',
    'ARRB',
    'Full declassification of the cable (2002 release) and surrounding CI/Liaison routing materials.'
  )
]);
