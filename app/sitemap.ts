import type { MetadataRoute } from "next";
import {
  buildCatalogSitemapEntries,
  buildDocumentSitemapEntries,
} from "@/lib/sitemap-catalog";
import { fetchDocumentSitemapIds } from "@/lib/warehouse";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = buildCatalogSitemapEntries();

  try {
    const documentIds = await fetchDocumentSitemapIds();
    return [...catalog, ...buildDocumentSitemapEntries(documentIds)];
  } catch (error) {
    console.error("document sitemap failed", error);
    return catalog;
  }
}
