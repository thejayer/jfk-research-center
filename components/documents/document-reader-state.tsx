"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OcrPage } from "@/lib/api-types";

type DocumentReaderState = {
  currentPage: OcrPage | null;
  setCurrentPage: (page: OcrPage) => void;
};

const DocumentReaderContext = createContext<DocumentReaderState | null>(null);

export function DocumentReaderProvider({
  initialPage,
  children,
}: {
  initialPage: OcrPage | null;
  children: ReactNode;
}) {
  const [currentPage, setCurrentPage] = useState<OcrPage | null>(initialPage);
  const value = useMemo(
    () => ({ currentPage, setCurrentPage }),
    [currentPage],
  );
  return (
    <DocumentReaderContext.Provider value={value}>
      {children}
    </DocumentReaderContext.Provider>
  );
}

export function useDocumentReaderState(): DocumentReaderState | null {
  return useContext(DocumentReaderContext);
}
