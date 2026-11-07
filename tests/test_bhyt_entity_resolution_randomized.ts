/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Randomized / Property-Based Testing for BHYT Entity Resolution Client Integration
 */

process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

import { bhytApi } from '../src/services/api/bhytApi';
import { DrugResolutionResult } from '../src/types/bhyt';

const SAMPLE_DRUGS = [
  '1. Nexium 40mg (Esomeprazole) - 30 viên',
  'Panadol Extra 500mg',
  'Paracetamon 500mg',
  'Glucophage 850mg (Metformin)',
  'Amlor 5mg (Amlodipin)',
  'Augmentin 1g x 14 viên',
  'Voltaren 50mg',
  'Medrol 16mg'
];

async function runRandomizedTests() {
  console.log('🧪 Bắt đầu kiểm thử ngẫu nhiên Entity Resolution (Phase 2)...');

  // Test 1: Đơn lẻ ngẫu nhiên
  const picked = SAMPLE_DRUGS[Math.floor(Math.random() * SAMPLE_DRUGS.length)];
  console.log(`\n--- Test 1: Phân giải ngẫu nhiên: "${picked}" ---`);
  const t0 = performance.now();
  const res = await bhytApi.resolveDrug(picked);
  const latency = performance.now() - t0;

  console.log(`Kết quả:`, {
    raw_query: res.raw_query,
    cleaned_name: res.cleaned_name,
    detected_concentration: res.detected_concentration,
    confidence_score: res.confidence_score,
    match_status: res.match_status,
    matched_dav: res.matched_dav?.brand_name,
    matched_bhyt: res.matched_bhyt?.active_ingredient,
    latency_ms: latency.toFixed(2)
  });

  if (res.confidence_score < 0.0 || res.confidence_score > 1.0) {
    throw new Error(`Điểm tin cậy không hợp lệ: ${res.confidence_score}`);
  }

  // Test 2: Hàng loạt ngẫu nhiên
  console.log('\n--- Test 2: Batch Resolution ngẫu nhiên 5 thuốc ---');
  const shuffled = [...SAMPLE_DRUGS].sort(() => 0.5 - Math.random()).slice(0, 5);
  const tBatch = performance.now();
  const batchRes = await bhytApi.batchResolveDrugs(shuffled);
  const batchLatency = performance.now() - tBatch;

  console.log(`Batch kết quả (${batchRes.resolved_count}/${batchRes.total} resolved trong ${batchLatency.toFixed(2)}ms):`);
  for (const item of batchRes.results) {
    console.log(`  • ${item.raw_query} => [${item.match_status}] ${item.matched_dav?.brand_name || 'N/A'} (${item.matched_bhyt?.active_ingredient || 'N/A'}) - Score: ${item.confidence_score}`);
  }

  if (batchRes.total !== 5) {
    throw new Error(`Tổng số thuốc không khớp: ${batchRes.total}`);
  }

  console.log('\n✅ 100% KIỂM THỬ GIAI ĐOẠN 2 THÀNH CÔNG RỰC RỠ!');
}

runRandomizedTests().catch((err) => {
  console.error('❌ Thất bại:', err);
  process.exit(1);
});
