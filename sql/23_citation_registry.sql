-- 23_citation_registry.sql
--
-- Purpose:
--   Canonical citation table for the site. Backs a future /bibliography
--   surface (Phase 3-I) and the P0-8 full-version per-sentence entity
--   bio footnotes. An allowlist bool gates which external sources the
--   site is willing to cite in AI-generated content — partisan blogs
--   and self-published books intentionally stay off the allowlist.
--
-- Schema:
--   citation_id     e.g. \'WC-REPORT\', \'WC-HEARINGS-V3\', \'HSCA-RPT\',
--                   \'ARRB-FINAL\', \'CHURCH-BOOK-V\', \'NAS-RAMSEY-1982\'.
--   citation_type   NAID | WC | HSCA | ARRB | CHURCH | REPORT | NARA |
--                   JOURNAL | BOOK | NEWS
--   bluebook/chicago/apa  Pre-formatted citation strings for each style.
--   allowlisted     Whether this source may be cited in AI-generated
--                   content on the site.
--
-- Dependencies: (none)

create or replace table jfk_curated.citation_registry as
with base as (
  select * from unnest([
    struct<
      citation_id     string,
      citation_type   string,
      bluebook        string,
      chicago         string,
      apa             string,
      url             string,
      author          string,
      title           string,
      publisher       string,
      year            int64,
      allowlisted     bool,
      sort_order      int64
    >(
      -- Warren Commission Report + 26 Volumes of Hearings
      'WC-REPORT', 'WC',
      'Warren Comm\'n, Report of the President\'s Comm\'n on the Assassination of President Kennedy (1964).',
      'Warren Commission. 1964. Report of the President\'s Commission on the Assassination of President Kennedy. Washington, DC: U.S. Government Printing Office.',
      'President\'s Commission on the Assassination of President Kennedy. (1964). Report of the President\'s Commission on the Assassination of President Kennedy. U.S. Government Printing Office.',
      'https://www.archives.gov/research/jfk/warren-commission-report',
      'President\'s Commission on the Assassination of President Kennedy',
      'Report of the President\'s Commission on the Assassination of President Kennedy',
      'U.S. Government Printing Office', 1964, true, 1
    ),
    -- ARRB
    ('ARRB-FINAL', 'ARRB',
     'Assassination Records Review Bd., Final Report of the Assassination Records Review Board (1998).',
     'Assassination Records Review Board. 1998. Final Report of the Assassination Records Review Board. Washington, DC: U.S. Government Printing Office.',
     'Assassination Records Review Board. (1998). Final Report of the Assassination Records Review Board. U.S. Government Printing Office.',
     'https://www.archives.gov/research/jfk/review-board/report',
     'Assassination Records Review Board',
     'Final Report of the Assassination Records Review Board',
     'U.S. Government Printing Office', 1998, true, 100),
    -- HSCA Final Report
    ('HSCA-REPORT', 'HSCA',
     'H.R. Rep. No. 95-1828 (1979).',
     'U.S. House Select Committee on Assassinations. 1979. Report of the Select Committee on Assassinations of the U.S. House of Representatives. Washington, DC: U.S. Government Printing Office.',
     'U.S. House Select Committee on Assassinations. (1979). Report of the Select Committee on Assassinations of the U.S. House of Representatives. U.S. Government Printing Office.',
     'https://www.archives.gov/research/jfk/select-committee-report',
     'U.S. House Select Committee on Assassinations',
     'Report of the Select Committee on Assassinations of the U.S. House of Representatives',
     'U.S. Government Printing Office', 1979, true, 200),
    -- Church Committee Book V
    ('CHURCH-BOOK-V', 'CHURCH',
     'S. Rep. No. 94-755, bk. V (1976).',
     'U.S. Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities. 1976. The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies. Book V of the Final Report. Washington, DC: U.S. Government Printing Office.',
     'U.S. Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities. (1976). The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies. Book V of the Final Report. U.S. Government Printing Office.',
     'https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-94755-v.pdf',
     'U.S. Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities (Church Committee)',
     'Book V: The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies',
     'U.S. Government Printing Office', 1976, true, 300),
    -- NAS/Ramsey Panel (1982)
    ('NAS-RAMSEY-1982', 'REPORT',
     'Nat\'l Research Council, Committee on Ballistic Acoustics, Report of the Committee on Ballistic Acoustics (1982).',
     'National Research Council. Committee on Ballistic Acoustics. 1982. Report of the Committee on Ballistic Acoustics. Washington, DC: National Academy Press.',
     'National Research Council, Committee on Ballistic Acoustics. (1982). Report of the Committee on Ballistic Acoustics. National Academy Press.',
     'https://nap.nationalacademies.org/catalog/10264/report-of-the-committee-on-ballistic-acoustics',
     'National Research Council, Committee on Ballistic Acoustics (Ramsey Panel)',
     'Report of the Committee on Ballistic Acoustics',
     'National Academy Press', 1982, true, 400),
    -- Clark Panel (1968)
    ('CLARK-PANEL-1968', 'REPORT',
     '1968 Panel Review of Photographs, X-Ray Films, Documents and Other Evidence Pertaining to the Fatal Wounding of President John F. Kennedy (Clark Panel Report) (1968).',
     'Clark Panel. 1968. 1968 Panel Review of Photographs, X-Ray Films, Documents and Other Evidence Pertaining to the Fatal Wounding of President John F. Kennedy. Washington, DC: U.S. Department of Justice.',
     'Clark Panel. (1968). 1968 Panel Review of Photographs, X-Ray Films, Documents and Other Evidence Pertaining to the Fatal Wounding of President John F. Kennedy. U.S. Department of Justice.',
     'https://www.archives.gov/research/jfk/select-committee-report',
     'Clark Panel (Attorney General Ramsey Clark)',
     '1968 Panel Review of Photographs, X-Ray Films, Documents and Other Evidence Pertaining to the Fatal Wounding of President John F. Kennedy',
     'U.S. Department of Justice', 1968, true, 500),
    -- Rockefeller Commission (1975)
    ('ROCKEFELLER-1975', 'REPORT',
     'Comm\'n on CIA Activities Within the U.S., Report to the President (1975).',
     'Commission on CIA Activities Within the United States. 1975. Report to the President. Washington, DC: U.S. Government Printing Office.',
     'Commission on CIA Activities Within the United States. (1975). Report to the President. U.S. Government Printing Office.',
     'https://www.cia.gov/readingroom/collection/rockefeller-commission',
     'Commission on CIA Activities Within the United States (Rockefeller Commission)',
     'Report to the President',
     'U.S. Government Printing Office', 1975, true, 600),
    -- JFK Records Act (1992)
    ('JFK-RECORDS-ACT', 'REPORT',
     'President John F. Kennedy Assassination Records Collection Act of 1992, Pub. L. No. 102-526, 106 Stat. 3443.',
     'U.S. Congress. 1992. President John F. Kennedy Assassination Records Collection Act of 1992. Public Law 102-526, 106 Stat. 3443.',
     'U.S. Congress. (1992). President John F. Kennedy Assassination Records Collection Act of 1992 (Pub. L. No. 102-526). U.S. Government Printing Office.',
     'https://www.archives.gov/research/jfk/jfk-act',
     'U.S. Congress',
     'President John F. Kennedy Assassination Records Collection Act of 1992',
     'U.S. Government Printing Office', 1992, true, 700),
    -- DOJ 1988 letter declining to reopen
    ('DOJ-1988-LETTER', 'REPORT',
     'Letter from Asst. Att\'y Gen. William F. Weld to the Hon. Jim Wright, Speaker of the House (Mar. 28, 1988).',
     'U.S. Department of Justice. 1988. Letter from Assistant Attorney General William F. Weld to the Honorable Jim Wright, Speaker of the House. March 28, 1988.',
     'U.S. Department of Justice. (1988, March 28). Letter from Assistant Attorney General William F. Weld to the Honorable Jim Wright, Speaker of the House.',
     'https://www.archives.gov/research/jfk/select-committee-report',
     'U.S. Department of Justice',
     'Letter to the Speaker of the House re: Kennedy Assassination Reinvestigation',
     'U.S. Department of Justice', 1988, true, 800),
    -- NARA finding aid: JFK Collection main page
    ('NARA-JFK-MAIN', 'NARA',
     'Nat\'l Archives & Records Admin., JFK Assassination Records (finding aid), https://www.archives.gov/research/jfk.',
     'National Archives and Records Administration. n.d. JFK Assassination Records. Accessed via https://www.archives.gov/research/jfk.',
     'National Archives and Records Administration. (n.d.). JFK Assassination Records. Retrieved from https://www.archives.gov/research/jfk',
     'https://www.archives.gov/research/jfk',
     'National Archives and Records Administration',
     'JFK Assassination Records — finding aid',
     'National Archives and Records Administration', null, true, 900),
    ('NARA-RELEASE-2025', 'NARA',
     'Nat\'l Archives & Records Admin., 2025 Release — President John F. Kennedy Assassination Records, https://www.archives.gov/research/jfk/release-2025.',
     'National Archives and Records Administration. 2025. 2025 Release — President John F. Kennedy Assassination Records.',
     'National Archives and Records Administration. (2025). 2025 Release — President John F. Kennedy Assassination Records. Retrieved from https://www.archives.gov/research/jfk/release-2025',
     'https://www.archives.gov/research/jfk/release-2025',
     'National Archives and Records Administration',
     '2025 Release — President John F. Kennedy Assassination Records',
     'National Archives and Records Administration', 2025, true, 910),
    ('NARA-FBI-RECORDS', 'NARA',
     'Nat\'l Archives & Records Admin., FBI Records (JFK Collection), https://www.archives.gov/research/jfk/fbi-records.',
     'National Archives and Records Administration. n.d. FBI Records (JFK Assassination Records Collection).',
     'National Archives and Records Administration. (n.d.). FBI Records (JFK Assassination Records Collection). Retrieved from https://www.archives.gov/research/jfk/fbi-records',
     'https://www.archives.gov/research/jfk/fbi-records',
     'National Archives and Records Administration',
     'FBI Records in the JFK Collection',
     'National Archives and Records Administration', null, true, 920),
    ('NARA-CIA-RECORDS', 'NARA',
     'Nat\'l Archives & Records Admin., CIA Records (JFK Collection), https://www.archives.gov/research/jfk/cia-records.',
     'National Archives and Records Administration. n.d. CIA Records (JFK Assassination Records Collection).',
     'National Archives and Records Administration. (n.d.). CIA Records (JFK Assassination Records Collection). Retrieved from https://www.archives.gov/research/jfk/cia-records',
     'https://www.archives.gov/research/jfk/cia-records',
     'National Archives and Records Administration',
     'CIA Records in the JFK Collection',
     'National Archives and Records Administration', null, true, 930),
    -- FBI Records Vault
    ('FBI-VAULT-JFK', 'REPORT',
     'Fed. Bureau of Investigation, FBI Records: The Vault — John F. Kennedy Assassination, https://vault.fbi.gov/John%20F.%20Kennedy%20Assassination%20File.',
     'Federal Bureau of Investigation. n.d. FBI Records: The Vault — John F. Kennedy Assassination.',
     'Federal Bureau of Investigation. (n.d.). FBI Records: The Vault — John F. Kennedy Assassination. Retrieved from https://vault.fbi.gov/John%20F.%20Kennedy%20Assassination%20File',
     'https://vault.fbi.gov/John%20F.%20Kennedy%20Assassination%20File',
     'Federal Bureau of Investigation',
     'FBI Records: The Vault — John F. Kennedy Assassination',
     'Federal Bureau of Investigation', null, true, 940),
    -- Ruby v. Texas (TX 1966)
    ('RUBY-V-TEXAS-1966', 'REPORT',
     'Ruby v. Texas, 407 S.W.2d 793 (Tex. Crim. App. 1966).',
     'Texas Court of Criminal Appeals. 1966. Ruby v. Texas, 407 S.W.2d 793.',
     'Texas Court of Criminal Appeals. (1966). Ruby v. Texas, 407 S.W.2d 793.',
     null,
     'Texas Court of Criminal Appeals',
     'Ruby v. Texas, 407 S.W.2d 793',
     'Texas Court of Criminal Appeals', 1966, true, 1000)
  ])
),
wc_hearings as (
  -- Generate 26 Warren Commission Hearings volume citations.
  select
    format('WC-HEARINGS-V%d', v) as citation_id,
    'WC' as citation_type,
    format('Warren Comm\'n, Hearings Before the President\'s Comm\'n on the Assassination of President Kennedy, vol. %d (1964).', v) as bluebook,
    format('Warren Commission. 1964. Hearings Before the President\'s Commission on the Assassination of President Kennedy, Volume %d. Washington, DC: U.S. Government Printing Office.', v) as chicago,
    format('President\'s Commission on the Assassination of President Kennedy. (1964). Hearings Before the President\'s Commission on the Assassination of President Kennedy (Vol. %d). U.S. Government Printing Office.', v) as apa,
    'https://www.archives.gov/research/jfk/warren-commission-hearings' as url,
    'President\'s Commission on the Assassination of President Kennedy' as author,
    format('Hearings Before the President\'s Commission on the Assassination of President Kennedy, Volume %d', v) as title,
    'U.S. Government Printing Office' as publisher,
    1964 as year,
    true as allowlisted,
    1 + v as sort_order
  from unnest(generate_array(1, 26)) as v
),
hsca_appendices as (
  -- Generate 12 HSCA appendix volume citations.
  select
    format('HSCA-APPX-V%d', v) as citation_id,
    'HSCA' as citation_type,
    format('H. Select Comm. on Assassinations, Investigation of the Assassination of President John F. Kennedy, Appendix to Hearings, vol. %d (1979).', v) as bluebook,
    format('U.S. House Select Committee on Assassinations. 1979. Investigation of the Assassination of President John F. Kennedy, Appendix to Hearings, Volume %d. Washington, DC: U.S. Government Printing Office.', v) as chicago,
    format('U.S. House Select Committee on Assassinations. (1979). Investigation of the Assassination of President John F. Kennedy, Appendix to Hearings (Vol. %d). U.S. Government Printing Office.', v) as apa,
    'https://www.archives.gov/research/jfk/select-committee-report' as url,
    'U.S. House Select Committee on Assassinations' as author,
    format('Investigation of the Assassination of President John F. Kennedy, Appendix to Hearings, Volume %d', v) as title,
    'U.S. Government Printing Office' as publisher,
    1979 as year,
    true as allowlisted,
    200 + v as sort_order
  from unnest(generate_array(1, 12)) as v
)
select * from base
union all select * from wc_hearings
union all select * from hsca_appendices
;
