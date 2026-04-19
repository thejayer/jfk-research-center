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
    null,'1932-09-09',null,'1957–1979', 23),

  -- ============================================================
  -- Wave 3 — Warren Commission counsel, mob / CIA-mob triad,
  --          Garrison prosecution, CIA Mexico City / CI staff
  --          (added April 2026)
  -- ============================================================

  ('specter','Arlen Specter','person',
    ['Arlen Specter','Senator Specter','Arlen Spector'],
    'Assistant counsel on the Warren Commission (1964) who drafted Chapter III of the Warren Report and is known as the principal author of the single-bullet conclusion. Later served five terms as a U.S. Senator from Pennsylvania (1981–2011).',
    'Arlen Specter (1930–2012) was a junior assistant counsel on the Warren Commission, assigned to Area I (Basic Facts of the Assassination). He is primarily known as the author of the single-bullet conclusion — the finding that one bullet, later designated Warren Commission Exhibit 399, caused President Kennedy\'s non-fatal wounds and all of Governor John Connally\'s wounds. Specter conducted the bulk of the Commission\'s autopsy-related depositions and drafted Chapter III of the Warren Report. He later served five terms as a U.S. Senator from Pennsylvania (1981–2011). Critics of the Warren Commission have long contested the single-bullet conclusion on trajectory, timing, and bullet-condition grounds; Specter defended the finding in subsequent books and interviews throughout his life.',
    null,'1930-02-12','2012-10-14','1964; 1981–2011', 24),

  ('marcello','Carlos Marcello','person',
    ['Carlos Marcello','Calogero Minacore','the Little Man'],
    'Head of the New Orleans organized-crime family from 1947 until his 1980s incarceration. A primary target of Robert Kennedy\'s organized-crime task force; HSCA concluded he had "motive, means, and opportunity" to assassinate President Kennedy but found no direct evidence of participation.',
    'Carlos Marcello (born Calogero Minacore, 1910–1993) was the head of the New Orleans organized-crime family from 1947 until his incarceration in the 1980s. Marcello became a target of Attorney General Robert F. Kennedy\'s organized-crime task force and was summarily deported to Guatemala on April 4, 1961; he re-entered the United States within months and resumed operations. The House Select Committee on Assassinations (HSCA) examined Marcello closely in its 1976–79 investigation and concluded in its Final Report that Marcello "had the motive, means, and opportunity" to assassinate President Kennedy, while also finding no direct evidence that he did. An FBI informant, Edward Becker, reported that Marcello made a 1962 threat against the Kennedys; the FBI investigated the allegation, and the HSCA reviewed but could not corroborate it. Marcello denied involvement under oath to the HSCA in January 1978.',
    null,'1910-02-06','1993-03-02','1947–1980s', 25),

  ('trafficante','Santo Trafficante Jr.','person',
    ['Santo Trafficante','Santo Trafficante Jr.','Santos Trafficante'],
    'Head of the Tampa, Florida organized-crime family and one of three Mafia figures the CIA recruited through Robert Maheu in the 1960–1963 Castro assassination plots. Testified before the Church Committee (1975) and the HSCA (1978) under immunity.',
    'Santo Trafficante Jr. (1914–1987) was the head of the Tampa, Florida organized-crime family and one of three Mafia figures the CIA recruited in the 1960–1963 plots to assassinate Fidel Castro, alongside Johnny Roselli and Sam Giancana. Before the 1959 Cuban Revolution, Trafficante ran casino operations in Havana under Batista; he was briefly detained by Castro\'s government in 1959. Trafficante testified before the Church Committee in 1975 and, under a court-ordered grant of immunity, before the House Select Committee on Assassinations on September 28, 1978, where he described his role in the Castro plots primarily as that of an interpreter. The HSCA Final Report concluded that Trafficante, like Marcello, had the motive and opportunity to be involved in the Kennedy assassination but that the committee could not establish direct involvement. Trafficante was named by federal investigators as the most likely person to have ordered the 1976 murder of Johnny Roselli.',
    null,'1914-11-15','1987-03-17','1954–1987', 26),

  ('giancana','Sam Giancana','person',
    ['Sam Giancana','Momo Salvatore Giancana','Sam Mooney Giancana','Gilormo Giangana'],
    'Head of the Chicago Outfit during much of the Kennedy era and one of three Mafia figures the CIA recruited through Robert Maheu in the 1960–1963 Castro plots. Murdered in his Oak Park, Illinois home on June 19, 1975, five days before Johnny Roselli\'s Church Committee testimony.',
    'Sam Giancana (1908–1975) led the Chicago Outfit during much of the Kennedy era. Alongside Johnny Roselli and Santo Trafficante Jr., Giancana was one of the three Mafia figures the CIA recruited through intermediary Robert Maheu in the 1960–1963 plots to assassinate Fidel Castro. The Church Committee confirmed the broad outlines of this relationship in its 1975 Interim Report on Alleged Assassination Plots Involving Foreign Leaders. Giancana was scheduled to testify before the Church Committee and was shot to death in the basement of his Oak Park, Illinois home on June 19, 1975, five days before Roselli\'s scheduled testimony. His killing remains unsolved. Because Giancana was also linked — through Judith Campbell Exner — to President Kennedy during 1961, his name features in several theories connecting the Mafia, the CIA-Castro plots, and the Dallas assassination; the HSCA examined these links and declined to find direct mob involvement in the assassination.',
    null,'1908-06-15','1975-06-19','1957–1975', 27),

  ('roselli','Johnny Roselli','person',
    ['Johnny Roselli','John Roselli','Filippo Sacco','Handsome Johnny'],
    'Los Angeles–based Mafia operative recruited by the CIA via Robert Maheu in 1960 to help organize the assassination of Fidel Castro. Testified before the Church Committee (June and September 1975) and HSCA (1976); found dismembered in an oil drum in Dumfoundling Bay, Florida, August 7, 1976.',
    'Johnny Roselli (born Filippo Sacco, 1905–1976) was a Los Angeles–based Mafia operative known for brokering business between the Chicago Outfit, Hollywood, and Las Vegas. In 1960, via intermediary Robert Maheu, Roselli was recruited by the CIA to help organize the assassination of Fidel Castro, alongside Sam Giancana and Santo Trafficante Jr. Roselli testified before the Church Committee on June 24, 1975 and on September 22, 1975 about the CIA-mob Castro plots, and appeared before the House Select Committee on Assassinations in 1976. He was scheduled for additional HSCA testimony when he disappeared on July 28, 1976; his dismembered body was found in a 55-gallon oil drum in Dumfoundling Bay, Florida on August 7, 1976. An FBI investigation identified Santo Trafficante Jr. as the most likely figure to have ordered the killing; the murder remains officially unsolved. A 1977 New York Times investigation concluded that Roselli was killed as a direct consequence of his Senate testimony.',
    null,'1905-07-04','1976-07-28','1923–1976', 28),

  ('garrison','Jim Garrison','person',
    ['Jim Garrison','James C. Garrison','Earling Carothers Garrison'],
    'Elected District Attorney of Orleans Parish, Louisiana (1962–1973). Opened the only criminal prosecution ever brought by a U.S. jurisdiction in the Kennedy assassination; his case against New Orleans businessman Clay Shaw ended in a one-hour acquittal on March 1, 1969.',
    'Jim Garrison (1921–1992) was the elected District Attorney of Orleans Parish, Louisiana from 1962 to 1973. In 1966 Garrison opened the only criminal investigation ever conducted by any U.S. jurisdiction into the assassination of President Kennedy. On March 1, 1967, Garrison arrested New Orleans businessman Clay Shaw on charges of conspiracy to assassinate the President. After a 40-day trial, a jury acquitted Shaw on March 1, 1969 after less than an hour of deliberation. Garrison\'s investigation has been variously characterized as a landmark independent inquiry, a prosecutorial overreach, and — by CIA internal documents later released — a target of CIA monitoring and counter-messaging. The 1978–79 House Select Committee on Assassinations examined Garrison\'s evidence and found it did not substantiate a conspiracy finding against Shaw. Garrison\'s 1988 book "On the Trail of the Assassins" was adapted into Oliver Stone\'s 1991 film "JFK".',
    null,'1921-11-20','1992-10-21','1962–1973', 29),

  ('clay-shaw','Clay Shaw','person',
    ['Clay Shaw','Clay L. Shaw','Clay Lavergne Shaw','Clay Bertrand'],
    'New Orleans businessman and founder of the International Trade Mart; the only person ever criminally tried for conspiracy in the Kennedy assassination. Acquitted by a jury in under one hour on March 1, 1969. Separately confirmed as a CIA Domestic Contact Service asset in 1950s–early 1960s.',
    'Clay L. Shaw (1913–1974) was a New Orleans businessman, founder and managing director of the International Trade Mart, and a decorated World War II veteran. On March 1, 1967, New Orleans District Attorney Jim Garrison arrested Shaw on charges of conspiring with Lee Harvey Oswald, David Ferrie, and others to assassinate President Kennedy. Garrison alleged that Shaw used the alias "Clay Bertrand" in New Orleans. After a 40-day trial (January 31 – March 1, 1969), a jury acquitted Shaw in under one hour. Shaw remains the only person ever criminally tried for conspiracy in the Kennedy assassination. Separately, it was later established — and confirmed in 1979 Congressional testimony by former CIA director Richard Helms — that Shaw had served as a contact for the CIA\'s Domestic Contact Service in the 1950s and early 1960s, a routine program that debriefed American businessmen traveling abroad. Shaw denied this connection at his trial; it is now documented but does not establish any link to the assassination.',
    null,'1913-03-17','1974-08-15','1947–1974', 30),

  ('goodpasture','Anne Goodpasture','person',
    ['Anne Goodpasture','Ann Goodpasture','Anne L. Goodpasture'],
    'Senior CIA case officer in the Mexico City station during Oswald\'s September–October 1963 visits to the Cuban and Soviet embassies. Deputy to station chief Win Scott; handled the LIENVOY wiretap and photo-surveillance product. Her 1995 and 1998 ARRB depositions are among the most detailed first-person records of the station.',
    'Anne Goodpasture (1926–2011) was a senior CIA case officer in the Mexico City station during Lee Harvey Oswald\'s visit to the Cuban and Soviet embassies in late September and early October 1963. As a deputy to station chief Win Scott, Goodpasture handled the station\'s photo-surveillance and wiretap product — including the LIENVOY and LIFEAT programs — and was responsible for coordinating cables to CIA headquarters about unusual visitors. Her two 1995 and 1998 depositions to the Assassinations Records Review Board (ARRB) are among the most detailed first-person accounts of the station\'s handling of Oswald-related intelligence and are heavily cited by later researchers. Goodpasture stated that David Atlee Phillips\'s account of why the Oswald name checked out routinely — involving a "lazy Soviet desk officer" — was not true; she also confirmed that Phillips was away from the station at CIA HQ and JMWAVE between September 30 and October 9, 1963.',
    null,'1926-01-05','2011-12-04','1950s–1970s', 31),

  ('jane-roman','Jane Roman','person',
    ['Jane Roman'],
    'Senior liaison officer in the CIA\'s Counterintelligence Staff (CI/Liaison) under James Angleton. Signed the October 10, 1963 headquarters cable to Mexico City that summarized pre-assassination CIA knowledge of Oswald, omitting FBI reports on his recent New Orleans activities. Acknowledged the omissions in 1994–95 interviews with historian John M. Newman.',
    'Jane Roman (1914–2008) was a senior liaison officer in the CIA\'s Counterintelligence Staff (CI/Liaison) under James Jesus Angleton during the period of Lee Harvey Oswald\'s pre-assassination CIA paper trail. Roman\'s signature appears on the October 10, 1963 cable from CIA headquarters to the Mexico City station responding to the station\'s report on Oswald\'s visits to the Cuban and Soviet embassies. That cable stated the agency had last reported on Oswald in May 1962 — a characterization that omitted multiple FBI reports on Oswald\'s 1963 Fair Play for Cuba Committee activities in New Orleans that had been routed through CIA in the weeks immediately prior. In 1994 and 1995 interviews with historian John M. Newman, Roman acknowledged the omissions and characterized the cable as "indicative of a keen interest in Oswald held on a need-to-know basis." Roman is not implicated in the assassination; her significance lies in documenting what CIA counterintelligence knew about Oswald before November 22, 1963 and how that knowledge was handled.',
    null,'1914-01-01','2008-01-01','1940s–1970s', 32)
]);
