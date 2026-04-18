-- 15_editorial_footnotes.sql
--
-- Purpose:
--   A small, hand-curated table of standing editorial footnotes that should
--   appear alongside AI-generated analysis whenever certain claims surface.
--   The first use case (and the reason this exists in Phase 0) is to ensure
--   that any surface referencing the HSCA's 1979 acoustic-evidence finding
--   is accompanied by the 1982 NAS/Ramsey Panel rebuttal and the 1988 DOJ
--   decision not to reopen. Without this, the HSCA "probable conspiracy"
--   conclusion gets surfaced while its repudiation does not.
--
-- Attachment:
--   `applies_to_slugs` scopes a footnote to one or more topic slugs.
--   `trigger_patterns` are case-insensitive substrings; if any appears in
--   the article or thread text for that topic, the footnote is rendered.
--   An empty `trigger_patterns` array means "always attach" for the scoped
--   topics.
--
-- Dependencies: (none)

create or replace table jfk_curated.editorial_footnotes as
select * from unnest([
  struct<
    footnote_id        string,
    tag                string,
    title              string,
    body               string,
    source_citation    string,
    applies_to_slugs   array<string>,
    trigger_patterns   array<string>,
    sort_order         int64
  >(
    'hsca-acoustic-nas-ramsey',
    'hsca_acoustic',
    'HSCA acoustic finding — subsequent review',
    'The 1982 National Academy of Sciences (Ramsey Panel) report concluded that the acoustic evidence did not support the HSCA\'s finding of a second gunman. The Justice Department in 1988 declined to reopen the investigation, citing the NAS findings.',
    'National Research Council, Report of the Committee on Ballistic Acoustics (1982); U.S. Dept. of Justice Letter to the Speaker of the House, March 28, 1988.',
    ['hsca', 'warren-commission'],
    ['acoustic', 'dictabelt', 'fourth shot', 'grassy knoll shot', 'second gunman'],
    1
  )
]);
