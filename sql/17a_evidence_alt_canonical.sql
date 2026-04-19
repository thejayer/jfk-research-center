-- 17a_evidence_alt_canonical.sql
--
-- Purpose:
--   Adds image accessibility + canonical-copy fields to physical_evidence
--   without rewriting every row in sql/17. Re-running sql/17 will recreate
--   the table without these columns; this migration must be re-applied
--   afterwards. A future cleanup can fold the columns back into sql/17.
--
-- Schema additions:
--   image_alt_text       Alt text for the image_url, when one exists.
--   canonical_copy_url   Authoritative-copy URL (NARA, LoC, Sixth Floor
--                        Museum, etc.) if different from the in-page image.
--   canonical_copy_host  Human-readable host name for the canonical copy.
--
-- Backfill (April 2026 hotfix cycle):
--   - zapruder-film: NARA assassination-records page; alt text describes
--     the still-frame composition.
--   - CE-139 (Carcano): NARA Catalog id 304970; alt text describes the
--     rifle as displayed in the museum-grade scan.
--   - CE-133-A (backyard photo): NARA Catalog id 6186375; alt text
--     describes the framing of the photograph.
--
-- All other items currently lack image_url; alt/canonical fields are
-- left as empty strings until images are sourced.

alter table jfk_curated.physical_evidence
  add column if not exists image_alt_text     string,
  add column if not exists canonical_copy_url  string,
  add column if not exists canonical_copy_host string;

update jfk_curated.physical_evidence
   set image_alt_text     = case evidence_id
         when 'zapruder-film' then 'Still frame from the Zapruder film showing the presidential limousine on Elm Street.'
         when 'CE-139'        then 'Photograph of Commission Exhibit 139, the bolt-action 6.5x52mm Mannlicher-Carcano rifle, serial number C-2766, with the 4x telescopic sight mounted.'
         when 'CE-133-A'      then 'The Neely Street backyard photograph of Lee Harvey Oswald holding a rifle, with two newspapers, in the backyard of his rented duplex.'
         else image_alt_text
       end,
       canonical_copy_url  = case evidence_id
         when 'zapruder-film' then 'https://www.archives.gov/research/jfk/select-committee-report/part-1b.html'
         when 'CE-139'        then 'https://catalog.archives.gov/id/304970'
         when 'CE-133-A'      then 'https://catalog.archives.gov/id/6186375'
         else canonical_copy_url
       end,
       canonical_copy_host = case evidence_id
         when 'zapruder-film' then 'National Archives'
         when 'CE-139'        then 'National Archives Catalog'
         when 'CE-133-A'      then 'National Archives Catalog'
         else canonical_copy_host
       end
 where evidence_id in ('zapruder-film','CE-139','CE-133-A');
