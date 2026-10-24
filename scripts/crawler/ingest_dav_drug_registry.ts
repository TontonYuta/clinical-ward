/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tool Đồng bộ & Bóc tách Toàn bộ Danh mục Thuốc Quốc gia (DAV 55.000+ SĐK) (<=200 LOC)
 * Usage: npx tsx scripts/crawler/ingest_dav_drug_registry.ts [--limit=500] [--query=morphin]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchDavDrugsPage, transformDavToMasterMedication, DavRawDrugItem } from '../../src/services/drugRegistryService';
import { MasterMedication } from '../../src/types/medication';

const OUT_DIR = path.resolve(process.cwd(), 'data/vietnam_drug_registry');
const MASTER_FILE = path.join(OUT_DIR, 'dav_master_registry.json');
const MANIFEST_FILE = path.join(OUT_DIR, 'ingest_manifest.json');

interface IngestManifest {
  totalAvailableInDav: number;
  totalIngested: number;
  lastUpdated: string;
  source: string;
  categoryStats: Record<string, number>;
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let limit = 200; // Mặc định 200 records kiểm tra, có thể truyền --limit=55000
  let query = '';
  let pageSize = 100;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--query=')) query = arg.split('=')[1];
    if (arg.startsWith('--page-size=')) pageSize = parseInt(arg.split('=')[1], 10);
  }
  return { limit, query, pageSize };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDavDrugIngest(limitOverride?: number, queryOverride?: string) {
  const { limit: cliLimit, query: cliQuery, pageSize } = parseCliArgs();
  const limit = limitOverride !== undefined ? limitOverride : cliLimit;
  const query = queryOverride !== undefined ? queryOverride : cliQuery;

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('======================================================================');
  console.log('🏛️ BẮT ĐẦU ĐỒNG BỘ DANH MỤC THUỐC CỤC QUẢN LÝ DƯỢC (DAV - BỘ Y TẾ)');
  console.log(`🎯 Chỉ tiêu: ${limit} bản ghi | Bộ lọc: "${query || 'Tất cả'}" | Kích thước trang: ${pageSize}`);
  console.log('======================================================================\n');

  let existingItems: MasterMedication[] = [];
  if (fs.existsSync(MASTER_FILE)) {
    try {
      existingItems = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf-8'));
    } catch {
      existingItems = [];
    }
  }

  const existingMap = new Map<string, MasterMedication>(existingItems.map((item) => [item.nationalCode, item]));

  let skip = 0;
  let totalAvailable = 0;
  let fetchedCount = 0;

  while (fetchedCount < limit) {
    const fetchSize = Math.min(pageSize, limit - fetchedCount);
    console.log(`⏳ Đang tải trang từ offset ${skip} (số lượng ${fetchSize})...`);

    try {
      const pageData = await fetchDavDrugsPage({
        skipCount: skip,
        maxResultCount: fetchSize,
        filterText: query,
      });

      totalAvailable = pageData.totalCount;
      const rawList: DavRawDrugItem[] = pageData.items;

      if (!rawList || rawList.length === 0) {
        console.log('ℹ️ Hết dữ liệu trả về từ máy chủ DAV.');
        break;
      }

      for (const raw of rawList) {
        const transformed = transformDavToMasterMedication(raw);
        existingMap.set(transformed.nationalCode, transformed);
      }

      fetchedCount += rawList.length;
      skip += rawList.length;

      console.log(`   ✅ Đã bóc tách thành công ${fetchedCount}/${limit} thuốc (Tổng hệ thống DAV: ${totalAvailable})`);

      if (skip >= totalAvailable) break;
      await sleep(300); // Polite rate limit
    } catch (err: any) {
      console.error(`   ⚠️ Lỗi khi tải offset ${skip}: ${err?.message || err}`);
      break;
    }
  }

  const allMerged = Array.from(existingMap.values());
  fs.writeFileSync(MASTER_FILE, JSON.stringify(allMerged, null, 2), 'utf-8');

  const stats: Record<string, number> = {};
  for (const m of allMerged) {
    stats[m.group] = (stats[m.group] || 0) + 1;
  }

  const manifest: IngestManifest = {
    totalAvailableInDav: totalAvailable,
    totalIngested: allMerged.length,
    lastUpdated: new Date().toISOString(),
    source: 'Cục Quản lý Dược - Bộ Y tế (dichvucong.dav.gov.vn)',
    categoryStats: stats,
  };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n======================================================================');
  console.log('🎉 ĐỒNG BỘ HOÀN TẤT!');
  console.log(`📁 Tệp danh mục: ${MASTER_FILE} (${allMerged.length} thuốc)`);
  console.log(`📊 Manifest: ${MANIFEST_FILE}`);
  console.log('📈 Thống kê phân loại lâm sàng:', JSON.stringify(stats, null, 2));
  console.log('======================================================================');

  return { totalIngested: allMerged.length, totalAvailable, file: MASTER_FILE };
}

if (process.argv[1]?.includes('ingest_dav_drug_registry.ts')) {
  runDavDrugIngest();
}
