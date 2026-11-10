export const PLAZA_VIEWS = {
  overview: { label: "Plaza overview", eye: [-665, 430, 590], at: [-180, 10, -25] },
  overhead: { label: "Overhead / north up", eye: [-200, 850, 1], at: [-200, 0, 0] },
  depository: { label: "Depository exterior", eye: [-230, 85, -120], at: [-65, 48, -318] },
  elm: { label: "Elm Street approach", eye: [-20, 9, -245], at: [-330, -5, -75] },
  knoll: { label: "North pergola vicinity", eye: [-245, 13, -188], at: [-165, 0, -150] },
  // Documented visual estimates in feet, not survey-calibrated camera positions.
  // Pedestal top is grade(-242) + 4; standing eye is another 5.5 ft above it.
  zapruder: { label: "Zapruder pedestal", eye: [-242, -4.165882352941177, -155], at: [-260, -15, -106] },
  // Standing eye clears the nearby pickets while remaining beside the fence.
  stockade: { label: "Stockade fence / grassy knoll", eye: [-290, 4.5, -253], at: [-250, -14, -113] },
  window: { label: "Sixth-floor window bay", eye: [-26.25, 9 + 5 * 78 / 7, -273], at: [-250, -14, -113] },
} as const;
export type PlazaView = keyof typeof PLAZA_VIEWS;

export type PlazaCameraActions = {
  view: (v: PlazaView) => void;
  zoom: (factor: number) => void;
  render: () => void;
  labels: (visible: boolean) => void;
};
