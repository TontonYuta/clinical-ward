export interface RegistryHospitalStockUnit { unit: string; quantity: number; batch_count: number; }
export interface RegistryPageItem {
  id: string; national_code: string; brand_name: string; active_ingredient: string;
  concentration?: string | null; dosage_form?: string | null; route?: string | null;
  standard_unit?: string | null; group?: string | null; atc_code?: string | null;
  hospital_stock_by_unit: RegistryHospitalStockUnit[]; [key: string]: unknown;
}
export interface RegistryPageResponse {
  total: number; page: number; page_size: number; total_pages: number;
  group_stats: Record<string, number>; items: RegistryPageItem[];
  registry_revision: string; inventory_revision: string; hospital_stock_drug_count: number;
}
