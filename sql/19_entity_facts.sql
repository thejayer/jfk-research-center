-- 19_entity_facts.sql
--
-- Purpose:
--   Structured biographical facts backing each entity page. The existing
--   `jfk_curated.jfk_entities` table holds one summary/description string
--   per entity; that is fine for narrative bios but can\'t answer a
--   question like "who was Chief of CIA Counterintelligence on Nov 22,
--   1963?" without parsing prose. entity_facts normalizes those facts
--   into key-value rows with source citations and confidence tags.
--
--   Every sentence on a future footnoted bio can point back to an
--   entity_facts row. Phase 2 entity expansion (21 new entities) also
--   depends on this schema existing.
--
-- Schema notes:
--   fact_key       snake_case, e.g. \'born\', \'died\', \'role_1963\',
--                  \'arrested\', \'defected\', \'residence_1963\', \'tenure\'.
--   fact_value     Display string (dates rendered human-readably).
--   effective_date Canonical DATE when the fact applies; null for
--                  time-invariant facts like \'born_in_city\'.
--   source_type    One of: \'WC\', \'HSCA\', \'ARRB\', \'CHURCH\', \'NAID\',
--                  \'REFERENCE\'.
--   source_ref     Specific citation (NAID, \'WC-App13-p679\', URL, etc.).
--   confidence     \'High\' | \'Medium\' | \'Low\'.
--
-- Dependencies: (none — optional sidecar to jfk_curated.jfk_entities)

create or replace table jfk_curated.entity_facts as
select * from unnest([
  struct<
    entity_id      string,
    fact_key       string,
    fact_value     string,
    effective_date date,
    source_type    string,
    source_ref     string,
    confidence     string,
    sort_order     int64
  >(
    -- ============================================================
    -- OSWALD
    -- ============================================================
    'oswald', 'born', 'October 18, 1939 — New Orleans, Louisiana',
    date '1939-10-18', 'WC', 'Warren Commission Report, Appendix 13',
    'High', 1
  ),
  ('oswald', 'enlisted_marines', 'October 24, 1956 — enlisted in U.S. Marine Corps at a Dallas recruiter; reported to MCRD San Diego October 26',
    date '1956-10-24', 'WC', 'Warren Commission Report, Appendix 13', 'High', 2),
  ('oswald', 'marine_assignment', 'Radar operator at Marine Corps Air Station Atsugi, Japan',
    null, 'WC', 'Warren Commission Hearings, Vol. 19 (Service Record Book)', 'High', 3),
  ('oswald', 'defected_ussr', 'October 31, 1959 — appeared at U.S. Embassy Moscow and declared intent to renounce citizenship',
    date '1959-10-31', 'WC', 'Warren Commission Report, Appendix 13', 'High', 4),
  ('oswald', 'married', 'April 30, 1961 — married Marina Nikolaevna Prusakova in Minsk, Belorussian SSR',
    date '1961-04-30', 'WC', 'Warren Commission Hearings, Vol. 1 (Marina Oswald)', 'High', 5),
  ('oswald', 'returned_us', 'June 13, 1962 — arrived New York with Marina and infant daughter June',
    date '1962-06-13', 'WC', 'Warren Commission Report, Appendix 13', 'High', 6),
  ('oswald', 'mexico_city_visit', 'September 27 – October 2, 1963 — visited Cuban Consulate and Soviet Embassy in Mexico City',
    date '1963-09-27', 'ARRB', 'ARRB Final Report, Ch. 6; CIA Mexico City station cables', 'High', 7),
  ('oswald', 'residence_1963', '1026 North Beckley Avenue, Oak Cliff, Dallas (rented as O. H. Lee)',
    null, 'WC', 'Warren Commission Hearings, Vol. 10', 'High', 8),
  ('oswald', 'employer_1963', 'Texas School Book Depository (hired October 16, 1963)',
    date '1963-10-16', 'WC', 'Warren Commission Report, Ch. 4', 'High', 9),
  ('oswald', 'aliases', 'Alek J. Hidell; A. J. Hidell; Alik Hidell; O. H. Lee',
    null, 'WC', 'Warren Commission Report, Appendix 13', 'High', 10),
  ('oswald', 'arrested', 'November 22, 1963, 1:50 p.m. CST — Texas Theatre, Oak Cliff',
    date '1963-11-22', 'WC', 'Warren Commission Report, Ch. 4', 'High', 11),
  ('oswald', 'died', 'November 24, 1963, 1:07 p.m. CST — Parkland Memorial Hospital, Dallas',
    date '1963-11-24', 'WC', 'Warren Commission Report, Ch. 5', 'High', 12),

  -- ============================================================
  -- RUBY
  -- ============================================================
  ('ruby', 'born', 'April 25, 1911 — Chicago, Illinois (as Jacob Rubenstein)',
    date '1911-04-25', 'WC', 'Warren Commission Report, Appendix 16', 'High', 1),
  ('ruby', 'birth_name', 'Jacob L. Rubenstein (changed to Jack L. Ruby c. 1947)',
    null, 'WC', 'Warren Commission Report, Appendix 16', 'High', 2),
  ('ruby', 'business_1963', 'Operator of the Carousel Club (burlesque) and the Vegas Club, Dallas',
    null, 'WC', 'Warren Commission Report, Ch. 6', 'High', 3),
  ('ruby', 'shot_oswald', 'November 24, 1963, 11:21 a.m. CST — basement of Dallas Police Headquarters, during jail transfer',
    date '1963-11-24', 'WC', 'Warren Commission Report, Ch. 5', 'High', 4),
  ('ruby', 'convicted', 'March 14, 1964 — Dallas County Criminal District Court (death sentence)',
    date '1964-03-14', 'WC', 'Texas Court of Criminal Appeals record', 'High', 5),
  ('ruby', 'conviction_reversed', 'October 5, 1966 — Texas Court of Criminal Appeals reversed the conviction',
    date '1966-10-05', 'REFERENCE', 'Ruby v. Texas, 407 S.W.2d 793 (Tex. Crim. App. 1966)', 'High', 6),
  ('ruby', 'died', 'January 3, 1967 — Parkland Memorial Hospital, Dallas (pulmonary embolism, during treatment for lung cancer)',
    date '1967-01-03', 'REFERENCE', 'Dallas County death certificate', 'High', 7),

  -- ============================================================
  -- MARINA OSWALD
  -- ============================================================
  ('marina-oswald', 'born', 'July 17, 1941 — Molotovsk, USSR (now Severodvinsk, Russia)',
    date '1941-07-17', 'WC', 'Warren Commission Hearings, Vol. 1', 'High', 1),
  ('marina-oswald', 'birth_name', 'Marina Nikolaevna Prusakova',
    null, 'WC', 'Warren Commission Hearings, Vol. 1', 'High', 2),
  ('marina-oswald', 'married_oswald', 'April 30, 1961 — Minsk, Belorussian SSR',
    date '1961-04-30', 'WC', 'Warren Commission Hearings, Vol. 1', 'High', 3),
  ('marina-oswald', 'arrived_us', 'June 13, 1962 — arrived New York with Lee and infant daughter June',
    date '1962-06-13', 'WC', 'Warren Commission Hearings, Vol. 1', 'High', 4),
  ('marina-oswald', 'wc_testimony_appearances', '4 appearances before the Warren Commission (February, June, July, September 1964)',
    null, 'WC', 'Warren Commission Hearings, Vols. 1, 5, 11', 'High', 5),

  -- ============================================================
  -- HOOVER
  -- ============================================================
  ('hoover', 'born', 'January 1, 1895 — Washington, D.C.',
    date '1895-01-01', 'REFERENCE', 'FBI biographical record', 'High', 1),
  ('hoover', 'role_1963', 'Director, Federal Bureau of Investigation',
    null, 'REFERENCE', 'FBI Director tenure record', 'High', 2),
  ('hoover', 'tenure', 'Director of the FBI from May 10, 1924 until his death in 1972',
    null, 'REFERENCE', 'FBI official history', 'High', 3),
  ('hoover', 'role_in_case', 'Directed the Bureau\'s investigation of the assassination; initialed memoranda form a core layer of the JFK Collection',
    null, 'NAID', 'FBI HQ and Dallas Field Office JFK files', 'High', 4),
  ('hoover', 'died', 'May 2, 1972 — Washington, D.C.',
    date '1972-05-02', 'REFERENCE', 'FBI biographical record', 'High', 5),

  -- ============================================================
  -- ANGLETON
  -- ============================================================
  ('angleton', 'born', 'December 9, 1917 — Boise, Idaho',
    date '1917-12-09', 'REFERENCE', 'CIA Center for the Study of Intelligence biographical file', 'High', 1),
  ('angleton', 'role_1963', 'Chief of CIA Counterintelligence Staff',
    null, 'CHURCH', 'Church Committee Book V, Ch. III', 'High', 2),
  ('angleton', 'ci_tenure', 'Chief of CIA Counterintelligence from 1954 through December 1974',
    null, 'CHURCH', 'Church Committee Book V', 'High', 3),
  ('angleton', 'role_in_case', 'Oversaw CIA Counterintelligence handling of the pre-assassination Oswald file; CI/SIG routing slips and correspondence appear throughout the CIA JFK releases',
    null, 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 4),
  ('angleton', 'died', 'May 11, 1987 — Washington, D.C.',
    date '1987-05-11', 'REFERENCE', 'CIA biographical file', 'High', 5),

  -- ============================================================
  -- CIA (organization)
  -- ============================================================
  ('cia', 'founded', 'September 18, 1947 — established by the National Security Act of 1947',
    date '1947-09-18', 'REFERENCE', 'Public Law 80-253', 'High', 1),
  ('cia', 'headquarters', 'Langley, Virginia (since 1961)',
    null, 'REFERENCE', 'CIA public record', 'High', 2),
  ('cia', 'dci_nov_1963', 'John A. McCone, Director of Central Intelligence on November 22, 1963',
    null, 'REFERENCE', 'CIA Directors historical record', 'High', 3),
  ('cia', 'key_components_in_case', 'Mexico City Station, Miami Station (JMWAVE), Counterintelligence Staff, Directorate of Plans',
    null, 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 4),

  -- ============================================================
  -- FBI (organization)
  -- ============================================================
  ('fbi', 'founded', 'July 26, 1908 — as the Bureau of Investigation under the Department of Justice',
    date '1908-07-26', 'REFERENCE', 'FBI historical record', 'High', 1),
  ('fbi', 'director_nov_1963', 'J. Edgar Hoover, Director',
    null, 'REFERENCE', 'FBI Directors historical record', 'High', 2),
  ('fbi', 'primary_components_in_case', 'FBI Headquarters, FBI Dallas Field Office, FBI Laboratory (ballistics, handwriting, fiber)',
    null, 'NAID', 'FBI HQ and Dallas Field Office JFK files', 'High', 3),

  -- ============================================================
  -- WARREN COMMISSION
  -- ============================================================
  ('warren-commission', 'established', 'November 29, 1963 — by Executive Order 11130',
    date '1963-11-29', 'WC', 'Warren Commission Report, Foreword', 'High', 1),
  ('warren-commission', 'chair', 'Chief Justice Earl Warren',
    null, 'WC', 'Warren Commission Report, Foreword', 'High', 2),
  ('warren-commission', 'members', 'Earl Warren (chair); Richard Russell; John Sherman Cooper; Hale Boggs; Gerald R. Ford; Allen W. Dulles; John J. McCloy',
    null, 'WC', 'Warren Commission Report, Foreword', 'High', 3),
  ('warren-commission', 'general_counsel', 'J. Lee Rankin, General Counsel to the Commission',
    null, 'WC', 'Warren Commission Report, Staff List', 'High', 4),
  ('warren-commission', 'witnesses', '552 persons provided testimony (94 before the Commission; 395 by staff deposition; 61 by affidavit; 2 by statement)',
    null, 'WC', 'Warren Commission Report, Foreword', 'High', 5),
  ('warren-commission', 'report_delivered', 'September 24, 1964 — delivered to President Lyndon B. Johnson',
    date '1964-09-24', 'WC', 'Warren Commission Report, Foreword', 'High', 6),
  ('warren-commission', 'report_published', 'September 27, 1964 — 888-page final report made public',
    date '1964-09-27', 'WC', 'Warren Commission Report, Publication record', 'High', 7),
  ('warren-commission', 'hearings_volumes', '26 volumes of hearings and exhibits published 1964',
    null, 'WC', 'Warren Commission Hearings, Vols. 1-26', 'High', 8),

  -- ============================================================
  -- HSCA
  -- ============================================================
  ('hsca', 'established', 'September 17, 1976 — by House Resolution 1540',
    date '1976-09-17', 'HSCA', 'HSCA Final Report, Preface', 'High', 1),
  ('hsca', 'chair', 'Louis Stokes (D-OH), Chair, 1977-1979',
    null, 'HSCA', 'HSCA Final Report, Staff List', 'High', 2),
  ('hsca', 'chief_counsel', 'G. Robert Blakey, Chief Counsel and Staff Director, 1977-1979',
    null, 'HSCA', 'HSCA Final Report, Staff List', 'High', 3),
  ('hsca', 'scope', 'Re-investigated the assassinations of President John F. Kennedy and Dr. Martin Luther King, Jr.',
    null, 'HSCA', 'HSCA Final Report, Preface', 'High', 4),
  ('hsca', 'report_published', 'March 29, 1979 — Final Report published; 12 volumes of appendices followed',
    date '1979-03-29', 'HSCA', 'HSCA Final Report, Publication record', 'High', 5),
  ('hsca', 'central_finding_jfk', 'Concluded that President Kennedy "was probably assassinated as a result of a conspiracy," based in significant part on the acoustic analysis of a DPD dictabelt',
    null, 'HSCA', 'HSCA Final Report, Findings §I-C', 'High', 6),
  ('hsca', 'acoustic_rebuttal', 'The 1982 National Academy of Sciences (Ramsey Panel) report rejected the HSCA acoustic finding; the Justice Department in 1988 declined to reopen',
    date '1982-01-01', 'REFERENCE', 'NRC, Report of the Committee on Ballistic Acoustics (1982)', 'High', 7)
]);
