-- 43_dealey_plaza_witnesses.sql
--
-- Purpose:
--   Hand-curated catalog of Dealey Plaza witnesses for the /dealey-plaza
--   interactive map. Each row carries a position (lat/lng of the
--   approximate stand point at 12:30 p.m. CST on November 22, 1963), a
--   one-line summary of the witness statement, the number of shots they
--   reported hearing, and where they perceived the shots came from.
--
-- Source posture:
--   All witness statements summarized below are sworn testimony from the
--   Warren Commission Hearings (Vols. 2-7, 19, 24) or the Sixth Floor
--   Museum / NARA finding aids. The map is illustrative — it shows
--   where each witness said they were standing. It does not establish
--   where anyone in fact was, and it intentionally renders ALL reported
--   shot origins (including grassy knoll) without color-coding that
--   would visually emphasize a single hypothesis.
--
-- Coordinate frame:
--   WGS84 lat/lng. The map renderer normalizes to an SVG viewBox over a
--   schematic of 1963 Dealey Plaza. Approximate reference points used
--   to anchor positions:
--     TSBD 6th-floor sniper window      : 32.77957, -96.80831
--     Pergola (Zapruder stand)          : 32.77931, -96.80870
--     Stockade fence (grassy knoll)     : 32.77943, -96.80887
--     Triple Underpass (south rail)     : 32.77985, -96.80950
--     Elm Street Z-313 location         : 32.77926, -96.80911
--
-- Schema:
--   witness_id              Stable slug, e.g. 'brennan-howard'.
--   name                    Display name.
--   position_lat            Approximate WGS84 latitude of stand point.
--   position_lng            Approximate WGS84 longitude of stand point.
--   position_description    Plain-language stand point label.
--   statement_summary       2-3 sentence neutral summary of the witness statement.
--   heard_shots             Integer number of shots reported, or NULL if not specified.
--   shot_origin_perceived   Free text: 'Texas School Book Depository' |
--                            'Grassy knoll / stockade fence' |
--                            'Triple underpass area' |
--                            'Could not determine' | other.
--   wc_testimony_volume     WC volume number where the witness testified, or NULL.
--   wc_testimony_page       Page citation within that volume, or NULL.
--   source_naids            NAIDs of NARA records discussing this witness.
--   role                    Plain-language role label (e.g. "Civilian witness",
--                           "Dallas Police", "Secret Service", "TSBD employee",
--                           "Press").

create or replace table jfk_curated.dealey_plaza_witnesses as
select * from unnest([
  struct<
    witness_id              string,
    name                    string,
    position_lat            float64,
    position_lng            float64,
    position_description    string,
    statement_summary       string,
    heard_shots             int64,
    shot_origin_perceived   string,
    wc_testimony_volume     int64,
    wc_testimony_page       int64,
    source_naids            array<string>,
    role                    string
  >(
    'brennan-howard', 'Howard Brennan',
    32.77925, -96.80876, 'South side of Elm Street, opposite the TSBD',
    'Steamfitter watching the motorcade from a low concrete wall on the south side of Elm. Reported looking up after the first shot and seeing a man with a rifle in the southeast corner window of the 6th floor of the Texas School Book Depository.',
    3, 'Texas School Book Depository', 3, 140, cast([] as array<string>), 'Civilian witness'
  ),
  ('euins-amos', 'Amos Lee Euins',
    32.77915, -96.80871, 'South side of Elm Street, near the pergola',
    'Fifteen-year-old observer who, after the first shot, looked up and reported seeing a rifle barrel withdraw from the same southeast 6th-floor window of the TSBD.',
    3, 'Texas School Book Depository', 2, 201, cast([] as array<string>), 'Civilian witness'),
  ('zapruder-abraham', 'Abraham Zapruder',
    32.77931, -96.80870, 'Concrete pergola, north side of Elm Street',
    'Filmed the motorcade with an 8mm Bell & Howell camera from atop the pergola. His 26-second color film became the principal visual record of the assassination.',
    3, 'Could not determine', 7, 569, cast([] as array<string>), 'Civilian witness (filmed)'),
  ('nix-orville', 'Orville Nix',
    32.77910, -96.80892, 'South side of Main Street, opposite the grassy knoll',
    'Filmed the motorcade with an 8mm color camera. His film captures the limousine after the head shot and the area in front of the stockade fence.',
    cast(null as int64), 'Could not determine', cast(null as int64), cast(null as int64), cast([] as array<string>), 'Civilian witness (filmed)'),
  ('moorman-mary', 'Mary Moorman',
    32.77918, -96.80897, 'South curb of Elm Street near the Z-313 position',
    'Took a Polaroid photograph at approximately the moment of the fatal head shot, capturing the limousine and the grassy knoll behind it.',
    cast(null as int64), 'Grassy knoll / stockade fence', cast(null as int64), cast(null as int64), cast([] as array<string>), 'Civilian witness (photographed)'),
  ('hill-jean', 'Jean Hill',
    32.77919, -96.80895, 'South curb of Elm Street, with Mary Moorman',
    'Standing next to Mary Moorman on the south curb. Reported hearing four to six shots and perceived shots coming from the area of the stockade fence on the grassy knoll.',
    5, 'Grassy knoll / stockade fence', 6, 205, cast([] as array<string>), 'Civilian witness'),
  ('newman-bill', 'Bill Newman',
    32.77942, -96.80889, 'North curb of Elm Street, near the stockade fence',
    'Standing with his family on the north curb of Elm. Threw himself and his children to the ground at the third shot; reported the shots sounded as if they came from directly behind him on the grassy knoll.',
    3, 'Grassy knoll / stockade fence', cast(null as int64), cast(null as int64), cast([] as array<string>), 'Civilian witness'),
  ('holland-sm', 'S. M. Holland',
    32.77985, -96.80950, 'Triple Underpass, atop the railroad bridge',
    'Union Terminal signal supervisor watching from the railroad overpass. Reported hearing four shots and seeing a puff of smoke under the trees behind the stockade fence on the grassy knoll.',
    4, 'Grassy knoll / stockade fence', 6, 239, cast([] as array<string>), 'Railroad employee'),
  ('bowers-lee', 'Lee Bowers',
    32.77975, -96.80910, 'Union Terminal railroad tower, behind the grassy knoll',
    'Watched the area behind the stockade fence from the elevated railroad signal tower. Reported seeing two unfamiliar men behind the fence in the minutes before the shooting and a "flash of light" or movement at the time of the shots.',
    cast(null as int64), 'Could not determine', 6, 284, cast([] as array<string>), 'Railroad employee'),
  ('brehm-charles', 'Charles Brehm',
    32.77930, -96.80905, 'North curb of Elm Street, very near the limousine',
    'Standing on the north curb a few feet from the limousine at the moment of the fatal shot. Reported the appearance of a brain tissue arc rearward and to the left.',
    3, 'Could not determine', cast(null as int64), cast(null as int64), cast([] as array<string>), 'Civilian witness'),
  ('tague-james', 'James Tague',
    32.78010, -96.80950, 'Triple Underpass, south curb of Main Street',
    'Standing under the south side of the Triple Underpass. Wounded slightly on the cheek by a bullet fragment or curb spall — the only confirmed injury outside the limousine.',
    3, 'Could not determine', 7, 552, cast([] as array<string>), 'Civilian witness'),
  ('kellerman-roy', 'Roy Kellerman',
    32.77926, -96.80906, 'Front-passenger seat of the presidential limousine',
    'Secret Service Special Agent in Charge in the front passenger seat. Reported hearing what he initially thought was a firecracker, then ordered the driver to accelerate after the head shot.',
    3, 'Could not determine', 2, 75, cast([] as array<string>), 'Secret Service'),
  ('greer-william', 'William Greer',
    32.77926, -96.80906, 'Driver of the presidential limousine',
    'Secret Service driver of SS-100-X. Reported hearing the shots and accelerating to the Stemmons Freeway en route to Parkland Memorial Hospital.',
    cast(null as int64), 'Could not determine', 2, 117, cast([] as array<string>), 'Secret Service'),
  ('hill-clint', 'Clint Hill',
    32.77926, -96.80906, 'Running board of the Secret Service follow-up car',
    'Secret Service agent assigned to Mrs. Kennedy. Sprinted forward and climbed onto the rear of the limousine after the second shot, shielding the President and First Lady en route to Parkland.',
    cast(null as int64), 'Could not determine', 2, 132, cast([] as array<string>), 'Secret Service'),
  ('williams-bonnie-ray', 'Bonnie Ray Williams',
    32.77957, -96.80831, '5th floor of the TSBD, directly below the sniper window',
    'TSBD employee eating his lunch on the 5th floor. Reported hearing three shots from directly above and shell casings hitting the floor overhead.',
    3, 'Texas School Book Depository', 3, 161, cast([] as array<string>), 'TSBD employee'),
  ('norman-harold', 'Harold Norman',
    32.77957, -96.80831, '5th floor of the TSBD, directly below the sniper window',
    'TSBD employee on the 5th floor with Bonnie Ray Williams and James Jarman. Reported hearing the bolt action of a rifle and three shell casings strike the floor above his head.',
    3, 'Texas School Book Depository', 3, 186, cast([] as array<string>), 'TSBD employee'),
  ('jarman-james', 'James Jarman Jr.',
    32.77957, -96.80831, '5th floor of the TSBD, directly below the sniper window',
    'TSBD employee on the 5th floor with Williams and Norman. Corroborated their accounts of three shots and overhead noise.',
    3, 'Texas School Book Depository', 3, 198, cast([] as array<string>), 'TSBD employee'),
  ('oswald-lee', 'Lee Harvey Oswald',
    32.77963, -96.80825, 'TSBD 2nd-floor lunchroom (per his own statement and Officer Baker)',
    'Per his statement to police and the testimony of motorcycle officer Marrion Baker, Oswald was in the 2nd-floor lunchroom of the TSBD shortly after the shots were fired, where Baker confronted him.',
    cast(null as int64), 'Could not determine', cast(null as int64), cast(null as int64), cast([] as array<string>), 'TSBD employee (defendant)'),
  ('baker-marrion', 'Marrion L. Baker',
    32.77963, -96.80825, 'TSBD 2nd-floor lunchroom (entered from outside)',
    'Dallas Police motorcycle officer who, hearing the shots, ran into the TSBD with Roy Truly. Encountered Oswald in the 2nd-floor lunchroom approximately 90 seconds after the shots.',
    3, 'Texas School Book Depository', 3, 242, cast([] as array<string>), 'Dallas Police'),
  ('truly-roy', 'Roy Truly',
    32.77963, -96.80825, 'TSBD entrance — running upstairs with Officer Baker',
    'Texas School Book Depository superintendent who ran into the building with Officer Baker after the shots; identified Oswald in the 2nd-floor lunchroom as a TSBD employee.',
    3, 'Texas School Book Depository', 3, 226, cast([] as array<string>), 'TSBD employee')
]);
