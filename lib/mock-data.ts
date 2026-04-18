/**
 * Mock data layer.
 *
 * This module produces typed fixtures in the API contract shape.
 * Every API route reads from these fixtures; the UI never touches
 * these helpers directly.
 *
 * All copy is neutral and archival; no lorem ipsum, no sensational framing.
 */

import type {
  DocumentCard,
  DocumentDetail,
  EntityCard,
  EntityDetail,
  HomeResponse,
  MentionExcerpt,
  SearchResponse,
  SearchResult,
  TopicCard,
  TopicDetail,
  TimelineEvent,
  EntityResponse,
  TopicResponse,
  DocumentResponse,
  ConfidenceLevel,
} from "./api-types";

// ----------------------------------------------------------------------------
// Entities
// ----------------------------------------------------------------------------

const ENTITY_TABLE: Record<string, EntityDetail> = {
  oswald: {
    slug: "oswald",
    name: "Lee Harvey Oswald",
    type: "person",
    aliases: ["Lee H. Oswald", "Oswald", "LHO", "Alek J. Hidell", "O. H. Lee"],
    born: "1939-10-18",
    died: "1963-11-24",
    activeYears: "1956–1963",
    headline:
      "Former Marine whose life, travels, and final days are the central thread of every JFK investigation.",
    summary:
      "U.S. Marine veteran, defector to the Soviet Union, and the sole person charged by the Dallas Police Department with the assassination of President Kennedy on November 22, 1963.",
    description:
      "Lee Harvey Oswald served in the U.S. Marine Corps from 1956 to 1959 before defecting to the Soviet Union, where he lived in Minsk until 1962. After returning to the United States with his wife Marina, he worked briefly in Dallas and New Orleans, undertook a trip to Mexico City in late September 1963, and was arrested at the Texas Theatre on November 22, 1963. Approximately 45 minutes after the assassination of President Kennedy, Dallas Police Officer J. D. Tippit was shot and killed on East 10th Street in Oak Cliff; Oswald was charged with both murders the same day. He was shot and killed two days later by Dallas nightclub owner Jack Ruby while being transferred between jails.",
    href: "/entity/oswald",
    documentCount: 412,
    mentionCount: 2834,
  },
  ruby: {
    slug: "ruby",
    name: "Jack Ruby",
    type: "person",
    aliases: ["Jacob Rubenstein", "Jack Rubenstein", "Jack L. Ruby"],
    born: "1911-04-25",
    died: "1967-01-03",
    activeYears: "1947–1967",
    summary:
      "Dallas nightclub owner who shot Lee Harvey Oswald in the basement of Dallas Police Headquarters on November 24, 1963.",
    description:
      "Jack Ruby owned the Carousel Club and the Vegas Club in Dallas, Texas. He had long-running contacts with Dallas Police officers and was the subject of extensive FBI and Warren Commission inquiry into his movements in the days surrounding the assassination. He was convicted of Oswald's murder in March 1964. On October 5, 1966 the Texas Court of Criminal Appeals reversed the conviction; before a retrial could be held, Ruby died on January 3, 1967 of a pulmonary embolism while being treated for lung cancer at Parkland Memorial Hospital.",
    href: "/entity/ruby",
    documentCount: 188,
    mentionCount: 612,
  },
  cia: {
    slug: "cia",
    name: "Central Intelligence Agency",
    type: "org",
    aliases: ["CIA", "Central Intelligence Agency", "the Agency"],
    activeYears: "1947–present",
    summary:
      "U.S. foreign-intelligence agency whose Mexico City station, counterintelligence staff, and Cuban operations feature heavily in the JFK file releases.",
    description:
      "The Central Intelligence Agency's operational interest in Oswald predated the assassination by several years and is documented across station cables, 201 personality files, and counterintelligence correspondence. Agency holdings released under the President John F. Kennedy Assassination Records Collection Act of 1992 include materials from the Mexico City, Miami, and Directorate of Plans files.",
    href: "/entity/cia",
    documentCount: 1247,
    mentionCount: 8912,
  },
  fbi: {
    slug: "fbi",
    name: "Federal Bureau of Investigation",
    type: "org",
    aliases: ["FBI", "Bureau", "Federal Bureau of Investigation"],
    activeYears: "1908–present",
    summary:
      "Lead domestic investigating agency in the immediate hours and years after the assassination; maintained voluminous files on Oswald and Ruby.",
    description:
      "The Federal Bureau of Investigation conducted the first federal investigation of the assassination and supplied the Warren Commission with the majority of its evidentiary record. FBI holdings in the JFK Collection include the Oswald HQ and Dallas Field Office files, the Ruby file, and interview reports (FD-302 forms) covering thousands of witnesses.",
    href: "/entity/fbi",
    documentCount: 1633,
    mentionCount: 11204,
  },
  "warren-commission": {
    slug: "warren-commission",
    name: "Warren Commission",
    type: "org",
    aliases: [
      "President's Commission on the Assassination of President Kennedy",
      "Warren Commission",
    ],
    activeYears: "1963–1964",
    summary:
      "Presidential commission chaired by Chief Justice Earl Warren that produced the first federal assassination report in September 1964.",
    description:
      "Established by Executive Order 11130 on November 29, 1963, the Commission heard testimony from 552 witnesses and published its 888-page report along with 26 volumes of hearings and exhibits. Its records, including staff memoranda and unpublished exhibits, form a core layer of the National Archives JFK Collection.",
    href: "/entity/warren-commission",
    documentCount: 864,
    mentionCount: 5401,
  },
  hsca: {
    slug: "hsca",
    name: "House Select Committee on Assassinations",
    type: "org",
    aliases: ["HSCA", "House Select Committee on Assassinations"],
    activeYears: "1976–1979",
    summary:
      "1976–1979 congressional inquiry that re-examined the Kennedy and King assassinations and published a 12-volume appendix of evidence.",
    description:
      "The House Select Committee on Assassinations reviewed the forensic, acoustic, medical, and intelligence record surrounding the Kennedy and King assassinations. Its final report concluded that President Kennedy was 'probably assassinated as a result of a conspiracy' and recommended further investigation by the Department of Justice; its working files were transferred to the National Archives in the 1990s.",
    href: "/entity/hsca",
    documentCount: 527,
    mentionCount: 3380,
  },
  angleton: {
    slug: "angleton",
    name: "James J. Angleton",
    type: "person",
    aliases: ["James Jesus Angleton", "Angleton"],
    born: "1917-12-09",
    died: "1987-05-11",
    activeYears: "1954–1974",
    summary:
      "Chief of CIA Counterintelligence Staff from 1954 to 1974; supervised handling of the Oswald 201 file.",
    description:
      "As Chief of CIA Counterintelligence (1954–1974), James Angleton oversaw the agency's long-running molehunt and had direct knowledge of the pre-assassination Oswald file. His name appears on routing slips and correspondence throughout the CIA's JFK releases.",
    href: "/entity/angleton",
    documentCount: 96,
    mentionCount: 402,
  },
  hoover: {
    slug: "hoover",
    name: "J. Edgar Hoover",
    type: "person",
    aliases: ["J. Edgar Hoover", "Hoover", "The Director"],
    born: "1895-01-01",
    died: "1972-05-02",
    activeYears: "1924–1972",
    summary:
      "FBI Director whose personal memoranda document the Bureau's hour-by-hour response to the assassination.",
    description:
      "J. Edgar Hoover directed the FBI from 1924 until his death. His initialed memoranda, phone transcripts, and briefing papers are a primary record of how the Bureau characterized Oswald, Ruby, and the Dallas investigation in the hours and days following November 22, 1963.",
    href: "/entity/hoover",
    documentCount: 142,
    mentionCount: 738,
  },
  "marina-oswald": {
    slug: "marina-oswald",
    name: "Marina N. Oswald",
    type: "person",
    aliases: ["Marina Oswald Porter", "Marina Nikolaevna Prusakova"],
    born: "1941-07-17",
    activeYears: "1961–present",
    summary:
      "Oswald's Soviet-born wife and a principal Warren Commission witness.",
    description:
      "Marina Oswald testified before the Warren Commission four times in 1964 and remained under FBI protective surveillance for months after the assassination. Her interview reports are indexed across the Dallas Field Office and Warren Commission files.",
    href: "/entity/marina-oswald",
    documentCount: 84,
    mentionCount: 512,
  },
};

// ----------------------------------------------------------------------------
// Topics
// ----------------------------------------------------------------------------

const TOPIC_TABLE: Record<string, TopicDetail> = {
  "warren-commission": {
    slug: "warren-commission",
    title: "Warren Commission",
    eyebrow: "1963 – 1964",
    summary:
      "Presidential commission led by Chief Justice Earl Warren that produced the first federal report on the assassination.",
    description:
      "The President's Commission on the Assassination of President Kennedy published its 888-page report on September 24, 1964, together with 26 volumes of hearings and exhibits. Its working files include staff memoranda, interview summaries, and unpublished exhibits held at the National Archives.",
    documentCount: 864,
    href: "/topic/warren-commission",
    relatedSlugs: ["hsca", "fbi"],
  },
  hsca: {
    slug: "hsca",
    title: "House Select Committee on Assassinations",
    eyebrow: "1976 – 1979",
    summary:
      "Congressional re-investigation that examined acoustic, medical, and intelligence evidence a decade after the Warren Report.",
    description:
      "The House Select Committee on Assassinations issued a 686-page final report on March 29, 1979, alongside a 12-volume appendix. The Committee's working files, including counsel memoranda and staff interview notes, form one of the largest collections released under the JFK Records Act.",
    documentCount: 527,
    href: "/topic/hsca",
    relatedSlugs: ["warren-commission", "cia"],
  },
  "mexico-city": {
    slug: "mexico-city",
    title: "Mexico City",
    eyebrow: "September – October 1963",
    summary:
      "Oswald's documented visit to Mexico City and the CIA station's surveillance of the Cuban and Soviet embassies.",
    description:
      "Oswald traveled to Mexico City between approximately September 27 and October 2, 1963, visiting the Cuban consulate and the Soviet embassy. CIA Mexico City station cables, telephone intercept summaries, and photographic surveillance logs related to this trip are among the most studied materials in the JFK Collection.",
    documentCount: 318,
    href: "/topic/mexico-city",
    relatedSlugs: ["cia", "oswald"],
  },
  cia: {
    slug: "cia",
    title: "CIA Records",
    eyebrow: "1959 – 1992",
    summary:
      "Agency records spanning Oswald's 201 file, the Directorate of Plans, and the Mexico City and Miami stations.",
    description:
      "CIA holdings released under the JFK Records Act include the 201 personality file opened on Oswald in December 1960, operational traffic from the Mexico City and Miami stations, and a substantial body of counterintelligence correspondence. The agency has released material in stages between 1993 and the present.",
    documentCount: 1247,
    href: "/topic/cia",
    relatedSlugs: ["mexico-city", "hsca"],
  },
  fbi: {
    slug: "fbi",
    title: "FBI Records",
    eyebrow: "1959 – 1978",
    summary:
      "Bureau files comprising the Oswald HQ and Dallas Field Office investigations and the Ruby case.",
    description:
      "FBI holdings in the JFK Collection include the Headquarters and Dallas Field Office Oswald files (FBIHQ 105-82555 and DL 100-10461), the Ruby file, thousands of FD-302 witness interview reports, and the director's own teletype and memorandum traffic.",
    documentCount: 1633,
    href: "/topic/fbi",
    relatedSlugs: ["warren-commission", "cia"],
  },
};

// ----------------------------------------------------------------------------
// Documents
// ----------------------------------------------------------------------------

type DocumentSeed = DocumentDetail & {
  entities: string[];
  topics: string[];
};

const DOCUMENT_SEEDS: DocumentSeed[] = [
  {
    id: "wc-report-1964",
    naid: "193887",
    title: "Report of the President's Commission on the Assassination of President Kennedy",
    subtitle: "Warren Commission, Final Report",
    description:
      "The 888-page final report of the President's Commission on the Assassination of President Kennedy, submitted to President Lyndon B. Johnson on September 24, 1964. The report details the Commission's findings on the events of November 22, 1963, the background of Lee Harvey Oswald, and the subsequent investigation.",
    href: "/document/wc-report-1964",
    tags: ["Warren Commission", "Final Report", "1964"],
    agency: "Warren Commission",
    date: "1964-09-24",
    dateLabel: "September 24, 1964",
    documentType: "Report",
    recordGroup: "RG 272 — Records of the President's Commission on the Assassination of President Kennedy",
    collectionName: "JFK Assassination Records Collection",
    startDate: "1963-11-29",
    endDate: "1964-09-24",
    sourceUrl: "https://catalog.archives.gov/id/193887",
    digitalObjectUrl: "https://catalog.archives.gov/OpaAPI/media/193887/content",
    hasOcr: true,
    pageCount: 888,
    chunkCount: 842,
    ocrExcerpt:
      "The Commission has found no evidence that either Lee Harvey Oswald or Jack Ruby was part of any conspiracy, domestic or foreign, to assassinate President Kennedy.",
    citation: "NAID 193887 · Records of the President's Commission on the Assassination of President Kennedy (RG 272)",
    entities: ["oswald", "ruby", "warren-commission", "fbi", "cia"],
    topics: ["warren-commission", "fbi"],
  },
  {
    id: "hsca-final-report",
    naid: "7582727",
    title: "Report of the Select Committee on Assassinations, U.S. House of Representatives",
    subtitle: "HSCA, Final Report",
    description:
      "Final report of the House Select Committee on Assassinations, issued on March 29, 1979. The report re-examines the assassinations of President John F. Kennedy and Dr. Martin Luther King, Jr., including acoustic analysis of the Dallas police dictabelt recording.",
    href: "/document/hsca-final-report",
    tags: ["HSCA", "Final Report", "1979"],
    agency: "HSCA",
    date: "1979-03-29",
    dateLabel: "March 29, 1979",
    documentType: "Report",
    recordGroup: "RG 233 — Records of the U.S. House of Representatives",
    collectionName: "JFK Assassination Records Collection",
    startDate: "1976-09-17",
    endDate: "1979-03-29",
    sourceUrl: "https://catalog.archives.gov/id/7582727",
    hasOcr: true,
    pageCount: 686,
    chunkCount: 612,
    ocrExcerpt:
      "The Committee believes, on the basis of the evidence available to it, that President Kennedy was probably assassinated as a result of a conspiracy.",
    citation: "NAID 7582727 · Records of the U.S. House of Representatives (RG 233)",
    entities: ["hsca", "oswald", "cia", "fbi"],
    topics: ["hsca", "cia"],
  },
  {
    id: "oswald-201-file-vol1",
    naid: "104-10004-10156",
    title: "Oswald 201 File, Volume I",
    subtitle: "CIA Counterintelligence, Personality File",
    description:
      "First volume of the CIA 201 personality file on Lee Harvey Oswald, opened on December 9, 1960, following press reports of his defection attempt to the Soviet Union. Contains intake memoranda, routing sheets, and early correspondence with the Office of Security.",
    href: "/document/oswald-201-file-vol1",
    tags: ["CIA", "201 File", "Counterintelligence"],
    agency: "CIA",
    date: "1960-12-09",
    dateLabel: "December 9, 1960",
    documentType: "Textual Record",
    recordGroup: "RG 263 — Records of the Central Intelligence Agency",
    collectionName: "JFK Assassination Records Collection",
    startDate: "1960-10-31",
    endDate: "1962-06-13",
    sourceUrl: "https://catalog.archives.gov/id/104-10004-10156",
    hasOcr: true,
    pageCount: 124,
    chunkCount: 118,
    ocrExcerpt:
      "Subject LEE HARVEY OSWALD, former U.S. Marine, is reported to have renounced his U.S. citizenship in Moscow on October 31, 1959. A 201 file is opened on this date.",
    citation: "NAID 104-10004-10156 · Records of the Central Intelligence Agency (RG 263)",
    entities: ["oswald", "cia", "angleton"],
    topics: ["cia", "mexico-city"],
  },
  {
    id: "mexico-city-cable-oct8",
    naid: "104-10015-10048",
    title: "Mexico City Station Cable: LHO Contact with Soviet Embassy",
    subtitle: "CIA Station, Mexico City",
    description:
      "Outgoing cable from the CIA Mexico City station to CIA Headquarters dated October 8, 1963, reporting a visit by an American male identifying himself as LEE OSWALD to the Soviet embassy, and contact with consular officer Valery V. Kostikov.",
    href: "/document/mexico-city-cable-oct8",
    tags: ["Mexico City", "Soviet Embassy", "Cable"],
    agency: "CIA",
    date: "1963-10-08",
    dateLabel: "October 8, 1963",
    documentType: "Cable",
    recordGroup: "RG 263 — Records of the Central Intelligence Agency",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/104-10015-10048",
    hasOcr: true,
    pageCount: 3,
    chunkCount: 3,
    ocrExcerpt:
      "ON 1 OCTOBER 1963, AN AMERICAN MALE SPOKE BROKEN RUSSIAN, IDENTIFIED HIMSELF AS LEE OSWALD, STATED HE HAD BEEN AT SOVEMB ON 28 SEPT AND SPOKEN WITH CONSUL KOSTIKOV.",
    citation: "NAID 104-10015-10048 · Records of the Central Intelligence Agency (RG 263)",
    entities: ["oswald", "cia"],
    topics: ["mexico-city", "cia"],
  },
  {
    id: "fbi-hoover-memo-nov24",
    naid: "124-10055-10001",
    title: "Memorandum from Director Hoover: Assassination of President Kennedy",
    subtitle: "FBI, Director's Office",
    description:
      "Internal FBI memorandum initialed by Director J. Edgar Hoover on November 24, 1963, summarizing the Bureau's investigative posture in the immediate aftermath of the assassination of President Kennedy and the shooting of Lee Harvey Oswald.",
    href: "/document/fbi-hoover-memo-nov24",
    tags: ["FBI", "Director", "November 24 1963"],
    agency: "FBI",
    date: "1963-11-24",
    dateLabel: "November 24, 1963",
    documentType: "Memorandum",
    recordGroup: "RG 65 — Records of the Federal Bureau of Investigation",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/124-10055-10001",
    hasOcr: true,
    pageCount: 5,
    chunkCount: 5,
    ocrExcerpt:
      "The thing I am concerned about, and so is Mr. Katzenbach, is having something issued so we can convince the public that Oswald is the real assassin.",
    citation: "NAID 124-10055-10001 · Records of the Federal Bureau of Investigation (RG 65)",
    entities: ["hoover", "oswald", "fbi"],
    topics: ["fbi", "warren-commission"],
  },
  {
    id: "oswald-marines-service-record",
    naid: "198511",
    title: "Lee Harvey Oswald U.S. Marine Corps Service Record Book",
    subtitle: "U.S. Marine Corps Personnel File",
    description:
      "Official service record book for Lee Harvey Oswald, 1956–1959, covering enlistment, aviation electronics training at Jacksonville and Biloxi, radar duties at MCAS El Toro and Atsugi (Japan), and administrative discharge in September 1959.",
    href: "/document/oswald-marines-service-record",
    tags: ["Oswald", "Military", "1956–1959"],
    agency: "Department of Defense",
    date: "1959-09-11",
    dateLabel: "Issued September 11, 1959",
    documentType: "Textual Record",
    recordGroup: "RG 127 — Records of the U.S. Marine Corps",
    collectionName: "Official Military Personnel Files",
    startDate: "1956-10-24",
    endDate: "1959-09-11",
    sourceUrl: "https://catalog.archives.gov/id/198511",
    hasOcr: true,
    pageCount: 62,
    chunkCount: 41,
    ocrExcerpt:
      "OSWALD, LEE H. 1653230. Recruited 24 October 1956, San Diego, California. Trained in aviation electronics (MOS 6741). Assigned MCAS Atsugi, Japan, 12 September 1957.",
    citation: "NAID 198511 · Records of the U.S. Marine Corps (RG 127)",
    entities: ["oswald"],
    topics: [],
  },
  {
    id: "ruby-polygraph-transcript",
    naid: "124-10223-10008",
    title: "Jack Ruby Polygraph Examination Transcript",
    subtitle: "FBI, Dallas Field Office",
    description:
      "Transcript of the polygraph examination of Jack Ruby conducted at the Dallas County Jail on July 18, 1964, in the presence of Warren Commission counsel Arlen Specter and J. Lee Rankin. The examination was conducted at Ruby's request.",
    href: "/document/ruby-polygraph-transcript",
    tags: ["Ruby", "Polygraph", "Warren Commission"],
    agency: "FBI",
    date: "1964-07-18",
    dateLabel: "July 18, 1964",
    documentType: "Testimony",
    recordGroup: "RG 65 — Records of the Federal Bureau of Investigation",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/124-10223-10008",
    hasOcr: true,
    pageCount: 84,
    chunkCount: 76,
    ocrExcerpt:
      "Q: Did you ever know Lee Harvey Oswald before November 22, 1963? A: No. Q: Did you shoot Oswald to silence him? A: No.",
    citation: "NAID 124-10223-10008 · Records of the Federal Bureau of Investigation (RG 65)",
    entities: ["ruby", "oswald", "fbi", "warren-commission"],
    topics: ["fbi", "warren-commission"],
  },
  {
    id: "marina-oswald-testimony-feb3",
    naid: "197323",
    title: "Testimony of Marina Oswald before the Warren Commission",
    subtitle: "Warren Commission, Public Hearings",
    description:
      "Stenographic transcript of the testimony of Marina N. Oswald before the President's Commission on the Assassination of President Kennedy, session of February 3, 1964, at 200 Maryland Avenue NE, Washington, D.C.",
    href: "/document/marina-oswald-testimony-feb3",
    tags: ["Marina Oswald", "Testimony", "1964"],
    agency: "Warren Commission",
    date: "1964-02-03",
    dateLabel: "February 3, 1964",
    documentType: "Testimony",
    recordGroup: "RG 272 — Records of the President's Commission on the Assassination of President Kennedy",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/197323",
    hasOcr: true,
    pageCount: 203,
    chunkCount: 186,
    ocrExcerpt:
      "Mrs. OSWALD. I did not like the idea of him going to Mexico. He had told me he wanted to go to Cuba. I objected to this trip.",
    citation: "NAID 197323 · Records of the President's Commission on the Assassination of President Kennedy (RG 272)",
    entities: ["marina-oswald", "oswald", "warren-commission"],
    topics: ["warren-commission", "mexico-city"],
  },
  {
    id: "dallas-police-fd302-dec3",
    naid: "124-10089-10234",
    title: "FD-302 Interview Report: Dallas Police Department Officer, December 3, 1963",
    subtitle: "FBI, Dallas Field Office",
    description:
      "Form FD-302 summarizing a December 3, 1963 interview with a Dallas Police Department officer regarding the basement transfer of Lee Harvey Oswald on November 24, 1963 and the presence of Jack Ruby in police headquarters that morning.",
    href: "/document/dallas-police-fd302-dec3",
    tags: ["Dallas Police", "FD-302", "Ruby"],
    agency: "FBI",
    date: "1963-12-03",
    dateLabel: "December 3, 1963",
    documentType: "Memorandum",
    recordGroup: "RG 65 — Records of the Federal Bureau of Investigation",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/124-10089-10234",
    hasOcr: true,
    pageCount: 4,
    chunkCount: 4,
    ocrExcerpt:
      "Officer advised that RUBY was known to frequent Police Headquarters and had, on several occasions, brought sandwiches to officers working the night shift.",
    citation: "NAID 124-10089-10234 · Records of the Federal Bureau of Investigation (RG 65)",
    entities: ["ruby", "oswald", "fbi"],
    topics: ["fbi"],
  },
  {
    id: "angleton-memo-ci-routing",
    naid: "104-10067-10012",
    title: "Counterintelligence Staff Memorandum on Oswald Routing",
    subtitle: "CIA, Counterintelligence Staff",
    description:
      "Internal CIA Counterintelligence Staff memorandum dated October 10, 1963, transmitting Mexico City station cable traffic concerning a person identifying himself as Lee Oswald. Initialed by James J. Angleton.",
    href: "/document/angleton-memo-ci-routing",
    tags: ["Angleton", "CI", "Mexico City"],
    agency: "CIA",
    date: "1963-10-10",
    dateLabel: "October 10, 1963",
    documentType: "Memorandum",
    recordGroup: "RG 263 — Records of the Central Intelligence Agency",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/104-10067-10012",
    hasOcr: true,
    pageCount: 7,
    chunkCount: 7,
    ocrExcerpt:
      "Attached cable from Mexico City station concerns an American male who identified himself as LEE OSWALD, reportedly in contact with Soviet consular officer KOSTIKOV. For CI/SIG review.",
    citation: "NAID 104-10067-10012 · Records of the Central Intelligence Agency (RG 263)",
    entities: ["angleton", "oswald", "cia"],
    topics: ["cia", "mexico-city"],
  },
  {
    id: "hsca-acoustics-report",
    naid: "7582729",
    title: "HSCA Report of the Acoustics Panel",
    subtitle: "HSCA, Volume VIII",
    description:
      "Report and findings of the Acoustics Panel of the House Select Committee on Assassinations, reviewing the Dallas Police Department dictabelt recording and concluding with a probability estimate regarding a shot from the grassy knoll.",
    href: "/document/hsca-acoustics-report",
    tags: ["HSCA", "Acoustics", "Dictabelt"],
    agency: "HSCA",
    date: "1979-03-01",
    dateLabel: "March 1979",
    documentType: "Report",
    recordGroup: "RG 233 — Records of the U.S. House of Representatives",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/7582729",
    hasOcr: true,
    pageCount: 134,
    chunkCount: 121,
    ocrExcerpt:
      "The acoustics panel concludes, with a probability of 95 percent or better, that there were four shots fired at the Presidential limousine in Dealey Plaza.",
    citation: "NAID 7582729 · Records of the U.S. House of Representatives (RG 233)",
    entities: ["hsca"],
    topics: ["hsca"],
  },
  {
    id: "arrb-oswald-walker",
    naid: "180-10110-10009",
    title: "ARRB Staff Memorandum: Oswald and the Walker Shooting",
    subtitle: "Assassination Records Review Board",
    description:
      "Staff memorandum prepared by the Assassination Records Review Board in March 1998 reviewing the evidentiary record of the April 10, 1963 shooting at the residence of General Edwin Walker in Dallas, Texas.",
    href: "/document/arrb-oswald-walker",
    tags: ["ARRB", "Walker", "Dallas"],
    agency: "ARRB",
    date: "1998-03-12",
    dateLabel: "March 12, 1998",
    documentType: "Memorandum",
    recordGroup: "RG 541 — Records of the Assassination Records Review Board",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/180-10110-10009",
    hasOcr: true,
    pageCount: 14,
    chunkCount: 12,
    ocrExcerpt:
      "The photographic evidence, including the backyard photographs, the Walker residence reconnaissance photograph, and the note left for Marina Oswald, is reviewed in Part II.",
    citation: "NAID 180-10110-10009 · Records of the Assassination Records Review Board (RG 541)",
    entities: ["oswald", "marina-oswald"],
    topics: [],
  },
  {
    id: "secret-service-trip-report",
    naid: "87671",
    title: "U.S. Secret Service Advance Report, Dallas, Texas",
    subtitle: "U.S. Secret Service, Protective Research",
    description:
      "Pre-travel advance report prepared by the U.S. Secret Service for the presidential visit to Dallas, Texas, on November 22, 1963, including motorcade route, security assignments, and known subjects in the Dallas area.",
    href: "/document/secret-service-trip-report",
    tags: ["Secret Service", "Dallas", "November 1963"],
    agency: "Secret Service",
    date: "1963-11-19",
    dateLabel: "November 19, 1963",
    documentType: "Report",
    recordGroup: "RG 87 — Records of the United States Secret Service",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/87671",
    hasOcr: true,
    pageCount: 22,
    chunkCount: 18,
    ocrExcerpt:
      "Motorcade will proceed from Love Field via Mockingbird Lane, Lemmon Avenue, Turtle Creek, Cedar Springs, Harwood, Main, Houston and Elm Streets to the Trade Mart.",
    citation: "NAID 87671 · Records of the United States Secret Service (RG 87)",
    entities: [],
    topics: [],
  },
  {
    id: "state-dept-oswald-passport",
    naid: "2110042",
    title: "Department of State Passport File: Lee Harvey Oswald",
    subtitle: "Passport Office, Department of State",
    description:
      "Consolidated passport file for Lee Harvey Oswald, covering his original September 1959 passport application, his 1961 return arrangements from the Soviet Union, and the June 1963 passport reissuance.",
    href: "/document/state-dept-oswald-passport",
    tags: ["State Department", "Passport", "Travel"],
    agency: "Department of State",
    date: "1963-06-25",
    dateLabel: "Reissued June 25, 1963",
    documentType: "Textual Record",
    recordGroup: "RG 59 — General Records of the Department of State",
    collectionName: "JFK Assassination Records Collection",
    startDate: "1959-09-04",
    endDate: "1963-10-01",
    sourceUrl: "https://catalog.archives.gov/id/2110042",
    hasOcr: true,
    pageCount: 78,
    chunkCount: 62,
    ocrExcerpt:
      "Passport issued to LEE HARVEY OSWALD on 25 June 1963 at New Orleans, Louisiana. Prior passport surrendered at Moscow, 9 July 1961.",
    citation: "NAID 2110042 · General Records of the Department of State (RG 59)",
    entities: ["oswald"],
    topics: ["mexico-city"],
  },
  {
    id: "nosenko-debriefing-summary",
    naid: "104-10185-10144",
    title: "Summary of Nosenko Debriefing: Soviet KGB Handling of Oswald",
    subtitle: "CIA, Soviet Russia Division",
    description:
      "Summary of the Central Intelligence Agency's debriefing of Soviet defector Yuri I. Nosenko on the Committee for State Security (KGB) handling of Lee Harvey Oswald during his residency in the Soviet Union from 1959 to 1962.",
    href: "/document/nosenko-debriefing-summary",
    tags: ["Nosenko", "KGB", "Soviet Union"],
    agency: "CIA",
    date: "1968-02-14",
    dateLabel: "February 14, 1968",
    documentType: "Memorandum",
    recordGroup: "RG 263 — Records of the Central Intelligence Agency",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/104-10185-10144",
    hasOcr: true,
    pageCount: 41,
    chunkCount: 36,
    ocrExcerpt:
      "Subject NOSENKO states the KGB had no operational interest in OSWALD during his Minsk residency and did not debrief him in any systematic fashion.",
    citation: "NAID 104-10185-10144 · Records of the Central Intelligence Agency (RG 263)",
    entities: ["oswald", "cia"],
    topics: ["cia"],
  },
  {
    id: "cuba-project-jmwave",
    naid: "104-10172-10002",
    title: "JMWAVE Station Reporting on Cuban Exile Activity, Fall 1963",
    subtitle: "CIA Station, Miami",
    description:
      "Weekly station reporting from the CIA Miami station (cryptonym JMWAVE) covering Cuban exile group activity from September through November 1963, including DRE, Alpha 66, and JURE.",
    href: "/document/cuba-project-jmwave",
    tags: ["Miami", "Cuba", "Exiles"],
    agency: "CIA",
    date: "1963-11-15",
    dateLabel: "November 15, 1963",
    documentType: "Report",
    recordGroup: "RG 263 — Records of the Central Intelligence Agency",
    collectionName: "JFK Assassination Records Collection",
    startDate: "1963-09-01",
    endDate: "1963-11-15",
    sourceUrl: "https://catalog.archives.gov/id/104-10172-10002",
    hasOcr: true,
    pageCount: 64,
    chunkCount: 58,
    ocrExcerpt:
      "During the reporting period, DRE leadership in Miami maintained contact with their New Orleans delegate, who reported an encounter with a subject named LEE OSWALD in August.",
    citation: "NAID 104-10172-10002 · Records of the Central Intelligence Agency (RG 263)",
    entities: ["cia", "oswald"],
    topics: ["cia"],
  },
  {
    id: "hsca-cia-liaison-file",
    naid: "180-10143-10440",
    title: "HSCA – CIA Liaison File, Segregated Collection",
    subtitle: "HSCA Investigative Records",
    description:
      "Segregated HSCA investigative file on the liaison arrangement between the House Select Committee and the Central Intelligence Agency, including access logs, custodial memoranda, and correspondence with the Agency's Office of Legislative Counsel.",
    href: "/document/hsca-cia-liaison-file",
    tags: ["HSCA", "CIA", "Liaison"],
    agency: "HSCA",
    date: "1978-07-10",
    dateLabel: "July 10, 1978",
    documentType: "Textual Record",
    recordGroup: "RG 233 — Records of the U.S. House of Representatives",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/180-10143-10440",
    hasOcr: true,
    pageCount: 96,
    chunkCount: 88,
    ocrExcerpt:
      "Staff access to CIA holdings is coordinated through the Office of Legislative Counsel on a need-to-know basis; all notes taken on CIA premises remain classified pending review.",
    citation: "NAID 180-10143-10440 · Records of the U.S. House of Representatives (RG 233)",
    entities: ["hsca", "cia"],
    topics: ["hsca", "cia"],
  },
  {
    id: "oswald-backyard-photos",
    naid: "305138",
    title: "Photographic Exhibit: Backyard Photographs of Lee Harvey Oswald",
    subtitle: "Warren Commission, Photographic Exhibits",
    description:
      "Photographic exhibits introduced to the Warren Commission showing Lee Harvey Oswald holding a rifle and two socialist newspapers in the backyard of 214 West Neely Street, Dallas, Texas, dated to late March 1963.",
    href: "/document/oswald-backyard-photos",
    tags: ["Photograph", "Dallas", "Walker"],
    agency: "Warren Commission",
    date: "1963-03-31",
    dateLabel: "March 31, 1963 (approx.)",
    documentType: "Photograph",
    recordGroup: "RG 272 — Records of the President's Commission on the Assassination of President Kennedy",
    collectionName: "JFK Assassination Records Collection",
    sourceUrl: "https://catalog.archives.gov/id/305138",
    hasOcr: false,
    pageCount: 3,
    chunkCount: 0,
    ocrExcerpt: null,
    citation: "NAID 305138 · Records of the President's Commission on the Assassination of President Kennedy (RG 272)",
    entities: ["oswald", "marina-oswald"],
    topics: ["warren-commission"],
  },
];

// ----------------------------------------------------------------------------
// Mentions
// ----------------------------------------------------------------------------

type MentionSeed = MentionExcerpt & {
  entitySlugs: string[];
  topicSlugs: string[];
};

const MENTION_SEEDS: MentionSeed[] = [
  mkMention({
    id: "m-001",
    documentId: "wc-report-1964",
    excerpt:
      "Lee Harvey Oswald, acting alone and without advice or assistance, fired the shots that killed President Kennedy.",
    matchedTerms: ["Lee Harvey Oswald", "Oswald"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 19",
    entitySlugs: ["oswald", "warren-commission"],
    topicSlugs: ["warren-commission"],
  }),
  mkMention({
    id: "m-002",
    documentId: "hsca-final-report",
    excerpt:
      "The Committee concludes that the scientific acoustical evidence establishes a high probability that two gunmen fired at President Kennedy.",
    matchedTerms: ["acoustical evidence", "two gunmen"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 65",
    entitySlugs: ["hsca"],
    topicSlugs: ["hsca"],
  }),
  mkMention({
    id: "m-003",
    documentId: "oswald-201-file-vol1",
    excerpt:
      "A 201 file is opened on OSWALD, LEE HARVEY, following press reports of his defection attempt to the Soviet Union.",
    matchedTerms: ["Oswald", "201 file"],
    confidence: "high",
    source: "title",
    pageLabel: "cover sheet",
    entitySlugs: ["oswald", "cia", "angleton"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-004",
    documentId: "mexico-city-cable-oct8",
    excerpt:
      "AN AMERICAN MALE SPOKE BROKEN RUSSIAN, IDENTIFIED HIMSELF AS LEE OSWALD, STATED HE HAD BEEN AT SOVEMB ON 28 SEPT.",
    matchedTerms: ["Lee Oswald", "Oswald"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 1",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["mexico-city", "cia"],
  }),
  mkMention({
    id: "m-005",
    documentId: "mexico-city-cable-oct8",
    excerpt:
      "SPOKEN WITH CONSUL KOSTIKOV. CONSIDERED SENSITIVE CONTACT UNDER CI/SIG REVIEW.",
    matchedTerms: ["Kostikov"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 2",
    entitySlugs: ["cia"],
    topicSlugs: ["mexico-city", "cia"],
  }),
  mkMention({
    id: "m-006",
    documentId: "fbi-hoover-memo-nov24",
    excerpt:
      "The thing I am concerned about, and so is Mr. Katzenbach, is having something issued so we can convince the public that Oswald is the real assassin.",
    matchedTerms: ["Oswald", "Katzenbach"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 1",
    entitySlugs: ["oswald", "hoover", "fbi"],
    topicSlugs: ["fbi", "warren-commission"],
  }),
  mkMention({
    id: "m-007",
    documentId: "oswald-marines-service-record",
    excerpt:
      "OSWALD, LEE H. Recruited 24 October 1956, San Diego, California. Aviation electronics, MOS 6741. MCAS Atsugi, Japan.",
    matchedTerms: ["Oswald"],
    confidence: "high",
    source: "title",
    pageLabel: "SRB §1",
    entitySlugs: ["oswald"],
    topicSlugs: [],
  }),
  mkMention({
    id: "m-008",
    documentId: "ruby-polygraph-transcript",
    excerpt:
      "Q: Did you ever know Lee Harvey Oswald before November 22, 1963? A: No. Q: Did you shoot Oswald to silence him? A: No.",
    matchedTerms: ["Ruby", "Oswald"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 32",
    entitySlugs: ["ruby", "oswald"],
    topicSlugs: ["fbi", "warren-commission"],
  }),
  mkMention({
    id: "m-009",
    documentId: "marina-oswald-testimony-feb3",
    excerpt:
      "Mrs. OSWALD: I did not like the idea of him going to Mexico. He had told me he wanted to go to Cuba. I objected to this trip.",
    matchedTerms: ["Oswald", "Mexico"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 41",
    entitySlugs: ["marina-oswald", "oswald"],
    topicSlugs: ["mexico-city", "warren-commission"],
  }),
  mkMention({
    id: "m-010",
    documentId: "dallas-police-fd302-dec3",
    excerpt:
      "RUBY was known to frequent Police Headquarters and had, on several occasions, brought sandwiches to officers working the night shift.",
    matchedTerms: ["Ruby"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "FD-302 §2",
    entitySlugs: ["ruby"],
    topicSlugs: ["fbi"],
  }),
  mkMention({
    id: "m-011",
    documentId: "angleton-memo-ci-routing",
    excerpt:
      "Attached cable from Mexico City station concerns an American male who identified himself as LEE OSWALD, reportedly in contact with Soviet consular officer KOSTIKOV.",
    matchedTerms: ["Oswald", "Kostikov"],
    confidence: "high",
    source: "description",
    pageLabel: "p. 1",
    entitySlugs: ["angleton", "oswald", "cia"],
    topicSlugs: ["cia", "mexico-city"],
  }),
  mkMention({
    id: "m-012",
    documentId: "hsca-acoustics-report",
    excerpt:
      "With a probability of 95 percent or better, four shots were fired at the Presidential limousine in Dealey Plaza.",
    matchedTerms: ["four shots", "Dealey Plaza"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 46",
    entitySlugs: ["hsca"],
    topicSlugs: ["hsca"],
  }),
  mkMention({
    id: "m-013",
    documentId: "arrb-oswald-walker",
    excerpt:
      "The photographic evidence, including the backyard photographs and the note left for Marina Oswald, is reviewed in Part II.",
    matchedTerms: ["Oswald", "backyard photographs"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "§II",
    entitySlugs: ["oswald", "marina-oswald"],
    topicSlugs: [],
  }),
  mkMention({
    id: "m-014",
    documentId: "secret-service-trip-report",
    excerpt:
      "Motorcade will proceed from Love Field via Mockingbird Lane, Lemmon Avenue, and Main Street to the Trade Mart.",
    matchedTerms: ["motorcade", "Love Field"],
    confidence: "low",
    source: "ocr",
    pageLabel: "p. 4",
    entitySlugs: [],
    topicSlugs: [],
  }),
  mkMention({
    id: "m-015",
    documentId: "state-dept-oswald-passport",
    excerpt:
      "Passport issued to LEE HARVEY OSWALD on 25 June 1963 at New Orleans, Louisiana. Prior passport surrendered at Moscow.",
    matchedTerms: ["Oswald", "passport"],
    confidence: "high",
    source: "title",
    pageLabel: "§A",
    entitySlugs: ["oswald"],
    topicSlugs: ["mexico-city"],
  }),
  mkMention({
    id: "m-016",
    documentId: "nosenko-debriefing-summary",
    excerpt:
      "NOSENKO states the KGB had no operational interest in OSWALD during his Minsk residency and did not debrief him in any systematic fashion.",
    matchedTerms: ["Oswald", "KGB"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 14",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-017",
    documentId: "cuba-project-jmwave",
    excerpt:
      "DRE leadership in Miami maintained contact with their New Orleans delegate, who reported an encounter with a subject named LEE OSWALD in August.",
    matchedTerms: ["Oswald", "DRE"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 12",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-018",
    documentId: "hsca-cia-liaison-file",
    excerpt:
      "Staff access to CIA holdings is coordinated through the Office of Legislative Counsel on a need-to-know basis.",
    matchedTerms: ["HSCA", "CIA"],
    confidence: "low",
    source: "description",
    pageLabel: "§1",
    entitySlugs: ["hsca", "cia"],
    topicSlugs: ["hsca", "cia"],
  }),
  mkMention({
    id: "m-019",
    documentId: "wc-report-1964",
    excerpt:
      "The Commission has found no evidence that either Lee Harvey Oswald or Jack Ruby was part of any conspiracy, domestic or foreign, to assassinate President Kennedy.",
    matchedTerms: ["Oswald", "Ruby", "conspiracy"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 21",
    entitySlugs: ["oswald", "ruby", "warren-commission"],
    topicSlugs: ["warren-commission"],
  }),
  mkMention({
    id: "m-020",
    documentId: "wc-report-1964",
    excerpt:
      "The shots were fired from the sixth floor window at the southeast corner of the Texas School Book Depository.",
    matchedTerms: ["Texas School Book Depository"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 61",
    entitySlugs: ["warren-commission"],
    topicSlugs: ["warren-commission"],
  }),
  mkMention({
    id: "m-021",
    documentId: "hsca-final-report",
    excerpt:
      "President Kennedy was probably assassinated as a result of a conspiracy. The Committee is unable to identify the other gunman or the extent of the conspiracy.",
    matchedTerms: ["conspiracy", "Kennedy"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 1",
    entitySlugs: ["hsca"],
    topicSlugs: ["hsca"],
  }),
  mkMention({
    id: "m-022",
    documentId: "oswald-201-file-vol1",
    excerpt:
      "OSWALD is a former U.S. Marine with a Top Secret crypto clearance, last assigned MCAS Atsugi, Japan.",
    matchedTerms: ["Oswald", "Marine", "Atsugi"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 4",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-023",
    documentId: "mexico-city-cable-oct8",
    excerpt:
      "REQUEST HQ TRACES ON SUBJECT LEE OSWALD, DPOB APPROX 1939 USA, REPORTEDLY FORMER USMC.",
    matchedTerms: ["Lee Oswald", "USMC"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 2",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["mexico-city", "cia"],
  }),
  mkMention({
    id: "m-024",
    documentId: "fbi-hoover-memo-nov24",
    excerpt:
      "The President's Commission will need the Bureau's full investigative file on OSWALD at the earliest possible moment.",
    matchedTerms: ["Oswald", "Commission"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 3",
    entitySlugs: ["hoover", "oswald", "fbi", "warren-commission"],
    topicSlugs: ["fbi", "warren-commission"],
  }),
  mkMention({
    id: "m-025",
    documentId: "marina-oswald-testimony-feb3",
    excerpt:
      "I knew he had a rifle. He kept it on the porch, wrapped in a blanket. He told me it was for protection.",
    matchedTerms: ["rifle"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 88",
    entitySlugs: ["marina-oswald", "oswald"],
    topicSlugs: ["warren-commission"],
  }),
  mkMention({
    id: "m-026",
    documentId: "ruby-polygraph-transcript",
    excerpt:
      "Q: Did you enter the Dallas Police basement with the intent to shoot Oswald? A: I acted on impulse.",
    matchedTerms: ["Ruby", "Oswald"],
    confidence: "high",
    source: "ocr",
    pageLabel: "p. 47",
    entitySlugs: ["ruby", "oswald"],
    topicSlugs: ["fbi", "warren-commission"],
  }),
  mkMention({
    id: "m-027",
    documentId: "angleton-memo-ci-routing",
    excerpt:
      "For CI/SIG review. Copies to DCI and CI/OPS. Subject is indexed at CIA/OS under case file 100-300-011.",
    matchedTerms: ["CI/SIG", "Angleton"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 3",
    entitySlugs: ["angleton", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-028",
    documentId: "cuba-project-jmwave",
    excerpt:
      "Station advises that pro-Castro leafleting by FPCC activist LEE OSWALD in New Orleans was reported in August.",
    matchedTerms: ["Oswald", "FPCC"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 30",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-029",
    documentId: "dallas-police-fd302-dec3",
    excerpt:
      "Officer advised that several reporters were present in the basement when RUBY stepped forward and fired.",
    matchedTerms: ["Ruby"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "FD-302 §3",
    entitySlugs: ["ruby"],
    topicSlugs: ["fbi"],
  }),
  mkMention({
    id: "m-030",
    documentId: "nosenko-debriefing-summary",
    excerpt:
      "The KGB file on OSWALD is stated by NOSENKO to consist of routine surveillance traffic and no operational tasking.",
    matchedTerms: ["Oswald", "KGB"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "p. 22",
    entitySlugs: ["oswald", "cia"],
    topicSlugs: ["cia"],
  }),
  mkMention({
    id: "m-031",
    documentId: "state-dept-oswald-passport",
    excerpt:
      "1961 consular correspondence regarding repatriation of MRS. MARINA N. OSWALD and infant daughter from Moscow to New York.",
    matchedTerms: ["Oswald", "Moscow"],
    confidence: "medium",
    source: "ocr",
    pageLabel: "§B",
    entitySlugs: ["oswald", "marina-oswald"],
    topicSlugs: [],
  }),
  mkMention({
    id: "m-032",
    documentId: "hsca-cia-liaison-file",
    excerpt:
      "Committee staff logged 214 separate reading sessions at CIA's Ames Building during the course of the inquiry.",
    matchedTerms: ["CIA", "HSCA"],
    confidence: "low",
    source: "ocr",
    pageLabel: "§4",
    entitySlugs: ["hsca", "cia"],
    topicSlugs: ["hsca", "cia"],
  }),
];

function mkMention(m: {
  id: string;
  documentId: string;
  excerpt: string;
  matchedTerms: string[];
  confidence: ConfidenceLevel;
  source: MentionExcerpt["source"];
  pageLabel?: string;
  entitySlugs: string[];
  topicSlugs: string[];
}): MentionSeed {
  const doc = DOCUMENT_SEEDS.find((d) => d.id === m.documentId);
  return {
    id: m.id,
    documentId: m.documentId,
    documentTitle: doc?.title ?? m.documentId,
    documentHref: `/document/${m.documentId}`,
    excerpt: m.excerpt,
    matchedTerms: m.matchedTerms,
    confidence: m.confidence,
    source: m.source,
    pageLabel: m.pageLabel,
    entitySlugs: m.entitySlugs,
    topicSlugs: m.topicSlugs,
  };
}

// ----------------------------------------------------------------------------
// Timeline (Oswald)
// ----------------------------------------------------------------------------

const OSWALD_TIMELINE: TimelineEvent[] = [
  {
    id: "t-oswald-birth",
    date: "1939-10-18",
    dateLabel: "October 18, 1939",
    title: "Born in New Orleans, Louisiana",
    description:
      "Lee Harvey Oswald is born at Old French Hospital, New Orleans, to Marguerite Claverie Oswald.",
  },
  {
    id: "t-oswald-marines",
    date: "1956-10-24",
    dateLabel: "October 24, 1956",
    title: "Enlists in the U.S. Marine Corps",
    description:
      "Enlists in Dallas at age 17; reports to the Marine Corps Recruit Depot, San Diego, on October 26, 1956. Trains in aviation electronics and is later assigned as a radar operator at MCAS Atsugi, Japan.",
    relatedDocumentIds: ["oswald-marines-service-record"],
  },
  {
    id: "t-oswald-defection",
    date: "1959-10-31",
    dateLabel: "October 31, 1959",
    title: "Renounces U.S. citizenship in Moscow",
    description:
      "Appears at the U.S. Embassy in Moscow and declares his intent to renounce U.S. citizenship. The CIA opens a 201 personality file on Oswald in December 1960.",
    relatedDocumentIds: ["oswald-201-file-vol1", "state-dept-oswald-passport"],
  },
  {
    id: "t-oswald-minsk",
    date: "1960-01-07",
    dateLabel: "January 1960",
    title: "Resettled in Minsk, Byelorussian SSR",
    description:
      "Lives and works at the Gorizont radio and television factory in Minsk. Marries Marina N. Prusakova in April 1961.",
  },
  {
    id: "t-oswald-return",
    date: "1962-06-13",
    dateLabel: "June 13, 1962",
    title: "Returns to the United States",
    description:
      "Arrives in New York with Marina and infant daughter June; interviewed at Idlewild Airport by FBI. Settles first in Fort Worth, then Dallas.",
  },
  {
    id: "t-oswald-walker",
    date: "1963-04-10",
    dateLabel: "April 10, 1963",
    title: "Alleged shooting at General Walker's residence",
    description:
      "A rifle shot is fired through the dining-room window of Major General Edwin A. Walker's Dallas home. Warren Commission and ARRB records attribute the shot to Oswald.",
    relatedDocumentIds: ["arrb-oswald-walker"],
  },
  {
    id: "t-oswald-mexico",
    date: "1963-09-27",
    dateLabel: "September 27 – October 2, 1963",
    title: "Visits Mexico City",
    description:
      "Travels to Mexico City and visits the Cuban consulate and the Soviet embassy. CIA station cables record the contact; no visa is issued.",
    relatedDocumentIds: ["mexico-city-cable-oct8", "angleton-memo-ci-routing"],
  },
  {
    id: "t-oswald-assassination",
    date: "1963-11-22",
    dateLabel: "November 22, 1963",
    title: "Assassination of President Kennedy",
    description:
      "President Kennedy is fatally shot in Dealey Plaza, Dallas, at 12:30 p.m. local time. Oswald is arrested at the Texas Theatre at 1:50 p.m.",
    relatedDocumentIds: ["secret-service-trip-report"],
  },
  {
    id: "t-oswald-tippit",
    date: "1963-11-22",
    dateLabel: "November 22, 1963 (1:15 p.m.)",
    title: "Murder of Officer J. D. Tippit",
    description:
      "Dallas Police Officer J. D. Tippit is shot and killed at East 10th Street and Patton Avenue in Oak Cliff. Nine eyewitnesses later identify Oswald as the gunman in lineups or photo arrays; Oswald is charged the same day with both the Tippit and Kennedy murders.",
  },
  {
    id: "t-oswald-killed",
    date: "1963-11-24",
    dateLabel: "November 24, 1963",
    title: "Shot and killed by Jack Ruby",
    description:
      "During a jail transfer in the basement of Dallas Police Headquarters, Oswald is shot by Jack Ruby, a Dallas nightclub owner. He is pronounced dead at Parkland Hospital.",
    relatedDocumentIds: ["dallas-police-fd302-dec3", "ruby-polygraph-transcript"],
  },
];

// ----------------------------------------------------------------------------
// Access helpers
// ----------------------------------------------------------------------------

export function listEntities(): EntityDetail[] {
  return Object.values(ENTITY_TABLE);
}

export function getEntity(slug: string): EntityDetail | null {
  return ENTITY_TABLE[slug] ?? null;
}

export function entityToCard(e: EntityDetail): EntityCard {
  return {
    slug: e.slug,
    name: e.name,
    type: e.type,
    summary: e.summary,
    documentCount: e.documentCount,
    mentionCount: e.mentionCount,
    href: e.href,
    aliases: e.aliases,
  };
}

export function listTopics(): TopicDetail[] {
  return Object.values(TOPIC_TABLE);
}

export function getTopic(slug: string): TopicDetail | null {
  return TOPIC_TABLE[slug] ?? null;
}

export function topicToCard(t: TopicDetail): TopicCard {
  return {
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    documentCount: t.documentCount,
    href: t.href,
    eyebrow: t.eyebrow,
  };
}

export function listDocuments(): DocumentSeed[] {
  return DOCUMENT_SEEDS;
}

export function getDocument(id: string): DocumentSeed | null {
  return DOCUMENT_SEEDS.find((d) => d.id === id) ?? null;
}

export function documentToCard(d: DocumentSeed | DocumentDetail): DocumentCard {
  return {
    id: d.id,
    naid: d.naid,
    title: d.title,
    subtitle: d.subtitle ?? null,
    snippet: d.ocrExcerpt ?? d.description?.slice(0, 220) ?? null,
    href: d.href,
    tags: d.tags,
    agency: d.agency ?? null,
    date: d.date ?? null,
    dateLabel: d.dateLabel ?? null,
    documentType: d.documentType ?? null,
    hasOcr: d.hasOcr,
  };
}

export function listMentions(): MentionSeed[] {
  return MENTION_SEEDS;
}

// ----------------------------------------------------------------------------
// Composite responses
// ----------------------------------------------------------------------------

export function buildHomeResponse(): HomeResponse {
  const featuredEntitySlugs = ["oswald", "ruby", "cia", "fbi", "warren-commission", "hsca"];
  const featuredTopicSlugs = ["warren-commission", "hsca", "mexico-city", "cia", "fbi"];

  const totalDocs = 14302;
  const totalMentions = 186421;

  const recent = [...DOCUMENT_SEEDS]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 6)
    .map(documentToCard);

  return {
    stats: {
      documentCount: totalDocs,
      mentionCount: totalMentions,
      entityCount: Object.keys(ENTITY_TABLE).length,
      topicCount: Object.keys(TOPIC_TABLE).length,
    },
    featuredEntities: featuredEntitySlugs
      .map((s) => ENTITY_TABLE[s])
      .filter(Boolean)
      .map(entityToCard),
    featuredTopics: featuredTopicSlugs
      .map((s) => TOPIC_TABLE[s])
      .filter(Boolean)
      .map(topicToCard),
    recentDocuments: recent,
    corpusManifest: {
      totalRecords: totalDocs,
      recordsWithOcr: 2162,
      latestIndexedReleaseDate: "2023-08-24",
      releasesIndexed: ["2017-2018", "2021", "2022", "2023"],
      releasesPending: ["2025", "2026"],
      coverageNote:
        "~37K of ~300K records in the Collection. 2025 and 2026 unredacted releases are not yet indexed.",
    },
  };
}

export function buildEntityResponse(slug: string): EntityResponse | null {
  const entity = getEntity(slug);
  if (!entity) return null;

  const topDocuments = DOCUMENT_SEEDS.filter((d) => d.entities.includes(slug))
    .slice(0, 8)
    .map(documentToCard);

  const mentions = MENTION_SEEDS.filter((m) => m.entitySlugs.includes(slug)).slice(
    0,
    10,
  );

  const relatedTopicSet = new Set<string>();
  for (const d of DOCUMENT_SEEDS.filter((d) => d.entities.includes(slug))) {
    d.topics.forEach((t) => relatedTopicSet.add(t));
  }
  const relatedTopics = Array.from(relatedTopicSet)
    .map((s) => TOPIC_TABLE[s])
    .filter(Boolean)
    .slice(0, 6)
    .map(topicToCard);

  const relatedEntitySet = new Set<string>();
  for (const d of DOCUMENT_SEEDS.filter((d) => d.entities.includes(slug))) {
    d.entities.forEach((e) => {
      if (e !== slug) relatedEntitySet.add(e);
    });
  }
  const relatedEntities = Array.from(relatedEntitySet)
    .map((s) => ENTITY_TABLE[s])
    .filter(Boolean)
    .slice(0, 6)
    .map(entityToCard);

  const timeline = slug === "oswald" ? OSWALD_TIMELINE : [];

  return {
    entity,
    timeline,
    relatedTopics,
    relatedEntities,
    topDocuments,
    mentionExcerpts: mentions,
    sources: [],
  };
}

export function buildTopicResponse(slug: string): TopicResponse | null {
  const topic = getTopic(slug);
  if (!topic) return null;

  const docs = DOCUMENT_SEEDS.filter((d) => d.topics.includes(slug));
  const topDocuments = docs.slice(0, 8).map(documentToCard);

  const mentions = MENTION_SEEDS.filter((m) => m.topicSlugs.includes(slug)).slice(
    0,
    8,
  );

  const relatedEntitySet = new Set<string>();
  for (const d of docs) {
    d.entities.forEach((e) => relatedEntitySet.add(e));
  }
  const relatedEntities = Array.from(relatedEntitySet)
    .map((s) => ENTITY_TABLE[s])
    .filter(Boolean)
    .slice(0, 6)
    .map(entityToCard);

  return {
    topic,
    relatedEntities,
    topDocuments,
    mentionExcerpts: mentions,
  };
}

export function buildDocumentResponse(id: string): DocumentResponse | null {
  const doc = getDocument(id);
  if (!doc) return null;

  const mentions = MENTION_SEEDS.filter((m) => m.documentId === id);

  const relatedEntities = doc.entities
    .map((s) => ENTITY_TABLE[s])
    .filter(Boolean)
    .slice(0, 8)
    .map(entityToCard);

  const relatedDocuments = DOCUMENT_SEEDS.filter(
    (d) =>
      d.id !== id &&
      (d.topics.some((t) => doc.topics.includes(t)) ||
        d.entities.some((e) => doc.entities.includes(e))),
  )
    .slice(0, 6)
    .map(documentToCard);

  const { entities: _e, topics: _t, ...rest } = doc;
  return {
    document: rest,
    mentions,
    relatedEntities,
    relatedDocuments,
  };
}

// ----------------------------------------------------------------------------
// Search
// ----------------------------------------------------------------------------

export function buildSearchResponse({
  query,
  mode,
}: {
  query: string;
  mode: "document" | "mention";
}): SearchResponse {
  const q = query.trim().toLowerCase();

  const filters = {
    years: ["1959", "1960", "1963", "1964", "1968", "1978", "1979", "1998"],
    agencies: [
      "CIA",
      "FBI",
      "Warren Commission",
      "HSCA",
      "ARRB",
      "Secret Service",
      "Department of State",
      "Department of Defense",
    ],
    topics: Object.keys(TOPIC_TABLE).map(
      (s) => TOPIC_TABLE[s].title,
    ),
    entities: Object.values(ENTITY_TABLE).map((e) => e.name),
    confidence: ["high", "medium", "low"] as ConfidenceLevel[],
  };

  let results: SearchResult[] = [];

  if (mode === "document") {
    const matches = DOCUMENT_SEEDS.filter((d) => matchesDocument(d, q));
    results = matches.map<SearchResult>((d) => ({
      kind: "document",
      document: documentToCard(d),
      mentionCount: MENTION_SEEDS.filter((m) => m.documentId === d.id).length,
      confidence: confidenceForDoc(d, q),
    }));
  } else {
    const matches = MENTION_SEEDS.filter((m) =>
      q.length === 0
        ? true
        : m.excerpt.toLowerCase().includes(q) ||
          m.matchedTerms.some((t) => t.toLowerCase().includes(q)),
    );
    results = matches.map<SearchResult>((m) => ({ kind: "mention", mention: m }));
  }

  return {
    query,
    mode,
    total: results.length,
    filters,
    results,
  };
}

function matchesDocument(d: DocumentSeed, q: string): boolean {
  if (!q) return true;
  const hay = [
    d.title,
    d.subtitle ?? "",
    d.description ?? "",
    d.ocrExcerpt ?? "",
    d.tags.join(" "),
    d.agency ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function confidenceForDoc(d: DocumentSeed, q: string): ConfidenceLevel {
  if (!q) return "medium";
  const title = d.title.toLowerCase();
  const desc = (d.description ?? "").toLowerCase();
  const ocr = (d.ocrExcerpt ?? "").toLowerCase();
  if (title.includes(q)) return "high";
  if (desc.includes(q)) return "medium";
  if (ocr.includes(q)) return "low";
  return "low";
}
