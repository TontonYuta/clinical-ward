/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tool Đồng bộ & Bóc tách Toàn bộ Danh mục Thuốc Quốc gia (DAV 55.000+ SĐK) (<=200 LOC)
 * Usage: npx tsx scripts/crawler/ingest_dav_drug_registry.ts [--limit=55005] [--page-size=200]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { fetchDavDrugsPage, transformDavToMasterMedication, DavRawDrugItem } from '../../src/services/drugRegistryService';
import { MasterMedication } from '../../src/types/medication';

const OUT_DIR = path.resolve(process.cwd(), 'data/vietnam_drug_registry');
const MASTER_FILE = path.join(OUT_DIR, 'dav_master_registry.json');
const ESSENTIAL_FILE = path.join(OUT_DIR, 'dav_essential_formulary.json');
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
  let limit = 55005; // Mặc định tải toàn bộ nếu không chỉ định
  let query = '';
  let pageSize = 200; // Tối ưu 200 records / request
  let restart = false;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--query=')) query = arg.split('=')[1];
    if (arg.startsWith('--page-size=')) pageSize = parseInt(arg.split('=')[1], 10);
    if (arg === '--restart') restart = true;
  }
  return { limit, query, pageSize, restart };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDavDrugIngest(limitOverride?: number, queryOverride?: string) {
  const { limit: cliLimit, query: cliQuery, pageSize, restart } = parseCliArgs();
  const limit = limitOverride !== undefined ? limitOverride : cliLimit;
  const query = queryOverride !== undefined ? queryOverride : cliQuery;

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('======================================================================');
  console.log('🏛️ BẮT ĐẦU ĐỒNG BỘ DANH MỤC THUỐC CỤC QUẢN LÝ DƯỢC (DAV - BỘ Y TẾ)');
  console.log(`🎯 Mục tiêu: ${limit} bản ghi | Bộ lọc: "${query || 'Toàn bộ'}" | Batch: ${pageSize}`);
  console.log('======================================================================\n');

  let existingItems: MasterMedication[] = [];
  if (!restart && fs.existsSync(MASTER_FILE) && !query) {
    try {
      existingItems = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf-8'));
      console.log(`🔄 Checkpoint: Đã có sẵn ${existingItems.length} thuốc trên đĩa. Tiếp tục tải nối tiếp...`);
    } catch {
      existingItems = [];
    }
  }

  const existingMap = new Map<string, MasterMedication>(existingItems.map((i) => [i.nationalCode, i]));
  let skip = (!query && !restart) ? existingItems.length : 0;
  let totalAvailable = 55005;
  let fetchedCount = skip;

  while (fetchedCount < limit) {
    const fetchSize = Math.min(pageSize, limit - fetchedCount);
    let success = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const pageData = await fetchDavDrugsPage({ skipCount: skip, maxResultCount: fetchSize, filterText: query });
        totalAvailable = pageData.totalCount || totalAvailable;
        const rawList: DavRawDrugItem[] = pageData.items;

        if (!rawList || rawList.length === 0) {
          console.log('ℹ️ Máy chủ thông báo đã đến bản ghi cuối cùng.');
          success = true;
          break;
        }

        for (const raw of rawList) {
          const transformed = transformDavToMasterMedication(raw);
          existingMap.set(transformed.nationalCode, transformed);
        }

        fetchedCount += rawList.length;
        skip += rawList.length;
        const percent = Math.min(100, Math.round((fetchedCount / totalAvailable) * 100));
        console.log(`   ✅ [${percent}%] Tiến độ: ${fetchedCount}/${totalAvailable} (Batch +${rawList.length})`);

        success = true;
        break;
      } catch (err: any) {
        console.warn(`   ⚠️ Lỗi tải offset ${skip} (lần ${attempt}/3): ${err?.message || err}. Thử lại...`);
        await sleep(1500 * attempt);
      }
    }

    if (!success) {
      console.error(`❌ Dừng tại offset ${skip} do lỗi kết nối liên tiếp.`);
      break;
    }

    // Checkpoint an toàn mỗi 2.000 thuốc
    if (skip % 2000 === 0 || skip >= limit || skip >= totalAvailable) {
      const checkpointList = Array.from(existingMap.values());
      fs.writeFileSync(MASTER_FILE, JSON.stringify(checkpointList), 'utf-8');
      console.log(`   💾 [Auto-Save Checkpoint] Đã lưu ${checkpointList.length} bản ghi vào đĩa.`);
    }

    if (skip >= totalAvailable) break;
    await sleep(250); // Rate-limit lịch sự chống quá tải server
  }

  const allMerged = Array.from(existingMap.values());
  fs.writeFileSync(MASTER_FILE, JSON.stringify(allMerged), 'utf-8');
  fs.writeFileSync(MASTER_FILE + '.gz', zlib.gzipSync(JSON.stringify(allMerged)));

  // Trích xuất danh mục thiết yếu viện (Essential Formulary <= 1500 thuốc) cho Frontend
  const essentialList = allMerged.filter((m) => m.isCrashCart || m.isControlled || m.isHighAlert || m.group === 'Kháng sinh' || m.group === 'Dịch truyền').slice(0, 1500);
  fs.writeFileSync(ESSENTIAL_FILE, JSON.stringify(essentialList, null, 2), 'utf-8');

  const stats: Record<string, number> = {};
  for (const m of allMerged) stats[m.group] = (stats[m.group] || 0) + 1;

  const manifest: IngestManifest = {
    totalAvailableInDav: totalAvailable,
    totalIngested: allMerged.length,
    lastUpdated: new Date().toISOString(),
    source: 'Cục Quản lý Dược - Bộ Y tế (dichvucong.dav.gov.vn)',
    categoryStats: stats,
  };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n======================================================================');
  console.log('🎉 ĐỒNG BỘ TOÀN BỘ HOÀN TẤT!');
  console.log(`📁 Tệp đầy đủ toàn quốc: ${MASTER_FILE} (${allMerged.length} thuốc)`);
  console.log(`⚡ Tệp thiết yếu Frontend: ${ESSENTIAL_FILE} (${essentialList.length} thuốc)`);
  console.log(`📊 Manifest: ${MANIFEST_FILE}`);
  console.log('📈 Thống kê phân loại lâm sàng:', JSON.stringify(stats, null, 2));
  console.log('======================================================================');

  return { totalIngested: allMerged.length, totalAvailable, file: MASTER_FILE };
}

if (process.argv[1]?.includes('ingest_dav_drug_registry.ts')) {
  runDavDrugIngest();
}
