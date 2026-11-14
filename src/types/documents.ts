export interface KnowledgeDocument {
  id: string;
  title: string;
  legal_basis: string;
  category: string;
  edition_year: number | null;
  filename: string;
  public_url: string;
  sha256: string;
  bytes: number | null;
}
