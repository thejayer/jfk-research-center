-- 17_physical_evidence.sql
--
-- Purpose:
--   Hand-curated catalog of physical evidence from the assassination case
--   — ballistic, firearm, photographic, medical, documentary, clothing,
--   and environmental items. The current site indexes documentary
--   evidence (NARA records) heavily but has no surface for the physical
--   record: CE-399, the Carcano, the Zapruder film, the autopsy photos,
--   the Tippit shell casings, and so on. The 2026-04-18 audit flagged
--   this as a neutrality-balancing gap — Phase 1-E addresses it.
--
-- Schema:
--   evidence_id           e.g. 'CE-399', 'C-2766', 'Z-313', 'CE-133-A'
--   category              ballistic | firearm | photographic | medical
--                         | documentary | clothing | environmental
--   short_name            One-line label for listings.
--   long_description      2-4 sentence archival description. Neutral.
--   chain_of_custody      Ordered array of custodial transfers where
--                         known. Many items' chains are incomplete or
--                         contested; we only fill what is uncontroversial.
--   referenced_naids      NAIDs of NARA records discussing this item.
--   referenced_wc_testimony
--                         Warren Commission volume/witness/page triples
--                         where this item is examined.
--   related_entity_ids    Slugs in jfk_curated.jfk_entities.
--   image_url             Public-domain image link (archives.gov, NARA
--                         catalog, or Wikimedia Commons). Empty for items
--                         where we intentionally do not host an image
--                         (autopsy photographs — descriptions only).
--   image_credit          Attribution for the linked image.
--   sort_order            Display order within a category.
--
-- Dependencies: (none — curated data)

create or replace table jfk_curated.physical_evidence as
select * from unnest([
  struct<
    evidence_id                 string,
    category                    string,
    short_name                  string,
    long_description            string,
    chain_of_custody            array<struct<
                                  step_order int64,
                                  date       date,
                                  custodian  string,
                                  action     string
                                >>,
    referenced_naids            array<string>,
    referenced_wc_testimony     array<struct<
                                  volume  int64,
                                  witness string,
                                  page    int64
                                >>,
    related_entity_ids          array<string>,
    image_url                   string,
    image_credit                string,
    sort_order                  int64
  >(
    -- ============================================================
    -- BALLISTIC
    -- ============================================================
    'CE-399', 'ballistic', 'Commission Exhibit 399 ("stretcher bullet")',
    'A nearly intact 6.5mm Mannlicher-Carcano round recovered at Parkland Memorial Hospital on November 22, 1963. The bullet became the subject of the Commission\'s single-bullet analysis: ballistics matched the Carcano rifle (CE-139) found on the 6th floor of the Texas School Book Depository. Its relative lack of deformation has been the single most-contested physical item in the case, examined again by the HSCA forensic panel in 1978.',
    [
      struct<step_order int64, date date, custodian string, action string>(
        1, date '1963-11-22', 'Darrell Tomlinson (Parkland)',
        'Discovered on a stretcher in the hospital corridor and handed to hospital security chief O. P. Wright.'
      ),
      (2, date '1963-11-22', 'O. P. Wright (Parkland)',
       'Handed the bullet to Secret Service Special Agent Richard E. Johnsen.'),
      (3, date '1963-11-22', 'SA Richard Johnsen (USSS)',
       'Delivered to SS Chief James Rowley in Washington.'),
      (4, date '1963-11-22', 'FBI',
       'Received from Secret Service; submitted to FBI Laboratory for ballistics comparison.')
    ],
    [],
    [struct<volume int64, witness string, page int64>(3, 'Robert A. Frazier (FBI)', 428)],
    ['oswald','warren-commission','fbi'],
    '',
    '',
    1
  ),
  ('CE-567', 'ballistic', 'Commission Exhibit 567 (limousine bullet fragment, front seat)',
   'A portion of a jacketed 6.5mm round recovered from the front seat of the presidential limousine. FBI Laboratory ballistics testing in 1963-64, and HSCA re-testing in 1978, both matched the fragment to the Carcano rifle CE-139.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(3, 'Robert A. Frazier (FBI)', 432)],
   ['warren-commission','fbi'], '', '', 2),
  ('CE-569', 'ballistic', 'Commission Exhibit 569 (limousine bullet fragment, rear)',
   'A smaller jacketed fragment recovered from the rear floor of the presidential limousine. Matched ballistically to CE-567 and to CE-139.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission','fbi'], '', '', 3),
  ('CE-840', 'ballistic', 'Commission Exhibit 840 (metal fragments from Connally\'s wrist)',
   'Three small metal fragments extracted from Governor John Connally\'s right wrist during treatment at Parkland. Their small aggregate mass, when added to the near-intact CE-399, is one axis on which the single-bullet analysis has been examined and re-examined.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission'], '', '', 4),
  ('CE-1717', 'ballistic', 'Commission Exhibit 1717 (paraffin test casts)',
   'Paraffin casts taken of Lee Harvey Oswald\'s hands and right cheek late on November 22, 1963. Hand tests registered nitrates (consistent with firing a pistol or other sources); the cheek test was negative. The Warren Commission treated the results as inconclusive; the FBI noted the test is not specific to gunpowder residue.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(4, 'Cortlandt Cunningham (FBI)', 274)],
   ['oswald','fbi'], '', '', 5),

  -- ============================================================
  -- FIREARMS
  -- ============================================================
  ('CE-139', 'firearm', 'Commission Exhibit 139 — Mannlicher-Carcano rifle, serial C-2766',
   'The 6.5x52mm Italian military rifle recovered by Dallas police on the 6th floor of the Texas School Book Depository on November 22, 1963. Fitted with a 4x Ordnance Optics Japanese-made telescopic sight. Purchased via mail order from Klein\'s Sporting Goods of Chicago in March 1963 under the alias "A. Hidell." Ballistics identified the rifle as the source of CE-399, CE-567, CE-569, and the three hulls CE-543/544/545.',
   [
     struct<step_order int64, date date, custodian string, action string>(
       1, date '1963-03-20', 'Klein\'s Sporting Goods',
       'Shipped to P.O. Box 2915, Dallas, addressed to A. Hidell.'
     ),
     (2, date '1963-11-22', 'Dallas Police Department',
      'Recovered on TSBD 6th floor by DPD officers including Deputy Constable Seymour Weitzman.'),
     (3, date '1963-11-23', 'FBI Dallas',
      'Transferred to FBI; flown to FBI Laboratory, Washington, for ballistic comparison.')
   ],
   [], [struct<volume int64, witness string, page int64>(3, 'Robert A. Frazier (FBI)', 390)],
   ['oswald','fbi','warren-commission'],
   'https://catalog.archives.gov/id/304970', 'National Archives Catalog', 10),
  ('CE-543-545', 'firearm', 'Commission Exhibits 543, 544, 545 — three spent cartridge hulls',
   'Three fired 6.5x52mm Mannlicher-Carcano cartridge cases recovered from the floor of the southeast corner "sniper\'s nest" on the TSBD 6th floor. All three matched ballistically to CE-139. Their position and spacing are examined in multiple testimonies as indicators of firing sequence.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald','fbi','warren-commission'], '', '', 11),
  ('CE-143', 'firearm', 'Commission Exhibit 143 — Smith & Wesson .38 revolver (Oswald\'s)',
   'A Smith & Wesson Victory Model .38 Special revolver recovered from Lee Harvey Oswald when he was arrested at the Texas Theatre in Oak Cliff at 1:50 p.m. on November 22, 1963. Purchased via mail order from Seaport Traders of Los Angeles, also under the "A. Hidell" alias. Ballistics matched to the four hulls recovered at the Tippit murder scene.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(3, 'Cortlandt Cunningham (FBI)', 466)],
   ['oswald','fbi','tippit'], '', '', 12),
  ('tippit-service-revolver', 'firearm', 'Officer J. D. Tippit\'s Smith & Wesson .38 service revolver',
   'Tippit\'s service weapon, holstered at the time of his murder. Recovered in the Dallas Police Department custodial chain.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['tippit','fbi'], '', '', 13),
  ('tippit-shells', 'firearm', 'Four .38 Special cartridge cases from the Tippit scene',
   'Four fired cartridge cases — two Remington-Peters and two Winchester-Western — recovered near the location of the Tippit shooting at 10th & Patton. FBI ballistics matched them to CE-143.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['tippit','fbi'], '', '', 14),

  -- ============================================================
  -- PHOTOGRAPHIC
  -- ============================================================
  ('CE-133-A', 'photographic', 'Commission Exhibit 133-A — Backyard photograph of Oswald (rifle, right)',
   'One of two photographs taken by Marina Oswald in late March or early April 1963 in the backyard of the Neely Street residence in Dallas. Depicts Lee Harvey Oswald holding the Carcano rifle, a pistol at his hip, and two socialist newspapers. Authenticity was disputed by Oswald at the time of arrest; the HSCA Photographic Evidence Panel (1978) concluded the photos were genuine and not composites.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(1, 'Marina N. Oswald', 14)],
   ['oswald','marina-oswald'],
   'https://catalog.archives.gov/id/6186375', 'National Archives Catalog', 20),
  ('CE-133-B', 'photographic', 'Commission Exhibit 133-B — Backyard photograph of Oswald (rifle, left)',
   'Second of the two Neely Street backyard photographs. Same session as CE-133-A; the pose differs. Authenticated by the HSCA Photographic Evidence Panel in 1978.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald','marina-oswald'], '', '', 21),
  ('zapruder-film', 'photographic', 'Zapruder Film (8mm color film, frames 133-486)',
   'Abraham Zapruder\'s 26-second color 8mm home movie of the motorcade on Elm Street. The film is the single most-examined piece of visual evidence in the case: frames 133 through 486 cover the motorcade\'s passage through Dealey Plaza, with frames 312-313 showing the fatal head wound. The Commission, the HSCA, and the ARRB each examined optically enhanced copies. The federal government took the original film by eminent domain in 1998 under the JFK Records Act, with arbitration setting compensation at $16M in 2000.',
   [
     struct<step_order int64, date date, custodian string, action string>(
       1, date '1963-11-22', 'Abraham Zapruder',
       'Filmed from a concrete pergola on the north side of Elm Street.'
     ),
     (2, date '1963-11-23', 'LIFE Magazine',
      'Time-Life Inc. purchased print rights for $50,000 (initial agreement).'),
     (3, date '1963-11-25', 'LIFE Magazine',
      'LIFE acquired all rights for an additional $100,000 (total $150,000, paid in installments through 1964).'),
     (4, date '1975-01-01', 'Zapruder family',
      'LIFE returned the original film to the Zapruder family for $1.'),
     (5, date '1997-04-24', 'U.S. Government (ARRB)',
      'ARRB designated the original film an "assassination record" under the JFK Records Act.'),
     (6, date '1998-08-03', 'U.S. Government (NARA)',
      'Federal government formally took the original film from the Zapruder family by eminent domain; an arbitration panel set compensation at $16 million in 2000.')
   ],
   [], [], ['zapruder','warren-commission','hsca','arrb'],
   'https://www.archives.gov/research/jfk/assassination-records', 'National Archives', 22),
  ('moorman-polaroid', 'photographic', 'Mary Moorman Polaroid (Z-313 moment)',
   'A Polaroid photograph taken by Mary Moorman from the south curb of Elm Street at approximately the moment of Zapruder frame 313. One of the closest still images of the fatal shot.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission','hsca'], '', '', 23),
  ('nix-film', 'photographic', 'Orville Nix film (8mm color)',
   'Orville Nix\'s 8mm color film, shot from the south side of Elm Street opposite the grassy knoll. Reviewed by the HSCA photographic panel.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['hsca'], '', '', 24),
  ('muchmore-film', 'photographic', 'Marie Muchmore film (8mm color)',
   'Marie Muchmore\'s 8mm color film of the motorcade, shot from near the triple underpass. Reviewed by the HSCA photographic panel.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['hsca'], '', '', 25),
  ('altgens-6', 'photographic', 'James Altgens photograph #6',
   'Associated Press photographer James Altgens\'s sixth exposure of the day: the motorcade on Elm Street a second or two after the first shot. Clearly shows the north side of the TSBD including the open 6th floor window.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission','hsca'], '', '', 26),

  -- ============================================================
  -- MEDICAL
  -- ============================================================
  ('CE-387', 'medical', 'Commission Exhibit 387 — Bethesda autopsy report',
   'The official autopsy report on President Kennedy, prepared by Commander James J. Humes, Commander J. Thornton Boswell, and Lt. Col. Pierre A. Finck at the Bethesda Naval Medical Center on November 22-24, 1963. The report locates entry and exit wounds and describes the trajectory of the fatal head wound. Its conclusions were re-examined by the Clark Panel (1968), the Rockefeller Commission (1975), the HSCA medical panel (1978), and the ARRB (1998).',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(2, 'Cdr. James J. Humes', 347)],
   ['warren-commission','hsca','arrb'], '', '', 30),
  ('autopsy-photos', 'medical', 'Kennedy autopsy photographs (descriptions only)',
   'The set of autopsy photographs taken at Bethesda Naval Medical Center. By site editorial policy, we catalog the existence and archival custody of these images but do not host or link to them directly. Descriptions of the photographs appear in the HSCA medical panel report and the ARRB Final Report. Readers interested in the content should consult the relevant archival descriptions at the National Archives.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['hsca','arrb'], '', '', 31),
  ('autopsy-xrays', 'medical', 'Kennedy autopsy X-rays (descriptions only)',
   'Skull and upper-torso X-rays taken at Bethesda. Cataloged by description only; the ARRB and HSCA medical panels both examined these and published their findings in their respective reports.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['hsca','arrb'], '', '', 32),
  ('parkland-notes', 'medical', 'Parkland Hospital treatment notes',
   'Clinical notes from the Parkland Memorial Hospital emergency department describing the state of the President on arrival, the observed wounds, and the resuscitation attempts. The Parkland doctors later testified before the Warren Commission and published statements in their Weekly Physicians\' Report.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(6, 'Dr. Malcolm Perry', 3),
             struct<volume int64, witness string, page int64>(6, 'Dr. Charles Carrico', 3)],
   ['warren-commission'], '', '', 33),

  -- ============================================================
  -- DOCUMENTARY (physical documents)
  -- ============================================================
  ('CE-1', 'documentary', 'Commission Exhibit 1 — Dallas motorcade route map',
   'The motorcade route prepared by the Secret Service, published in the Dallas newspapers on November 19, 1963. The route along Main Street, Houston Street, and Elm Street through Dealey Plaza was public 72 hours before the assassination.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission'], '', '', 40),
  ('hidell-pobox', 'documentary', 'Post Office Box 2915 (Dallas) paperwork',
   'Records for the Dallas P.O. Box used to receive both the Carcano rifle (from Klein\'s) and the .38 revolver (from Seaport Traders), rented under the name "Lee H. Oswald" with authorization also given to "A. J. Hidell." Cross-examined in the FBI Laboratory\'s handwriting analysis.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald','fbi'], '', '', 41),
  ('minox-camera', 'documentary', 'Minox subminiature camera in Oswald\'s possessions',
   'A Minox subminiature camera found among Oswald\'s possessions. The Commission\'s treatment of the camera — and later interpretation — has been the subject of recurring discussion in the intelligence-adjacent literature, including in HSCA staff files.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald'], '', '', 42),
  ('oswald-diary', 'documentary', 'Oswald\'s "Historic Diary"',
   'A spiral-bound notebook containing Oswald\'s handwritten account of his October 1959 defection to the Soviet Union, his residency in Minsk, and his return to the United States in 1962. Authenticated as Oswald\'s handwriting by the FBI; reviewed by the Commission.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald'], '', '', 43),
  ('curtain-rod-bag', 'documentary', 'Paper bag ("curtain-rod package") from TSBD',
   'A brown paper bag found near the 6th floor "sniper\'s nest." Buell Wesley Frazier testified that Oswald carried a package of similar size and shape to work on the morning of November 22, which Oswald described as containing curtain rods. FBI fiber analysis on the bag is discussed in the Commission record.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(2, 'Buell Wesley Frazier', 210)],
   ['oswald','warren-commission','fbi'], '', '', 44),

  -- ============================================================
  -- CLOTHING
  -- ============================================================
  ('CE-393', 'clothing', 'Commission Exhibit 393 — President Kennedy\'s suit jacket',
   'The suit jacket worn by President Kennedy on November 22, 1963, with entry and exit perforations examined and photographed. The position of the perforations is one of the physical anchors of the single-bullet analysis.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission'], '', '', 50),
  ('CE-394', 'clothing', 'Commission Exhibit 394 — President Kennedy\'s shirt',
   'The dress shirt worn by President Kennedy, with a corresponding perforation and a slit from the tracheostomy incision made at Parkland.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission'], '', '', 51),
  ('CE-391', 'clothing', 'Commission Exhibit 391 — Governor Connally\'s suit jacket',
   'Governor John Connally\'s suit jacket, examined for entry and exit perforations and for fiber alignment with the wounds documented at Parkland.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission','connally'], '', '', 52),
  ('tippit-uniform', 'clothing', 'Officer J. D. Tippit\'s uniform shirt',
   'Tippit\'s Dallas Police uniform shirt, examined at autopsy for bullet perforations consistent with the four rounds fired at 10th & Patton.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['tippit'], '', '', 53),

  -- ============================================================
  -- ENVIRONMENTAL (Dealey Plaza / TSBD scene)
  -- ============================================================
  ('snipers-nest', 'environmental', 'TSBD 6th floor "sniper\'s nest" box arrangement',
   'The stacked boxes of textbook cartons in the southeast corner of the TSBD 6th floor, arranged to form a partial screen from the stairwell and a shooting rest at the window ledge. Documented in photographs CE-509 through CE-512.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['oswald','warren-commission'], '', '', 60),
  ('6th-floor-window', 'environmental', 'TSBD 6th floor southeast window',
   'The window from which the Commission, the HSCA, and the ARRB concluded the shots originated. Position, height, and line-of-sight to the motorcade are documented in crime-scene reconstruction exhibits.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], cast([] as array<struct<volume int64, witness string, page int64>>), ['warren-commission','hsca'], '', '', 61),
  ('tague-curb', 'environmental', 'Main Street curb fragment (James Tague wound)',
   'A segment of the Main Street curb, south of the triple underpass, from which a fragment was chipped by a bullet or bullet fragment. Bystander James Tague was slightly wounded by the resulting concrete spall. The curb fragment was removed and examined by the FBI; the source of the fragment is discussed in the Commission record.',
   cast([] as array<struct<step_order int64, date date, custodian string, action string>>), [], [struct<volume int64, witness string, page int64>(7, 'James T. Tague', 552)],
   ['warren-commission','fbi'], '', '', 62)
]);
