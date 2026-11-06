import React from 'react';
import type { DebtRecord, EquipmentTicket, InventoryBatch, AssetAuditRecord, ColdChainMonitorState } from '../../../types/clinical';

export interface FormSourceData {
  debt?: DebtRecord;
  ticket?: EquipmentTicket;
  asset?: AssetAuditRecord;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  assets: AssetAuditRecord[];
  coldChainState?: ColdChainMonitorState;
}

export const Blank = ({ field }: { field?: string }) => <span className="draft-blank" data-field={field}>Chưa ghi</span>;
export const Value = ({ value }: { value: unknown }) => typeof value === 'number'
  ? Number.isFinite(value) ? <>{value}</> : <Blank />
  : typeof value === 'string' && value.trim() ? <>{value}</> : <Blank />;
export const Fields = ({ values }: { values: Array<[string, unknown]> }) => <dl className="draft-fields">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><Value value={value} /></dd></div>)}</dl>;
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="draft-section"><h2>{title}</h2>{children}</section>;
export const SourceTable = ({ headers, empty, children }: { headers: string[]; empty: boolean; children: React.ReactNode }) => <table className="draft-table"><thead><tr>{headers.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{empty ? <tr><td colSpan={headers.length}>Chưa có hồ sơ nguồn phù hợp.</td></tr> : children}</tbody></table>;
export const DemoSource = () => <p className="draft-source-note">Nguồn thuốc tủ trực / thiết bị / tài sản: dữ liệu mô phỏng trong ứng dụng, chưa kết nối hồ sơ nghiệp vụ máy chủ. Các giá trị nguồn chưa chứng minh sự việc thực tế.</p>;
export const Parties = ({ roles }: { roles: string[] }) => <section className="draft-parties">{roles.map(role => <div key={role}><strong>{role}</strong><p>Họ tên / đơn vị: <Blank field="signature-name" /></p><p>Chữ ký / thời điểm: <Blank /></p></div>)}</section>;

/** Split only an explicitly supplied quantity/unit string; do not infer a unit from the drug. */
export function quantityParts(quantity: string | undefined) {
  const match = quantity?.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/u);
  return { amount: match?.[1] ?? quantity, unit: match?.[2] };
}
export function isReturnedControlledDebt(debt: DebtRecord) {
  return debt.ampouleReturned === true && debt.ampouleDestroyed !== true && (debt.isNarcotic === true || debt.itemType === 'Thuốc gây nghiện' || debt.itemType === 'Thuốc hướng thần');
}
export function lowStockBatches(batches: InventoryBatch[]) {
  return batches.filter(batch => batch.isLowStock || (Number.isFinite(batch.currentStock) && Number.isFinite(batch.minThreshold) && batch.currentStock <= batch.minThreshold));
}
export const SourceRef = ({ id, code }: { id?: string; code?: string }) => <><Value value={code} />{id && id !== code && <div className="draft-source-id">ID: {id}</div>}</>;
