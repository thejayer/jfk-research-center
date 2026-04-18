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
    null,null,null,'1976–1979', 9)
]);
