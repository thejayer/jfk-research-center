-- 22a_established_facts.sql
--
-- Purpose:
--   Symmetric counterweight to Open Questions. Where the Open Questions
--   pipeline surfaces tensions, contradictions, and unresolved threads,
--   the established_facts table catalogs the case\'s settled and
--   well-supported findings, with source citations. Rendered at
--   /established-facts alongside the existing /open-questions.
--
--   Addresses the 2026-04-18 audit finding that Open Questions was
--   unbalanced by any Established Facts counterpart. Part of Phase 2-C.
--
-- Schema:
--   fact_id              Stable slug (e.g. \'ef-single-bullet-geometry\').
--   topic_id             Topic slug this fact belongs to.
--   claim                One-sentence assertion.
--   long_form            1-2 paragraph archival discussion.
--   supporting_naids     NAIDs that document the fact.
--   supporting_citations citation_registry IDs (sql/23).
--   category             ballistic | witness | medical | chronology |
--                        documentary | operational | legal
--   confidence           Settled | Well-supported | Contested
--   sort_order           Display order within a topic.
--
-- Confidence tiers:
--   Settled         — agreed across WC, HSCA, ARRB; no credible dispute.
--   Well-supported  — agreed by most official investigations; some
--                     minority critique exists but the record is strong.
--   Contested       — the record itself is inconsistent across
--                     investigative bodies or on the evidence.
--
-- Dependencies: (none — curated data)

create or replace table jfk_curated.established_facts as
select * from unnest([
  struct<
    fact_id              string,
    topic_id             string,
    claim                string,
    long_form            string,
    supporting_naids     array<string>,
    supporting_citations array<string>,
    category             string,
    confidence           string,
    sort_order           int64
  >(
    -- ============================================================
    -- BALLISTIC / PHYSICAL EVIDENCE
    -- ============================================================
    'ef-carcano-ownership',
    'warren-commission',
    'The Mannlicher-Carcano rifle found on the sixth floor of the Texas School Book Depository was purchased by Lee Harvey Oswald through a mail-order under the alias "A. Hidell."',
    'In March 1963, an order form signed "A. Hidell" was sent to Klein\'s Sporting Goods of Chicago, with payment by postal money order drawn on a U.S. Post Office account in Dallas in the name of "A. Hidell." The rifle (CE-139, serial C-2766) was shipped to P.O. Box 2915, Dallas, which had been rented by Oswald. FBI Laboratory handwriting analysis matched the signature to known samples of Oswald\'s handwriting. Marina Oswald and Ruth Paine both testified to having seen the rifle in the Paine garage.',
    cast([] as array<string>),
    ['WC-REPORT', 'WC-HEARINGS-V3'],
    'ballistic',
    'Settled',
    1
  ),
  ('ef-carcano-source-ballistics',
    'warren-commission',
    'The three spent hulls (CE-543/544/545) from the sniper\'s nest and the bullet CE-399 were fired from the same rifle, CE-139.',
    'FBI Laboratory ballistic comparison in November 1963, and independent HSCA forensic panel re-testing in 1978, both matched the three 6.5mm cartridge cases recovered from the TSBD sixth floor and the near-intact bullet recovered at Parkland Hospital to the Mannlicher-Carcano rifle (CE-139) found by DPD on the sixth floor. No alternative source has been forensically supported.',
    cast([] as array<string>),
    ['WC-REPORT', 'WC-HEARINGS-V3', 'HSCA-REPORT'],
    'ballistic',
    'Settled',
    2
  ),
  ('ef-single-bullet-geometry',
    'warren-commission',
    'The geometry of the limousine, the Kennedy and Connally wounds, and the 6.5mm bullet trajectory is consistent with a single round having caused all of President Kennedy\'s non-fatal wounds and all of Governor Connally\'s wounds.',
    'The Warren Commission concluded a single bullet caused both men\'s non-fatal wounds. The HSCA in 1978 reviewed limousine seating reconstruction and forensic pathology and affirmed the single-bullet theory as a plausible and probable account. The National Academy of Sciences (Ramsey Panel) 1982 review did not disturb this finding. The geometry is sometimes mischaracterized as requiring wounds at different heights; the actual seat positions and jump-seat offset are consistent with a single round.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'NAS-RAMSEY-1982'],
    'ballistic',
    'Well-supported',
    3
  ),
  ('ef-shots-fired-three',
    'warren-commission',
    'Three shots were fired at the motorcade during the assassination.',
    'The three spent cartridge cases recovered from the sniper\'s nest are direct physical evidence of three shots. Most eyewitnesses reported hearing three reports; a minority reported two or four. The HSCA acoustic analysis (1978) initially suggested a fourth shot, but the National Academy of Sciences Ramsey Panel (1982) rejected that acoustic conclusion. The physical and witness record converges on three shots.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'NAS-RAMSEY-1982'],
    'ballistic',
    'Well-supported',
    4
  ),

  -- ============================================================
  -- WITNESS / TIPPIT
  -- ============================================================
  ('ef-tippit-eyewitness-id',
    'tippit-murder',
    'Nine eyewitnesses identified Lee Harvey Oswald as the gunman in the murder of Dallas Police Officer J. D. Tippit.',
    'Warren Commission Report, Chapter 4 and Appendix 11 document the identifications. At least six witnesses (Helen Markham, Domingo Benavides, Barbara Jeanette Davis, Virginia Davis, Ted Callaway, Sam Guinyard) either saw the shooting directly or saw the gunman flee immediately after; several later picked Oswald out of police lineups. Additional identifications came from the Texas Theatre arrest scene.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'witness',
    'Well-supported',
    10
  ),
  ('ef-tippit-shells-match',
    'tippit-murder',
    'The four .38 Special cartridge cases recovered at the Tippit scene were fired from the Smith & Wesson revolver (CE-143) in Oswald\'s possession when he was arrested at the Texas Theatre.',
    'FBI Laboratory ballistic comparison matched all four shell casings (two Remington-Peters and two Winchester-Western) to the revolver Oswald was carrying at the time of arrest. No alternative firearm has been forensically established.',
    cast([] as array<string>),
    ['WC-REPORT', 'WC-HEARINGS-V3'],
    'ballistic',
    'Settled',
    11
  ),
  ('ef-tippit-timing',
    'tippit-murder',
    'Officer Tippit was shot at approximately 1:15 p.m. CST on November 22, 1963, at East 10th Street and Patton Avenue in Oak Cliff.',
    'Multiple independent timing anchors — the DPD dispatch recording, witness statements, and the call recording from a witness who used Tippit\'s patrol-car radio — place the shooting between 1:10 and 1:17 p.m. CST. This was approximately 45 minutes after the assassination of President Kennedy.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'chronology',
    'Settled',
    12
  ),

  -- ============================================================
  -- MEDICAL / AUTOPSY
  -- ============================================================
  ('ef-parkland-death',
    'warren-commission',
    'President Kennedy was pronounced dead at 1:00 p.m. CST on November 22, 1963, at Parkland Memorial Hospital in Dallas.',
    'Parkland doctors including Malcolm Perry, Charles Carrico, and Kemp Clark attended to the President. Resuscitation was unsuccessful; a tracheostomy had been performed over a small wound in the anterior neck. Time of death was formally recorded at 1:00 p.m. CST by Father Oscar Huber\'s arrival for the last rites or by Dr. Clark\'s pronouncement, per different accounts.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'chronology',
    'Settled',
    20
  ),
  ('ef-autopsy-head-wound',
    'warren-commission',
    'The fatal head wound entered the back of the President\'s skull and exited from the right side.',
    'The Bethesda autopsy (CE-387) by Drs. Humes, Boswell, and Finck concluded the fatal shot entered the posterior skull and exited anteriorly. The 1968 Clark Panel, the 1975 Rockefeller Commission medical review, the 1978 HSCA forensic pathology panel, and the 1998 ARRB record all confirmed the back-to-front trajectory. Some medical-evidence reviewers have disputed the exact entry-wound location on the skull (higher or lower), but no official review has concluded the shot came from anywhere other than behind.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'CLARK-PANEL-1968', 'ARRB-FINAL'],
    'medical',
    'Well-supported',
    21
  ),
  ('ef-autopsy-entry-wound-location',
    'warren-commission',
    'The precise location of the back-of-head entry wound on the skull is contested across the medical record.',
    'The Bethesda autopsy report placed the entry wound low on the occiput. The 1968 Clark Panel and 1978 HSCA forensic pathology panel relocated it approximately 10 cm higher on the skull, citing photographic and X-ray re-examination. The ARRB gathered additional witness statements that the original autopsy team had marked a lower wound in photographs. The location matters because a higher entry better fits a sixth-floor TSBD trajectory. The record itself is inconsistent on this point.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'CLARK-PANEL-1968', 'ARRB-FINAL'],
    'medical',
    'Contested',
    22
  ),

  -- ============================================================
  -- CHRONOLOGY / MOTORCADE
  -- ============================================================
  ('ef-motorcade-timing',
    'dealey-plaza',
    'President Kennedy\'s motorcade entered Dealey Plaza at approximately 12:29 p.m. CST; the shots were fired at approximately 12:30 p.m. CST.',
    'The exact second of the first shot has been established by the Zapruder film at frame 160 (first observable Kennedy reaction) or frame 190 (earlier candidate). The motorcade\'s entry timing is anchored by Dallas WFAA radio coverage and multiple agency logs. Zapruder frame 313 shows the fatal head shot.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT'],
    'chronology',
    'Settled',
    30
  ),
  ('ef-motorcade-route-published',
    'dealey-plaza',
    'The Dallas motorcade route was published in the Dallas Times Herald and Dallas Morning News 72+ hours before the assassination.',
    'The Dallas Times Herald printed the route on November 19, 1963, and the Dallas Morning News printed it on November 18 and 19. The route along Main Street, Houston Street, and Elm Street through Dealey Plaza was therefore publicly known before the motorcade\'s arrival. This is often misremembered as a last-minute change; contemporaneous newspaper records establish it was public.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'documentary',
    'Settled',
    31
  ),
  ('ef-elm-street-turn',
    'dealey-plaza',
    'The motorcade\'s turn from Houston Street onto Elm Street slowed the limousine to approximately 11 mph as it passed the Texas School Book Depository.',
    'The Warren Commission\'s reconstruction, corroborated by the Zapruder film frame analysis, establishes the slow speed. This geometry is relevant to the firing solution from the sixth floor.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'operational',
    'Settled',
    32
  ),

  -- ============================================================
  -- OSWALD / ARREST / DEATH
  -- ============================================================
  ('ef-oswald-arrest',
    'tippit-murder',
    'Oswald was arrested inside the Texas Theatre at 231 West Jefferson Boulevard, Oak Cliff, at approximately 1:50 p.m. CST on November 22, 1963.',
    'DPD Officer M. N. McDonald testified to the arrest. Oswald drew the .38 revolver (CE-143) but the weapon misfired or was deflected; he was subdued and removed to DPD headquarters. The arrest has never been credibly disputed.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'chronology',
    'Settled',
    40
  ),
  ('ef-oswald-charged-both',
    'tippit-murder',
    'Oswald was charged with both the Tippit murder and the Kennedy assassination on November 22, 1963.',
    'The Tippit murder charge was filed at approximately 7:05 p.m. CST on November 22; the assassination charge was filed at approximately 1:35 a.m. CST on November 23 (still the same operational day from a police perspective). Both charges stood at the time of Oswald\'s death two days later.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'legal',
    'Settled',
    41
  ),
  ('ef-oswald-shot-by-ruby',
    'warren-commission',
    'Jack Ruby shot Lee Harvey Oswald at approximately 11:21 a.m. CST on November 24, 1963, in the basement of Dallas Police Headquarters.',
    'The shooting was broadcast live on NBC television and filmed by multiple outlets. Ruby was immediately restrained; Oswald was pronounced dead at 1:07 p.m. CST at Parkland Memorial Hospital. Ruby was subsequently tried and convicted of murder on March 14, 1964; the conviction was reversed on appeal October 5, 1966.',
    cast([] as array<string>),
    ['WC-REPORT', 'RUBY-V-TEXAS-1966'],
    'chronology',
    'Settled',
    42
  ),

  -- ============================================================
  -- INVESTIGATIVE RECORD / WC + HSCA
  -- ============================================================
  ('ef-wc-conclusion-oswald',
    'warren-commission',
    'The Warren Commission concluded that Lee Harvey Oswald acted alone in assassinating President Kennedy and in murdering Officer Tippit.',
    'The Commission\'s 888-page final report, delivered September 24, 1964, and released September 27, 1964, states: "The Commission has found no evidence that either Lee Harvey Oswald or Jack Ruby was part of any conspiracy, domestic or foreign, to assassinate President Kennedy." This remains the official conclusion of the first federal investigation.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'documentary',
    'Settled',
    50
  ),
  ('ef-hsca-probable-conspiracy',
    'hsca',
    'The House Select Committee on Assassinations concluded in 1979 that President Kennedy was "probably assassinated as a result of a conspiracy," based significantly on acoustic evidence later rejected by the NAS.',
    'The HSCA Final Report (March 29, 1979) reached this conclusion primarily on the basis of an acoustic analysis of a DPD dispatch dictabelt recording that appeared to show a fourth shot from the grassy knoll. The 1982 National Academy of Sciences (Ramsey Panel) report rejected the acoustic analysis. The Department of Justice in 1988 declined to reopen the investigation, citing the NAS findings.',
    cast([] as array<string>),
    ['HSCA-REPORT', 'NAS-RAMSEY-1982', 'DOJ-1988-LETTER'],
    'documentary',
    'Contested',
    51
  ),
  ('ef-nas-rejects-acoustic',
    'hsca',
    'The 1982 National Academy of Sciences (Ramsey Panel) rejected the HSCA\'s acoustic-analysis conclusion of a fourth shot.',
    'The NAS Committee on Ballistic Acoustics, chaired by Norman Ramsey, reviewed the DPD dictabelt recording the HSCA had used and concluded the timing markers did not correspond to shots. The NAS found that the sounds the HSCA had interpreted as gunfire occurred approximately one minute after the assassination, when the dispatch channel was already recording the Presidential limousine at Parkland Hospital.',
    cast([] as array<string>),
    ['NAS-RAMSEY-1982'],
    'documentary',
    'Settled',
    52
  ),

  -- ============================================================
  -- OSWALD BIOGRAPHY
  -- ============================================================
  ('ef-oswald-mexico-visit',
    'mexico-city',
    'Lee Harvey Oswald visited Mexico City between approximately September 27 and October 2, 1963, and contacted both the Cuban Consulate and the Soviet Embassy.',
    'CIA Mexico City station telephone intercept summaries (LIENVOY) and visa-application records at the Cuban Consulate document the visits. No visa was issued. The content and purpose of Oswald\'s contacts with the embassies is one of the most examined questions in the JFK record.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'ARRB-FINAL'],
    'chronology',
    'Settled',
    60
  ),
  ('ef-oswald-defection',
    'cia',
    'Oswald defected to the Soviet Union in October 1959 and was resident in Minsk from January 1960 through June 1962.',
    'Oswald appeared at the U.S. Embassy in Moscow on October 31, 1959, and declared his intent to renounce U.S. citizenship. He was allowed to reside in the Soviet Union, working at the Gorizont radio and television factory in Minsk. He married Marina Prusakova in April 1961. The family returned to the United States on June 13, 1962.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'chronology',
    'Settled',
    61
  ),

  -- ============================================================
  -- INTELLIGENCE / CIA
  -- ============================================================
  ('ef-cia-amlash-operation',
    'mob-castro-plots',
    'The CIA ran an operation code-named AMLASH aimed at the assassination of Fidel Castro, centered on recruited asset Rolando Cubela Secades.',
    'The AMLASH operation is documented in Church Committee Book V (1976), CIA internal histories subsequently declassified, and HSCA staff files. On November 22, 1963, CIA case officer Nestor Sanchez met Cubela in Paris and passed him a device for assassinating Castro; the meeting was taking place at approximately the same time as the assassination of President Kennedy. The operational coincidence is well-established.',
    cast([] as array<string>),
    ['CHURCH-BOOK-V', 'HSCA-REPORT', 'ARRB-FINAL'],
    'operational',
    'Settled',
    70
  ),
  ('ef-cia-mafia-plots',
    'mob-castro-plots',
    'The CIA used organized-crime intermediaries — including Santo Trafficante Jr., Sam Giancana, and Johnny Roselli — in earlier assassination plots against Fidel Castro.',
    'The Church Committee (1975-76) documented these plots in detail in its Interim Report on Alleged Assassination Plots Involving Foreign Leaders (November 1975) and Book V (April 1976). The plots were operationally active between 1960 and approximately 1963.',
    cast([] as array<string>),
    ['CHURCH-BOOK-V'],
    'operational',
    'Settled',
    71
  ),
  ('ef-cia-201-file',
    'cia',
    'The CIA opened a 201 personality file on Lee Harvey Oswald in December 1960, approximately 14 months after his defection.',
    'The opening of the 201 file is documented in ARRB-era declassifications. The 14-month lag between defection and file opening, and the internal-routing questions about which CIA elements knew of Oswald pre-assassination, have been examined at length by the Church Committee, the HSCA, and the ARRB. The existence and date of the 201 file are settled; the interpretive questions around it remain open.',
    cast([] as array<string>),
    ['CHURCH-BOOK-V', 'HSCA-REPORT', 'ARRB-FINAL'],
    'documentary',
    'Settled',
    72
  ),

  -- ============================================================
  -- INVESTIGATIVE BODIES
  -- ============================================================
  ('ef-wc-witnesses',
    'warren-commission',
    'The Warren Commission took testimony from 552 witnesses.',
    'Per the Commission\'s own Foreword: 94 appeared before the Commission directly, 395 testified by staff deposition, 61 provided affidavits, and 2 provided statements. The 26 volumes of Hearings and Exhibits published November 1964 contain the record.',
    cast([] as array<string>),
    ['WC-REPORT'],
    'documentary',
    'Settled',
    80
  ),
  ('ef-hsca-volumes',
    'hsca',
    'The HSCA published 12 volumes of appendices alongside its 1979 Final Report.',
    'The appendix volumes contain forensic pathology panels, photographic evidence panels, acoustics analysis, ballistics analysis, medical evidence, witness depositions, and staff reports. The volumes total several thousand pages and are part of the JFK Assassination Records Collection.',
    cast([] as array<string>),
    ['HSCA-REPORT'],
    'documentary',
    'Settled',
    81
  ),
  ('ef-arrb-records-act',
    'arrb-releases',
    'The JFK Records Act of 1992 created the JFK Assassination Records Collection and the Assassination Records Review Board.',
    'Public Law 102-526, signed October 26, 1992, established the Collection at NARA, directed all federal agencies to transfer their assassination-related records, and created the five-member ARRB to review agency postponement requests. The Board operated 1994-1998 and declassified materials totaling approximately 4 million pages.',
    cast([] as array<string>),
    ['JFK-RECORDS-ACT', 'ARRB-FINAL'],
    'legal',
    'Settled',
    82
  ),
  ('ef-arrb-zapruder-acquisition',
    'arrb-releases',
    'The federal government acquired the original Zapruder film in 1999 via the ARRB\'s assassination-record designation.',
    'The ARRB formally declared the original film an assassination record on April 24, 1997. The U.S. Government acquired it from the Zapruder family in 1999 for $16 million following an arbitration proceeding.',
    cast([] as array<string>),
    ['ARRB-FINAL'],
    'legal',
    'Settled',
    83
  ),

  -- ============================================================
  -- RUBY
  -- ============================================================
  ('ef-ruby-conviction',
    'warren-commission',
    'Jack Ruby was convicted of the murder of Lee Harvey Oswald on March 14, 1964, and sentenced to death.',
    'The Dallas County trial concluded with a death sentence by a jury. Ruby\'s appeal argued jury prejudice and improperly admitted testimony. The Texas Court of Criminal Appeals reversed the conviction on October 5, 1966.',
    cast([] as array<string>),
    ['WC-REPORT', 'RUBY-V-TEXAS-1966'],
    'legal',
    'Settled',
    90
  ),
  ('ef-ruby-death',
    'warren-commission',
    'Jack Ruby died January 3, 1967, at Parkland Memorial Hospital of a pulmonary embolism during treatment for lung cancer.',
    'Ruby had been diagnosed with lung cancer during his appeal process. A pulmonary embolism precipitated by the cancer treatment caused his death before the retrial could be held.',
    cast([] as array<string>),
    cast([] as array<string>),
    'chronology',
    'Settled',
    91
  ),

  -- ============================================================
  -- CONNALLY
  -- ============================================================
  ('ef-connally-wounds',
    'warren-commission',
    'Governor John Connally sustained wounds to the back, chest, right wrist, and left thigh on November 22, 1963; he survived and testified extensively.',
    'Connally was hit by a single round, per the single-bullet analysis, which entered his back, exited his chest, shattered his right wrist, and came to rest in his left thigh. He underwent surgery at Parkland and recovered; he appeared before the Warren Commission in 1964 and the HSCA in 1978.',
    cast([] as array<string>),
    ['WC-REPORT', 'WC-HEARINGS-V4', 'HSCA-REPORT'],
    'medical',
    'Settled',
    100
  ),

  -- ============================================================
  -- ZAPRUDER FILM
  -- ============================================================
  ('ef-zapruder-frames',
    'dealey-plaza',
    'The Zapruder film is a continuous 8mm color home movie whose principal evidentiary content spans frames 133-486, with frame 313 capturing the fatal head shot.',
    'Abraham Zapruder filmed the motorcade from a concrete pergola on the north side of Elm Street. The 26-second sequence was examined frame-by-frame by the Warren Commission, the HSCA photographic evidence panel, and the ARRB. The film is one of the most studied pieces of visual evidence in any criminal investigation.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT', 'ARRB-FINAL'],
    'documentary',
    'Settled',
    110
  ),

  -- ============================================================
  -- SURVEILLANCE CONTEXT
  -- ============================================================
  ('ef-oswald-pre-known',
    'cia',
    'Multiple U.S. agencies had pre-assassination files on Lee Harvey Oswald.',
    'The CIA had its 201 personality file (opened December 1960). The FBI had a Headquarters file (105-82555) and a Dallas Field Office file (100-10461). The Department of State and the INS had files relating to his defection, renunciation, and return. The existence of these files is settled; the degree of pre-assassination knowledge and inter-agency coordination around Oswald is examined in the Church Committee, HSCA, and ARRB records.',
    cast([] as array<string>),
    ['CHURCH-BOOK-V', 'HSCA-REPORT', 'ARRB-FINAL'],
    'documentary',
    'Settled',
    120
  ),

  -- ============================================================
  -- FBI / DALLAS INVESTIGATION
  -- ============================================================
  ('ef-fbi-lead-investigation',
    'fbi',
    'The FBI was the lead federal agency for the assassination investigation; it produced the majority of the evidentiary record relied upon by the Warren Commission.',
    'President Johnson directed the FBI to investigate on November 22, 1963. By December the Bureau had submitted its report (CD-1) to the Warren Commission. The Bureau\'s FD-302 interview reports, ballistic reports, and handwriting analyses form a core layer of the WC record. The HSCA subsequently reviewed FBI conduct and identified specific gaps (notably early-period interactions with Oswald) but did not challenge the overall investigative framework.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT'],
    'documentary',
    'Settled',
    130
  ),

  -- ============================================================
  -- DOCUMENTARY BASE RATES
  -- ============================================================
  ('ef-records-act-scope',
    'arrb-releases',
    'The JFK Assassination Records Collection contains approximately 5 million pages of records across multiple federal agencies.',
    'The Collection aggregates Warren Commission, HSCA, ARRB, FBI, CIA, Secret Service, Department of State, Department of Defense, and other agency holdings. Release tranches continue as of the 2025-2026 EO 14176 drops. No comparable assassination collection exists for any other world leader.',
    cast([] as array<string>),
    ['JFK-RECORDS-ACT', 'ARRB-FINAL', 'NARA-JFK-MAIN'],
    'documentary',
    'Settled',
    140
  ),

  -- ============================================================
  -- CONTESTED / OPEN AREAS (explicitly tagged as Contested)
  -- ============================================================
  ('ef-oswald-motive',
    'warren-commission',
    'The motive for Lee Harvey Oswald\'s actions on November 22, 1963, is not established by the record.',
    'The Warren Commission examined Oswald\'s biographical record, Marxist reading, Mexico City travel, and prior shooting at General Walker\'s residence, but reached no firm conclusion as to motive. The HSCA made no independent motive finding. The question of why Oswald acted is consequently not a settled question in the official record, even where the what and how are.',
    cast([] as array<string>),
    ['WC-REPORT', 'HSCA-REPORT'],
    'documentary',
    'Contested',
    150
  ),
  ('ef-cia-fbi-withholding',
    'cia',
    'Both the CIA and FBI withheld specific categories of pre-assassination information from the Warren Commission.',
    'The Church Committee (1976) and the ARRB (1998) documented specific withholdings, including CIA-mafia plot information, certain Mexico City-related materials, and FBI-Oswald pre-assassination contact records. Both bodies concluded the withholding was material to the Commission\'s work. The withholding is documented; its substantive effect on the Commission\'s central conclusions has been disputed.',
    cast([] as array<string>),
    ['CHURCH-BOOK-V', 'ARRB-FINAL'],
    'documentary',
    'Contested',
    151
  )
]);
