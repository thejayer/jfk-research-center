-- 12_curated_jfk_entities.sql
--
-- Purpose:
--   Seed the canonical entity dictionary used by the app. Entities are
--   hand-curated; each has a list of aliases matched case-insensitively
--   against record titles, From/To names, and descriptive fields.
--
-- Dependencies: (none)

create or replace table jfk_curated.jfk_entities as
select * from unnest([
  struct<
    entity_id string,
    entity_name string,
    entity_type string,
    aliases array<string>,
    summary string,
    description string,
    headline string,
    born string,
    died string,
    active_years string,
    sort_order int64
  >(
    'oswald',
    'Lee Harvey Oswald',
    'person',
    ['Lee Harvey Oswald','Lee H. Oswald','Harvey Oswald','L. H. Oswald','LHO','Alek J. Hidell','A. J. Hidell','Alik Hidell','O. H. Lee'],
    'U.S. Marine veteran, defector to the Soviet Union, and the sole person charged by the Dallas Police Department with the assassination of President Kennedy on November 22, 1963.',
    'Lee Harvey Oswald served in the U.S. Marine Corps from 1956 to 1959 before defecting to the Soviet Union, where he lived in Minsk until 1962. After returning to the United States with his wife Marina, he worked briefly in Dallas and New Orleans, undertook a trip to Mexico City in late September 1963, and was arrested at the Texas Theatre on November 22, 1963. Approximately 45 minutes after the assassination of President Kennedy, Dallas Police Officer J. D. Tippit was shot and killed on East 10th Street in Oak Cliff; Oswald was charged with both murders the same day. He was shot and killed two days later by Dallas nightclub owner Jack Ruby while being transferred between jails.',
    'Former Marine whose life, travels, and final days are the central thread of every JFK investigation.',
    '1939-10-18',
    '1963-11-24',
    '1956–1963',
    1
  ),
  ('ruby','Jack Ruby','person',
    ['Jack Ruby','Jack L. Ruby','Jacob Rubenstein','Jack Rubenstein','Rubenstein'],
    'Dallas nightclub owner who shot Lee Harvey Oswald in the basement of Dallas Police Headquarters on November 24, 1963.',
    'Jack Ruby owned the Carousel Club and the Vegas Club in Dallas, Texas. He had long-running contacts with Dallas Police officers and was the subject of extensive FBI and Warren Commission inquiry into his movements in the days surrounding the assassination. He was convicted of Oswald\'s murder in March 1964. On October 5, 1966 the Texas Court of Criminal Appeals reversed the conviction; before a retrial could be held, Ruby died on January 3, 1967 of a pulmonary embolism while being treated for lung cancer at Parkland Memorial Hospital.',
    null,'1911-04-25','1967-01-03','1947–1967', 2),
  ('marina-oswald','Marina N. Oswald','person',
    ['Marina Oswald','Marina N. Oswald','Marina Nikolaevna','Marina Prusakova','Marina Oswald Porter'],
    'Oswald\'s Soviet-born wife and a principal Warren Commission witness.',
    'Marina Oswald testified before the Warren Commission four times in 1964 and remained under FBI protective surveillance for months after the assassination. Her interview reports are indexed across the Dallas Field Office and Warren Commission files.',
    null,'1941-07-17',null,'1961–present', 3),
  ('hoover','J. Edgar Hoover','person',
    ['J. Edgar Hoover','J.E. Hoover','Hoover','Director Hoover','The Director'],
    'FBI Director whose personal memoranda document the Bureau\'s hour-by-hour response to the assassination.',
    'J. Edgar Hoover directed the FBI from 1924 until his death. His initialed memoranda, phone transcripts, and briefing papers are a primary record of how the Bureau characterized Oswald, Ruby, and the Dallas investigation in the hours and days following November 22, 1963.',
    null,'1895-01-01','1972-05-02','1924–1972', 4),
  ('angleton','James J. Angleton','person',
    ['James Jesus Angleton','James J. Angleton','J. J. Angleton','Angleton'],
    'Chief of CIA Counterintelligence Staff from 1954 to 1974; supervised handling of the Oswald 201 file.',
    'As Chief of CIA Counterintelligence (1954–1974), James Angleton oversaw the agency\'s long-running molehunt and had direct knowledge of the pre-assassination Oswald file. His name appears on routing slips and correspondence throughout the CIA\'s JFK releases.',
    null,'1917-12-09','1987-05-11','1954–1974', 5),
  ('cia','Central Intelligence Agency','org',
    ['CIA','Central Intelligence Agency','the Agency'],
    'U.S. foreign-intelligence agency whose Mexico City station, counterintelligence staff, and Cuban operations feature heavily in the JFK file releases.',
    'The Central Intelligence Agency\'s operational interest in Oswald predated the assassination by several years and is documented across station cables, 201 personality files, and counterintelligence correspondence. Agency holdings released under the President John F. Kennedy Assassination Records Collection Act of 1992 include materials from the Mexico City, Miami, and Directorate of Plans files.',
    null,null,null,'1947–present', 6),
  ('fbi','Federal Bureau of Investigation','org',
    ['FBI','Federal Bureau of Investigation','the Bureau','FBIHQ'],
    'Lead domestic investigating agency in the immediate hours and years after the assassination; maintained voluminous files on Oswald and Ruby.',
    'The Federal Bureau of Investigation conducted the first federal investigation of the assassination and supplied the Warren Commission with the majority of its evidentiary record. FBI holdings in the JFK Collection include the Oswald HQ and Dallas Field Office files, the Ruby file, and interview reports (FD-302 forms) covering thousands of witnesses.',
    null,null,null,'1908–present', 7),
  ('warren-commission','Warren Commission','org',
    ['Warren Commission','President\'s Commission on the Assassination of President Kennedy','Warren Report'],
    'Presidential commission chaired by Chief Justice Earl Warren that produced the first federal assassination report in September 1964.',
    'Established by Executive Order 11130 on November 29, 1963, the Commission heard testimony from 552 witnesses and published its 888-page report along with 26 volumes of hearings and exhibits. Its records, including staff memoranda and unpublished exhibits, form a core layer of the National Archives JFK Collection.',
    null,null,null,'1963–1964', 8),
  ('hsca','House Select Committee on Assassinations','org',
    ['HSCA','House Select Committee on Assassinations','Select Committee on Assassinations'],
    '1976–1979 congressional inquiry that re-examined the Kennedy and King assassinations and published a 12-volume appendix of evidence.',
    'The House Select Committee on Assassinations reviewed the forensic, acoustic, medical, and intelligence record surrounding the Kennedy and King assassinations. Its final report concluded that President Kennedy was "probably assassinated as a result of a conspiracy" and recommended further investigation by the Department of Justice; its working files were transferred to the National Archives in the 1990s.',
    null,null,null,'1976–1979', 9),

  -- ============================================================
  -- Phase 2-A Wave 1: 11 new entities (2026-04-19)
  -- ============================================================
  ('tippit','J. D. Tippit','person',
    ['J. D. Tippit','J.D. Tippit','J. D. "Jefferson Davis" Tippit','Officer Tippit','Tippit'],
    'Dallas Police Officer shot and killed in Oak Cliff on November 22, 1963, approximately 45 minutes after the assassination of President Kennedy.',
    'J. D. Tippit was an 11-year veteran of the Dallas Police Department assigned to patrol District 78 on November 22, 1963. He was shot at approximately 1:15 p.m. CST at East 10th Street and Patton Avenue after stopping a suspect matching the description broadcast in the assassination alert. Nine eyewitnesses later identified Lee Harvey Oswald as the gunman; ballistics matched the four recovered cartridge cases to the revolver Oswald was carrying when arrested at the Texas Theatre 35 minutes later.',
    null,'1924-09-18','1963-11-22','1952–1963', 10),

  ('zapruder','Abraham Zapruder','person',
    ['Abraham Zapruder','Abe Zapruder','Zapruder'],
    'Dallas dressmaker whose 26-second 8mm color home movie of the motorcade captured the assassination and became the single most-examined piece of visual evidence in the case.',
    'Abraham Zapruder filmed the motorcade from a concrete pergola on the north side of Elm Street using a Bell & Howell Zoomatic camera. The resulting film, covering frames 133 through 486 of the Dealey Plaza passage, was examined by the Warren Commission, the HSCA Photographic Evidence Panel, and the ARRB. Zapruder sold publication rights to Time-Life in 1963; the original film was declared an assassination record by the ARRB in 1997 and acquired by the federal government in 1999.',
    null,'1905-05-15','1970-08-30','1963–1970', 11),

  ('connally','John Connally','person',
    ['John Connally','John B. Connally','Governor Connally','John Bowden Connally Jr.'],
    'Governor of Texas wounded alongside President Kennedy in the motorcade; a central witness to the single-bullet analysis.',
    'John Connally served as Governor of Texas from 1963 to 1969 and was riding in the jump seat of the presidential limousine on November 22, 1963. He sustained wounds to the back, chest, right wrist, and left thigh — wounds central to the Warren Commission\'s single-bullet analysis. Connally survived, testified before the Warren Commission in 1964, and appeared again before the HSCA in 1978.',
    null,'1917-02-27','1993-06-15','1949–1993', 12),

  ('earl-warren','Earl Warren','person',
    ['Earl Warren','Chief Justice Warren','Chief Justice Earl Warren'],
    'Chief Justice of the United States who chaired the 1963–1964 Presidential Commission on the Assassination of President Kennedy.',
    'Earl Warren served as Chief Justice from 1953 to 1969. On November 29, 1963, President Lyndon Johnson named him to chair the Presidential Commission on the Assassination of President Kennedy, which is universally known by his name. Warren initially declined citing court obligations and was persuaded by Johnson to accept. The Commission delivered its 888-page final report on September 24, 1964.',
    null,'1891-03-19','1974-07-09','1925–1969', 13),

  ('dulles','Allen Dulles','person',
    ['Allen Dulles','Allen W. Dulles','Allen Welsh Dulles'],
    'Former Director of Central Intelligence (1953–1961) who served as a member of the Warren Commission.',
    'Allen Dulles directed the CIA through the Bay of Pigs operation and was dismissed by President Kennedy in November 1961. Two years later he was appointed by Johnson to the Warren Commission. Dulles\'s presence on the Commission — a panel investigating in part the conduct of the agency he had led — has been the subject of conflict-of-interest analysis in the Church Committee and ARRB records.',
    null,'1893-04-07','1969-01-29','1916–1961', 14),

  ('blakey','G. Robert Blakey','person',
    ['G. Robert Blakey','Robert Blakey','George Robert Blakey'],
    'Chief Counsel and Staff Director of the House Select Committee on Assassinations, 1977–1979.',
    'G. Robert Blakey, a professor of law at Cornell and later Notre Dame, was appointed Chief Counsel of the HSCA in June 1977. Under his direction the Committee commissioned the forensic pathology panel, the photographic evidence panel, and the acoustic analysis that grounded the Committee\'s 1979 "probable conspiracy" conclusion. Blakey later wrote extensively on the investigation and on the subsequent scholarly record.',
    null,'1936-01-07',null,'1960–present', 15),

  ('church-committee','Church Committee (SSCIA)','org',
    ['Church Committee','Senate Select Committee on Intelligence','SSCIA','Senate Select Committee to Study Governmental Operations','Frank Church Committee'],
    '1975–76 Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities, chaired by Frank Church.',
    'The Church Committee conducted the first sustained congressional review of CIA, FBI, NSA, and IRS intelligence operations. Its six-book final report (April 1976) includes Book V, "The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies." The Committee\'s work is foundational to public knowledge of the CIA-Mafia Castro plots (AMLASH, ZRRIFLE), MHCHAOS, and the Oswald 201 file handling.',
    null,null,null,'1975–1976', 16),

  ('arrb','Assassination Records Review Board','org',
    ['ARRB','Assassination Records Review Board','Review Board'],
    'Five-member independent panel (1994–1998) that oversaw declassification of the JFK Assassination Records Collection under the JFK Records Act of 1992.',
    'The ARRB was established by the JFK Records Act (P.L. 102-526) and operated from 1994 through 1998. It reviewed approximately 4 million pages, designated materials as assassination records (including the Zapruder film), and resolved agency postponement requests. Its 1998 Final Report concluded the Board\'s work; the Collection at NARA continues to receive tranches, most recently the 2025 EO 14176 drops and the January 2026 release.',
    null,null,null,'1994–1998', 17),

  ('duran','Silvia Duran','person',
    ['Silvia Duran','Sylvia Duran','Silvia Tirado Duran','Silvia Tirado de Duran'],
    'Mexican citizen employed at the Cuban Consulate in Mexico City in 1963; processed Oswald\'s visa inquiry during his September 27 visit. Testified before the Warren Commission by written statement and later before the HSCA.',
    'Silvia Duran was a receptionist at the Cuban Consulate in Mexico City when Oswald applied for a transit visa to Cuba via the Soviet Union in late September 1963. She processed the unsuccessful application and spoke with Oswald over several visits beginning September 27. The Mexican government detained and interrogated her at U.S. request on November 23, 1963. Her account across multiple interviews — a written statement provided to the Warren Commission, an interview with Mexican authorities, and live HSCA testimony in 1978 — is a central thread in the Mexico City record.',
    null,'1937-02-01',null,'1963–present', 18),

  ('phillips','David Atlee Phillips','person',
    ['David Atlee Phillips','David Phillips','D. A. Phillips','Maurice Bishop'],
    'CIA Chief of Covert Action, Mexico City station (1961–1965), with primary responsibility for Cuban operations. His role in the pre- and post-assassination Oswald cables is documented across HSCA and ARRB releases.',
    'David Atlee Phillips joined the CIA in 1950 and served in Havana, Beirut, Mexico City, and Washington. From 1961 to 1965 he was Chief of Covert Action at the Mexico City station, with primary responsibility for Cuban operations including propaganda and anti-Castro work. HSCA testimony from Antonio Veciana identified Phillips as the man Veciana knew as "Maurice Bishop," an allegation Phillips denied and the HSCA did not conclusively resolve. Phillips retired from the CIA in 1975 and founded the Association of Former Intelligence Officers.',
    null,'1922-10-31','1988-07-07','1950–1975', 19),

  ('win-scott','Winston "Win" Scott','person',
    ['Win Scott','Winston Scott','Winston M. Scott','Winston MacKinley Scott'],
    'CIA Chief of Station in Mexico City from 1956 to 1969, including the period of Oswald\'s September–October 1963 visit.',
    'Winston "Win" Scott ran one of the CIA\'s most active stations for 13 years. His office supervised the LIENVOY telephone intercepts, LIEMPTY Soviet-embassy photo surveillance, and LIHUFF/LIONION Cuban-target operations. Scott died in 1971; Jim Angleton personally traveled to Mexico to retrieve his safe contents and manuscript materials, a matter later examined by the HSCA and ARRB.',
    null,'1909-03-30','1971-04-26','1956–1969', 20),

  -- ============================================================
  -- Wave 2 — Mexico City + AMLASH narrative (added April 2026)
  -- ============================================================

  ('kostikov','Valeriy Kostikov','person',
    ['Valeriy Kostikov','Valery Kostikov','V. V. Kostikov','Valeriy Vladimirovich Kostikov'],
    'KGB officer assigned to the Soviet Embassy in Mexico City; cited in CIA cables as a member of the KGB\'s Department 13 (Executive Action). Met with Oswald during the September 28, 1963 contact at the Soviet consulate.',
    'Valeriy Kostikov was a Soviet diplomat under cover at the Soviet Embassy in Mexico City from 1961 to 1965. CIA Mexico City station cables and the Lopez Report (1978) identify him as KGB and place him in the Department 13 (Executive Action) line of the residency. CIA monitoring captured a documented contact between Oswald and Kostikov on September 28, 1963 at the Soviet consulate. The contact, and the agency\'s subsequent handling of cables describing it, was a central topic of the HSCA\'s investigation of CIA pre-assassination knowledge of Oswald.',
    null,null,null,'1961–1965', 21),

  ('de-mohrenschildt','George de Mohrenschildt','person',
    ['George de Mohrenschildt','Jerzy Sergius von Mohrenschildt','George S. de Mohrenschildt','de Mohrenschildt'],
    'Russian-born petroleum geologist in the Dallas-Fort Worth émigré circle who befriended Lee and Marina Oswald in 1962-1963. Testified before the Warren Commission in April 1964; died by suicide on March 29, 1977, hours after being contacted by an HSCA investigator.',
    'George de Mohrenschildt was born in 1911 in what is now Belarus to a noble Russian family that emigrated after the Bolshevik Revolution. He arrived in the United States in 1938, served in the OSS during WWII, and worked as a petroleum geologist on consulting assignments across Europe, Africa, and Latin America. He and his wife Jeanne were active in the Russian-speaking émigré community in Dallas-Fort Worth and became close to Lee and Marina Oswald between October 1962 and April 1963. He testified to the Warren Commission on April 22-23, 1964 (WC Vol. 9). On March 29, 1977 — hours after HSCA investigator Gaeton Fonzi delivered a request for an interview at his daughter\'s residence in Manalapan, Florida — de Mohrenschildt was found dead of a self-inflicted shotgun wound. The HSCA included his death in its final review of the chronology of witness mortality.',
    null,'1911-04-17','1977-03-29','1962–1963', 22),

  ('cubela','Rolando Cubela Secades','person',
    ['Rolando Cubela','Rolando Cubela Secades','Cubela','AMLASH-1','AMLASH/1'],
    'Cuban Army officer and former July 26 Movement comandante recruited by the CIA under the cryptonym AMLASH-1 in 1961-1965 to assassinate Fidel Castro. Met with his CIA case officer in Paris on November 22, 1963, the day President Kennedy was killed.',
    'Rolando Cubela Secades was a Cuban revolutionary who fought in the Sierra Maestra alongside Fidel Castro and held senior roles in the post-revolution Cuban government. The CIA designated him AMLASH-1 in the program of the same name, beginning operational contacts in 1961. On November 22, 1963, Cubela met with his CIA case officer in Paris; the meeting and timing are documented in the Church Committee\'s 1975 Interim Report on Alleged Assassination Plots Involving Foreign Leaders. Cuban authorities arrested Cubela in 1966 along with co-conspirators; he was sentenced to 25 years in the same year and released in 1979. He spent the remainder of his life in Spain.',
    null,'1932-09-09',null,'1957–1979', 23)
]);
