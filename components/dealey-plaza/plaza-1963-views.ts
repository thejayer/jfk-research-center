export const PLAZA_VIEWS = {
  overview: { label: "Plaza overview", eye: [-665, 430, 590], at: [-180, 10, -25] },
  overhead: { label: "Overhead / north up", eye: [-200, 850, 1], at: [-200, 0, 0] },
  depository: { label: "Depository exterior", eye: [-230, 85, -120], at: [-65, 48, -318] },
  elm: { label: "Elm Street approach", eye: [-20, 9, -245], at: [-330, -5, -75] },
  knoll: { label: "North pergola vicinity", eye: [-245, 13, -188], at: [-165, 0, -150] },
  // Documented visual estimates in feet, not survey-calibrated camera positions.
  // Standing eye 5.25 ft above the pedestal top, about 18 ft west-northwest.
  // The ESE aim shifts the shelter columns left and keeps the whole
  // pedestal at lower left, clear of the HUD, with Elm across the middle.
  zapruder: { label: "Zapruder pedestal", eye: [-259.75, -4.415882352941177, -158], at: [-168, -36, -115] },
  // Inside the allowed north setback and height, clear the picket tops.
  // Look south, slightly west toward the underpass direction; the fence
  // forms a lower-middle band above the HUD with lawn and Elm beyond.
  stockade: { label: "Stockade fence / grassy knoll", eye: [-290, 6, -267], at: [-302, -49, -113] },
  // Just inside the opened bay; jambs and sill frame the down-Elm sightline.
  window: { label: "Sixth-floor window bay", eye: [-23.5, 64, -278], at: [-250, -14, -113] },
} as const;
export type PlazaView = keyof typeof PLAZA_VIEWS;

export type PlazaCameraActions = {
  view: (v: PlazaView) => void;
  zoom: (factor: number) => void;
  render: () => void;
  labels: (visible: boolean) => void;
};
