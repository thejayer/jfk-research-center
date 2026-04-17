export const SITE_NAME = "JFK Research Center";

export const FEATURED_ENTITY_SLUGS = [
  "oswald",
  "ruby",
  "cia",
  "fbi",
  "warren-commission",
  "hsca",
] as const;

export const FEATURED_TOPIC_SLUGS = [
  "warren-commission",
  "hsca",
  "mexico-city",
  "cia",
  "fbi",
] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const AGENCIES = [
  "FBI",
  "CIA",
  "Warren Commission",
  "HSCA",
  "ARRB",
  "Secret Service",
  "Department of State",
  "Department of Defense",
];

export const DOCUMENT_TYPES = [
  "Textual Record",
  "Memorandum",
  "Report",
  "Testimony",
  "Correspondence",
  "Photograph",
];
