export const PLAZA_VIEWS = {
  overview: { label: "Plaza overview", eye: [-665, 430, 590], at: [-180, 10, -25] },
  overhead: { label: "Overhead / north up", eye: [-200, 850, 1], at: [-200, 0, 0] },
  depository: { label: "Depository exterior", eye: [-230, 85, -120], at: [-65, 48, -318] },
  elm: { label: "Elm Street approach", eye: [-20, 9, -245], at: [-330, -5, -75] },
  knoll: { label: "North pergola vicinity", eye: [-245, 13, -188], at: [-165, 0, -150] },
  window: { label: "Sixth-floor vicinity", eye: [-25, 66, -273], at: [-250, -5, -115] },
} as const;
export type PlazaView = keyof typeof PLAZA_VIEWS;

export type PlazaCameraActions = {
  view: (v: PlazaView) => void;
  zoom: (factor: number) => void;
  render: () => void;
  labels: (visible: boolean) => void;
};
