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
    date '1982-01-01', 'REFERENCE', 'NRC, Report of the Committee on Ballistic Acoustics (1982)', 'High', 7),

  -- ============================================================
  -- Phase 2-A Wave 1 entities (2026-04-19)
  -- ============================================================
  ('tippit', 'born', 'September 18, 1924 — Clarksville, Texas',
    date '1924-09-18', 'REFERENCE', 'Dallas Police Department personnel record', 'High', 1),
  ('tippit', 'role', 'Dallas Police Department patrolman, District 78, 1952–1963',
    null, 'WC', 'Warren Commission Report, Ch. 4', 'High', 2),
  ('tippit', 'killed', 'November 22, 1963 at approximately 1:15 p.m. CST — East 10th Street and Patton Avenue, Oak Cliff, Dallas',
    date '1963-11-22', 'WC', 'Warren Commission Report, Ch. 4', 'High', 3),
  ('tippit', 'witnesses', 'Nine eyewitnesses identified Oswald as the gunman in lineups or photo arrays',
    null, 'WC', 'Warren Commission Report, Appendix 11', 'High', 4),
  ('tippit', 'cartridges_matched', 'Four .38 Special cartridge cases at the scene matched the revolver (CE-143) Oswald carried at the Texas Theatre arrest',
    null, 'WC', 'Warren Commission Hearings, Vol. 3', 'High', 5),

  ('zapruder', 'born', 'May 15, 1905 — Kovel, Russian Empire (now Ukraine)',
    date '1905-05-15', 'REFERENCE', 'U.S. naturalization and census records', 'High', 1),
  ('zapruder', 'residence_1963', 'Dallas, Texas — operator of a women\'s clothing manufacturer, Jennifer Juniors Inc., in the Dal-Tex Building',
    null, 'WC', 'Warren Commission Hearings, Vol. 7', 'High', 2),
  ('zapruder', 'filming', 'Filmed the motorcade from a 4-foot concrete pergola on the north side of Elm Street using a Bell & Howell Zoomatic 8mm camera',
    date '1963-11-22', 'WC', 'Warren Commission Hearings, Vol. 7', 'High', 3),
  ('zapruder', 'rights_sold', 'November 23, 1963 — Time-Life Inc. purchased publication rights to the film for $150,000',
    date '1963-11-23', 'REFERENCE', 'Time-Life agreement (reproduced in ARRB records)', 'High', 4),
  ('zapruder', 'died', 'August 30, 1970 — Dallas, Texas',
    date '1970-08-30', 'REFERENCE', 'Texas death record', 'High', 5),

  ('connally', 'born', 'February 27, 1917 — Floresville, Texas',
    date '1917-02-27', 'REFERENCE', 'Texas state records', 'High', 1),
  ('connally', 'role_1963', 'Governor of Texas (January 15, 1963 – January 21, 1969)',
    null, 'REFERENCE', 'Texas Secretary of State governors list', 'High', 2),
  ('connally', 'wounded', 'November 22, 1963 — wounds to back, chest, right wrist, and left thigh; treated at Parkland Memorial Hospital',
    date '1963-11-22', 'WC', 'Warren Commission Report, Ch. 3', 'High', 3),
  ('connally', 'wc_testimony', 'Testified before the Warren Commission April 21, 1964 — Vol. IV, p. 129',
    date '1964-04-21', 'WC', 'Warren Commission Hearings, Vol. 4', 'High', 4),
  ('connally', 'died', 'June 15, 1993 — Houston, Texas',
    date '1993-06-15', 'REFERENCE', 'Texas death record', 'High', 5),

  ('earl-warren', 'born', 'March 19, 1891 — Los Angeles, California',
    date '1891-03-19', 'REFERENCE', 'Supreme Court biographical record', 'High', 1),
  ('earl-warren', 'role_1963', 'Chief Justice of the United States (since October 5, 1953)',
    null, 'REFERENCE', 'Supreme Court biographical record', 'High', 2),
  ('earl-warren', 'commission_appointment', 'Appointed by President Lyndon Johnson to chair the Presidential Commission on November 29, 1963',
    date '1963-11-29', 'WC', 'Executive Order 11130', 'High', 3),
  ('earl-warren', 'report_delivery', 'Delivered the Commission\'s 888-page final report to President Johnson on September 24, 1964',
    date '1964-09-24', 'WC', 'Warren Commission Report, Foreword', 'High', 4),
  ('earl-warren', 'died', 'July 9, 1974 — Washington, D.C.',
    date '1974-07-09', 'REFERENCE', 'Supreme Court biographical record', 'High', 5),

  ('dulles', 'born', 'April 7, 1893 — Watertown, New York',
    date '1893-04-07', 'REFERENCE', 'CIA biographical record', 'High', 1),
  ('dulles', 'dci_tenure', 'Director of Central Intelligence, February 26, 1953 – November 29, 1961',
    null, 'REFERENCE', 'CIA Directors historical record', 'High', 2),
  ('dulles', 'dismissed', 'Dismissed by President Kennedy following the Bay of Pigs operation (resignation announced April 1962 for later effective date)',
    date '1961-11-29', 'CHURCH', 'Church Committee Book IV', 'High', 3),
  ('dulles', 'wc_member', 'Appointed to the Warren Commission by President Johnson, November 29, 1963',
    date '1963-11-29', 'WC', 'Executive Order 11130', 'High', 4),
  ('dulles', 'died', 'January 29, 1969 — Washington, D.C.',
    date '1969-01-29', 'REFERENCE', 'CIA biographical record', 'High', 5),

  ('blakey', 'born', 'January 7, 1936',
    date '1936-01-07', 'REFERENCE', 'Notre Dame Law School faculty biographical record', 'High', 1),
  ('blakey', 'hsca_role', 'Chief Counsel and Staff Director, House Select Committee on Assassinations, June 1977 – March 1979',
    null, 'HSCA', 'HSCA Final Report, Staff List', 'High', 2),
  ('blakey', 'forensic_panels', 'Commissioned the HSCA Forensic Pathology Panel, Photographic Evidence Panel, and acoustic analysis',
    null, 'HSCA', 'HSCA Final Report, Appendices', 'High', 3),

  ('church-committee', 'established', 'January 27, 1975 — by Senate Resolution 21',
    date '1975-01-27', 'CHURCH', 'Church Committee Book I, Preface', 'High', 1),
  ('church-committee', 'chair', 'Senator Frank Church (D-ID), Chair',
    null, 'CHURCH', 'Church Committee Book I, Preface', 'High', 2),
  ('church-committee', 'final_report', 'April 23, 1976 — six-book Final Report published (S. Rep. No. 94-755)',
    date '1976-04-23', 'CHURCH', 'Church Committee Final Report', 'High', 3),
  ('church-committee', 'book_v_jfk', 'Book V: "The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies" — indexed in the site as a primary-source report',
    null, 'CHURCH', 'Church Committee Book V', 'High', 4),

  ('arrb', 'established', 'October 26, 1992 — JFK Records Act signed (P.L. 102-526); Board members sworn in April 11, 1994',
    date '1992-10-26', 'ARRB', 'JFK Records Act', 'High', 1),
  ('arrb', 'chair', 'John R. Tunheim, Chair (1994–1998)',
    null, 'ARRB', 'ARRB Final Report, Staff List', 'High', 2),
  ('arrb', 'records_reviewed', 'Approximately 4 million pages reviewed; approximately 60,000 prior postponements reversed',
    null, 'ARRB', 'ARRB Final Report, Ch. 1', 'High', 3),
  ('arrb', 'zapruder_designation', 'April 24, 1997 — formally declared the original Zapruder film an assassination record',
    date '1997-04-24', 'ARRB', 'ARRB Final Report, Ch. 2', 'High', 4),
  ('arrb', 'final_report', 'September 30, 1998 — Final Report published; Collection transferred to NARA',
    date '1998-09-30', 'ARRB', 'ARRB Final Report', 'High', 5),

  ('duran', 'born', 'February 1, 1937 — Mexico',
    date '1937-02-01', 'HSCA', 'HSCA Final Report, Vol. III (Lopez Report)', 'High', 1),
  ('duran', 'role_1963', 'Employee at the Cuban Consulate, Mexico City — processed Oswald\'s visa application',
    null, 'WC', 'Warren Commission Report, Appendix 15', 'High', 2),
  ('duran', 'oswald_contact', 'September 27–October 2, 1963 — interacted with Oswald over multiple consulate visits',
    date '1963-09-27', 'WC', 'Warren Commission Report, Appendix 15', 'High', 3),
  ('duran', 'detained', 'November 23, 1963 — detained and interrogated by Mexican authorities at U.S. request',
    date '1963-11-23', 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 4),
  ('duran', 'hsca_testimony', '1978 — interviewed by HSCA staff; her statements form a central thread of the Lopez Report',
    date '1978-01-01', 'HSCA', 'HSCA Vol. III (Lopez Report)', 'High', 5),

  ('phillips', 'born', 'October 31, 1922 — Fort Worth, Texas',
    date '1922-10-31', 'REFERENCE', 'Association of Former Intelligence Officers biographical file', 'High', 1),
  ('phillips', 'role_1963', 'CIA Chief of Cuban Operations at the Mexico City station',
    null, 'CHURCH', 'Church Committee Book V', 'High', 2),
  ('phillips', 'later_roles', 'Chief of Western Hemisphere Division, 1973–1975 (retired)',
    null, 'REFERENCE', 'CIA personnel records', 'High', 3),
  ('phillips', 'aliases', 'Operated under the pseudonym "Maurice Bishop" according to HSCA testimony by Antonio Veciana (contested by Phillips)',
    null, 'HSCA', 'HSCA Final Report, Sec. I-C; Vol. X', 'Medium', 4),
  ('phillips', 'died', 'July 7, 1988 — Bethesda, Maryland',
    date '1988-07-07', 'REFERENCE', 'AFIO biographical record', 'High', 5),

  ('win-scott', 'born', 'March 30, 1909 — Jemison, Alabama',
    date '1909-03-30', 'REFERENCE', 'CIA biographical file (declassified)', 'High', 1),
  ('win-scott', 'role_1963', 'CIA Chief of Station, Mexico City (1956–1969)',
    null, 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 2),
  ('win-scott', 'operations_supervised', 'LIENVOY telephone intercepts; LIEMPTY Soviet-embassy photo surveillance; LIHUFF/LIONION Cuban-target surveillance',
    null, 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 3),
  ('win-scott', 'died', 'April 26, 1971 — Mexico City',
    date '1971-04-26', 'REFERENCE', 'ARRB-era CIA records', 'High', 4),
  ('win-scott', 'posthumous_manuscript', 'James Angleton traveled to Mexico City following Scott\'s death to retrieve his safe contents and an unpublished memoir manuscript',
    date '1971-05-01', 'ARRB', 'ARRB Final Report, Ch. 6', 'High', 5),

  -- ============================================================
  -- KOSTIKOV (Wave 2, April 2026)
  -- ============================================================
  ('kostikov', 'role_1963', 'KGB officer under diplomatic cover at the Soviet Embassy in Mexico City; identified by CIA as Department 13 (Executive Action)',
    null, 'HSCA', 'HSCA Vol. III, pp. 565-571', 'High', 1),
  ('kostikov', 'mexico_city_tour', 'Posted to Mexico City circa 1961-1965',
    null, 'ARRB', 'Lopez Report (1978)', 'High', 2),
  ('kostikov', 'oswald_contact', 'September 28, 1963 — documented contact with Oswald at the Soviet consulate in Mexico City',
    date '1963-09-28', 'ARRB', 'Lopez Report (1978); CIA Mexico City station cables', 'High', 3),
  ('kostikov', 'kgb_line', 'CIA cables identified Kostikov as a member of KGB Department 13 (Executive Action), the line responsible for sabotage and assassination operations against foreign opponents',
    null, 'HSCA', 'HSCA Vol. III, pp. 565-571', 'High', 4),
  ('kostikov', 'category', 'Adjacent — appears in pre-assassination Mexico City surveillance product but not investigated as a participant',
    null, 'REFERENCE', 'Lopez Report (1978) summary', 'Medium', 5),

  -- ============================================================
  -- DE MOHRENSCHILDT (Wave 2, April 2026)
  -- ============================================================
  ('de-mohrenschildt', 'born', 'April 17, 1911 — Mozyr, then Russian Empire (now Belarus)',
    date '1911-04-17', 'REFERENCE', 'WC Vol. 9 — biographical statement', 'High', 1),
  ('de-mohrenschildt', 'profession', 'Petroleum geologist; international consulting in petroleum exploration',
    null, 'WC', 'WC Vol. 9 (de Mohrenschildt testimony, April 22-23, 1964)', 'High', 2),
  ('de-mohrenschildt', 'oswald_contact_period', 'October 1962 – April 1963 — close social contact with Lee and Marina Oswald in the Dallas-Fort Worth Russian-speaking émigré circle',
    date '1962-10-01', 'WC', 'WC Vol. 9', 'High', 3),
  ('de-mohrenschildt', 'wc_testimony', 'Testified before the Warren Commission on April 22-23, 1964 (WC Vol. 9)',
    date '1964-04-22', 'WC', 'Warren Commission Hearings, Vol. 9', 'High', 4),
  ('de-mohrenschildt', 'died', 'March 29, 1977 — found dead of self-inflicted shotgun wound in Manalapan, Florida, hours after HSCA investigator Gaeton Fonzi delivered an interview request',
    date '1977-03-29', 'HSCA', 'HSCA Final Report (1979), witness-mortality review', 'High', 5),
  ('de-mohrenschildt', 'category', 'Adjacent — social contact of the Oswalds; not investigated as a participant',
    null, 'REFERENCE', 'WC Final Report and HSCA Final Report', 'Medium', 6),

  -- ============================================================
  -- CUBELA (Wave 2, April 2026)
  -- ============================================================
  ('cubela', 'born', 'September 9, 1932 — Cuba',
    date '1932-09-09', 'CHURCH', 'Church Committee Interim Report (1975), pp. 86-89', 'High', 1),
  ('cubela', 'role_revolutionary', 'Cuban Army officer; July 26 Movement comandante during the Cuban Revolution; held senior post-revolution roles',
    null, 'CHURCH', 'Church Committee Interim Report (1975)', 'High', 2),
  ('cubela', 'cia_cryptonym', 'CIA cryptonym AMLASH-1; the broader operation to recruit a Cuban government insider against Fidel Castro carried the cryptonym AMLASH',
    null, 'CHURCH', 'Church Committee Interim Report (1975), pp. 86-89', 'High', 3),
  ('cubela', 'paris_meeting', 'November 22, 1963 — met with his CIA case officer in Paris on the day President Kennedy was assassinated',
    date '1963-11-22', 'CHURCH', 'Church Committee Interim Report (1975)', 'High', 4),
  ('cubela', 'convicted', '1966 — Cuban authorities arrested Cubela and co-conspirators; sentenced to 25 years',
    date '1966-03-01', 'REFERENCE', 'Cuban government press releases (1966)', 'High', 5),
  ('cubela', 'released', '1979 — released from Cuban prison; relocated to Spain',
    date '1979-01-01', 'REFERENCE', 'Cuban government records; later press accounts', 'Medium', 6),
  ('cubela', 'category', 'Adjacent — CIA asset cited by Church Committee in the Castro assassination plots',
    null, 'REFERENCE', 'Church Committee Interim Report (1975)', 'Medium', 7),

  -- ============================================================
  -- SPECTER (Wave 3, April 2026)
  -- ============================================================
  ('specter', 'role', 'Assistant Counsel, Warren Commission Area I (Basic Facts of the Assassination)',
    null, 'WC', 'Warren Commission Report, Foreword and Staff Roster', 'High', 1),
  ('specter', 'key_output', 'Principal author of the single-bullet conclusion (CE 399); drafted Chapter III of the Warren Report',
    null, 'WC', 'Warren Commission Report, Ch. III', 'High', 2),
  ('specter', 'autopsy_depositions', 'Conducted the Warren Commission depositions of Drs. Humes, Boswell, and Finck on the Bethesda autopsy (April 21, 1964)',
    date '1964-04-21', 'WC', 'Warren Commission Hearings, Vol. 2', 'High', 3),
  ('specter', 'later_career', 'U.S. Senator from Pennsylvania, five terms (1981–2011)',
    null, 'REFERENCE', 'U.S. Senate Historical Office biography', 'High', 4),
  ('specter', 'critical_response', 'Single-bullet conclusion contested by HSCA acoustic analysis and subsequent independent ballistic studies',
    null, 'HSCA', 'HSCA Final Report (1979), §I.B', 'Medium', 5),
  ('specter', 'self_defense', 'Reaffirmed single-bullet conclusion in "Passion for Truth" (2000)',
    date '2000-04-01', 'REFERENCE', 'Specter, Passion for Truth (2000), Ch. 5', 'High', 6),
  ('specter', 'died', 'October 14, 2012 — Philadelphia, Pennsylvania',
    date '2012-10-14', 'REFERENCE', 'U.S. Senate Historical Office biography', 'High', 7),

  -- ============================================================
  -- MARCELLO (Wave 3, April 2026)
  -- ============================================================
  ('marcello', 'role', 'Head of the New Orleans Mafia family, 1947 until 1980s incarceration',
    null, 'HSCA', 'HSCA Vol. IX, §III', 'High', 1),
  ('marcello', 'kennedy_target', 'Primary RFK organized-crime task-force target; summarily deported to Guatemala April 4, 1961',
    date '1961-04-04', 'HSCA', 'HSCA Vol. IX, ¶343', 'High', 2),
  ('marcello', 'hsca_finding', 'HSCA concluded Marcello had "motive, means, and opportunity"; no direct evidence of participation',
    null, 'HSCA', 'HSCA Final Report (1979), §I.C.2', 'High', 3),
  ('marcello', 'alleged_threat', 'Becker allegation of a 1962 threat against the Kennedys; FBI and HSCA investigated, could not corroborate',
    null, 'HSCA', 'HSCA Vol. IX, ¶¶370–419', 'Medium', 4),
  ('marcello', 'hsca_testimony', 'Testified under oath in HSCA executive session, January 11, 1978; denied involvement',
    date '1978-01-11', 'HSCA', 'HSCA Vol. V, executive session', 'High', 5),
  ('marcello', 'died', 'March 2, 1993 — Metairie, Louisiana',
    date '1993-03-02', 'REFERENCE', 'Louisiana state vital records', 'High', 6),

  -- ============================================================
  -- TRAFFICANTE (Wave 3, April 2026)
  -- ============================================================
  ('trafficante', 'role', 'Boss of the Trafficante crime family, Tampa, Florida',
    null, 'HSCA', 'HSCA Vol. V, pp. 345–416', 'High', 1),
  ('trafficante', 'castro_plots', 'One of three Mafia figures recruited by CIA via Robert Maheu to assassinate Fidel Castro, 1960–1963',
    null, 'CHURCH', 'Church Committee Interim Report (1975), pp. 74–82', 'High', 2),
  ('trafficante', 'cuba_pre_revolution', 'Operated Sans Souci and other Havana casinos under Batista; briefly detained by Castro government 1959',
    null, 'HSCA', 'HSCA Vol. V testimony', 'High', 3),
  ('trafficante', 'hsca_testimony', 'Testified under court-ordered grant of immunity at HSCA public hearing, September 28, 1978',
    date '1978-09-28', 'HSCA', 'HSCA Vol. V, pp. 345–416', 'High', 4),
  ('trafficante', 'roselli_hit', 'Named by FBI investigators as the most likely figure to have ordered the July 1976 murder of Johnny Roselli',
    null, 'REFERENCE', 'New York Times, February 25, 1977', 'Medium', 5),
  ('trafficante', 'died', 'March 17, 1987 — Houston, Texas',
    date '1987-03-17', 'REFERENCE', 'Florida vital records', 'High', 6),

  -- ============================================================
  -- GIANCANA (Wave 3, April 2026)
  -- ============================================================
  ('giancana', 'role', 'Boss of the Chicago Outfit, approximately 1957–1966',
    null, 'REFERENCE', 'FBI Top Hoodlum Program file (declassified)', 'High', 1),
  ('giancana', 'castro_plots', 'One of three Mafia figures recruited by CIA via Robert Maheu in the 1960–1963 Castro assassination plots',
    null, 'CHURCH', 'Church Committee Interim Report (1975), pp. 74–82', 'High', 2),
  ('giancana', 'exner_link', 'Connected to President Kennedy through Judith Campbell Exner during 1961; documented by FBI and reviewed by Church Committee',
    null, 'CHURCH', 'Church Committee Interim Report (1975); FBI files released 1977', 'Medium', 3),
  ('giancana', 'murder', 'Shot seven times with a silenced .22 caliber pistol in the basement kitchen of his Oak Park, Illinois home, June 19, 1975',
    date '1975-06-19', 'REFERENCE', 'Cook County coroner report; FBI investigation', 'High', 4),
  ('giancana', 'timing_relative_to_church', 'Murder occurred five days before Johnny Roselli\'s scheduled Church Committee testimony; remains officially unsolved',
    date '1975-06-19', 'CHURCH', 'Church Committee records', 'High', 5),

  -- ============================================================
  -- ROSELLI (Wave 3, April 2026)
  -- ============================================================
  ('roselli', 'role', 'CIA-mob intermediary in the Castro assassination plots, 1960–1963',
    null, 'CHURCH', 'Church Committee Interim Report (1975)', 'High', 1),
  ('roselli', 'church_testimony_1', 'Testified before the Church Committee, June 24, 1975',
    date '1975-06-24', 'CHURCH', 'Church Committee records', 'High', 2),
  ('roselli', 'church_testimony_2', 'Additional Church Committee testimony, September 22, 1975',
    date '1975-09-22', 'CHURCH', 'Church Committee records', 'High', 3),
  ('roselli', 'hsca_testimony', 'Appeared before the HSCA in 1976 on the CIA-mob plots and the Kennedy assassination',
    null, 'HSCA', 'HSCA records', 'High', 4),
  ('roselli', 'disappearance', 'Disappeared July 28, 1976; body found August 7, 1976 in a 55-gallon oil drum in Dumfoundling Bay, Florida',
    date '1976-07-28', 'REFERENCE', 'Dade County medical examiner; FBI', 'High', 5),
  ('roselli', 'birth_name', 'Born Filippo Sacco, July 4, 1905 — Esperia, Italy',
    date '1905-07-04', 'REFERENCE', 'INS/immigration records', 'High', 6),

  -- ============================================================
  -- GARRISON (Wave 3, April 2026)
  -- ============================================================
  ('garrison', 'role', 'District Attorney, Orleans Parish, Louisiana, 1962–1973',
    null, 'REFERENCE', 'Louisiana state records', 'High', 1),
  ('garrison', 'investigation', 'Opened the only DA-led criminal investigation into the JFK assassination in U.S. history (1966–1969)',
    date '1966-11-01', 'REFERENCE', 'State v. Shaw, Orleans Parish Criminal Court record', 'High', 2),
  ('garrison', 'shaw_arrest', 'Arrested Clay Shaw on a charge of conspiracy to assassinate the President, March 1, 1967',
    date '1967-03-01', 'REFERENCE', 'Orleans Parish Criminal Court record', 'High', 3),
  ('garrison', 'shaw_acquittal', 'Clay Shaw acquitted by jury in under one hour, March 1, 1969',
    date '1969-03-01', 'REFERENCE', 'State v. Shaw verdict; New York Times, March 16, 1969', 'High', 4),
  ('garrison', 'cia_scrutiny', 'CIA internal files document agency monitoring of the Garrison investigation',
    null, 'REFERENCE', 'CIA "GARRISON INVESTIGATION" file (FOIA, CIA-RDP79-00632A000100100007-2)', 'Medium', 5),
  ('garrison', 'hsca_review', 'HSCA reviewed Garrison\'s evidence and did not find it substantiated a conspiracy finding against Shaw',
    null, 'HSCA', 'HSCA Final Report (1979)', 'High', 6),
  ('garrison', 'died', 'October 21, 1992 — New Orleans, Louisiana',
    date '1992-10-21', 'REFERENCE', 'Louisiana state vital records', 'High', 7),

  -- ============================================================
  -- CLAY SHAW (Wave 3, April 2026)
  -- ============================================================
  ('clay-shaw', 'role', 'Founder and managing director, International Trade Mart, New Orleans',
    null, 'REFERENCE', 'New Orleans business records', 'High', 1),
  ('clay-shaw', 'arrest', 'Arrested by DA Jim Garrison on conspiracy charge, March 1, 1967',
    date '1967-03-01', 'REFERENCE', 'Orleans Parish Criminal Court record', 'High', 2),
  ('clay-shaw', 'trial', 'Tried January 31 – March 1, 1969 before Judge Edward A. Haggerty Jr.',
    date '1969-01-31', 'REFERENCE', 'Clay Shaw Trial Transcripts (History Matters archive)', 'High', 3),
  ('clay-shaw', 'verdict', 'Acquitted by jury in under one hour deliberation, March 1, 1969',
    date '1969-03-01', 'REFERENCE', 'State v. Shaw verdict', 'High', 4),
  ('clay-shaw', 'cia_contact', 'Served as a CIA Domestic Contact Service contact in the 1950s–early 1960s; confirmed in 1979 by former DCI Richard Helms',
    null, 'REFERENCE', 'Helms Congressional testimony (1979); post-JFK Records Act CIA releases', 'Medium', 5),
  ('clay-shaw', 'died', 'August 15, 1974 — New Orleans, Louisiana',
    date '1974-08-15', 'REFERENCE', 'Louisiana state vital records', 'High', 6),

  -- ============================================================
  -- GOODPASTURE (Wave 3, April 2026)
  -- ============================================================
  ('goodpasture', 'role', 'Senior case officer, CIA Mexico City station; deputy to station chief Win Scott',
    null, 'ARRB', 'ARRB Goodpasture deposition (December 15, 1995)', 'High', 1),
  ('goodpasture', 'programs_handled', 'Handled LIENVOY telephone-intercept and photo-surveillance product at the station',
    null, 'ARRB', 'ARRB deposition; HSCA Lopez Report (1978)', 'High', 2),
  ('goodpasture', 'oswald_role', 'Coordinated Mexico City station cable traffic about Oswald visits in September–October 1963',
    null, 'ARRB', 'ARRB deposition (December 15, 1995), pp. 50–120', 'High', 3),
  ('goodpasture', 'phillips_rebuttal', 'Contradicted David Atlee Phillips\'s "lazy Soviet desk officer" explanation for why Oswald\'s name checked out routinely',
    null, 'ARRB', 'ARRB deposition (April 23, 1998)', 'Medium', 4),
  ('goodpasture', 'arrb_depositions', 'Deposed by ARRB twice — December 15, 1995 and April 23, 1998 (classified at the time)',
    date '1995-12-15', 'ARRB', 'ARRB deposition records', 'High', 5),
  ('goodpasture', 'died', 'December 4, 2011',
    date '2011-12-04', 'REFERENCE', 'AFIO obituary', 'High', 6),

  -- ============================================================
  -- JANE ROMAN (Wave 3, April 2026)
  -- ============================================================
  ('jane-roman', 'role', 'Senior liaison officer, CIA Counterintelligence Staff (CI/Liaison) under James Angleton',
    null, 'REFERENCE', 'CIA personnel records; Newman interviews', 'High', 1),
  ('jane-roman', 'oct10_cable', 'Signed the October 10, 1963 CIA HQ-to-Mexico-City cable responding to the station\'s report on Oswald\'s Cuban/Soviet embassy visits',
    date '1963-10-10', 'ARRB', 'NARA 2002 declassification of the October 10, 1963 cable', 'High', 2),
  ('jane-roman', 'omission', 'The cable stated CIA had last reported on Oswald in May 1962 — omitting multiple FBI reports on his September 1963 FPCC activities in New Orleans routed through CIA in the weeks prior',
    null, 'REFERENCE', 'Newman, Oswald and the CIA (1995); ARRB records', 'Medium', 3),
  ('jane-roman', 'newman_interview_1', 'Interviewed by historian John M. Newman at her home in Washington, November 1994',
    date '1994-11-01', 'REFERENCE', 'History Matters — "What Jane Roman Said"', 'High', 4),
  ('jane-roman', 'newman_interview_2', 'Follow-up Newman interview (1995); characterized the October 10 cable as "indicative of a keen interest in Oswald held on a need-to-know basis"',
    date '1995-03-01', 'REFERENCE', 'History Matters — "What Jane Roman Said"', 'Medium', 5),
  ('jane-roman', 'died', '2008',
    date '2008-01-01', 'REFERENCE', 'AFIO obituary (approximate)', 'Medium', 6)
]);
