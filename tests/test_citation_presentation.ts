import { formatCitationLabel, removeLegacySourceText } from '../src/utils/chatAnswerPresentation';
import type { RagCitationItem } from '../src/types/chat';

function testCitationPresentation() {
  console.log('=== TEST CITATION PRESENTATION & LABEL FORMATTING ===');

  // 1. Test Dược thư Quốc Gia
  const c1: RagCitationItem = {
    source: 'Dược thư Quốc gia Việt Nam, lần xuất bản II',
    legal_basis: 'QĐ 2033/QĐ-BYT Trang 1118',
    section: 'Paracetamol 500mg',
    page: 1118,
    url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118'
  };
  const label1 = formatCitationLabel(c1);
  if (label1.title !== 'Dược Thư Quốc Gia (2015)' || label1.pageTag !== 'tr. 1118') {
    throw new Error(`Failed Dược thư formatting: ${JSON.stringify(label1)}`);
  }
  console.log('✅ 1. Dược thư Quốc Gia label formatting passed!');

  // 2. Test QĐ 5948
  const c2: RagCitationItem = {
    source: 'Quyết định 5948/QĐ-BYT',
    legal_basis: 'QĐ 5948/QĐ-BYT',
    section: 'Tương tác chống chỉ định',
    url: '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf'
  };
  const label2 = formatCitationLabel(c2);
  if (label2.title !== 'QĐ 5948/QĐ-BYT' || label2.subtitle !== 'Tương tác chống chỉ định') {
    throw new Error(`Failed QĐ 5948 formatting: ${JSON.stringify(label2)}`);
  }
  console.log('✅ 2. QĐ 5948 label formatting passed!');

  // 3. Test Thông tư 22
  const c3: RagCitationItem = {
    source: 'Thông tư 22/2011/TT-BYT',
    legal_basis: 'Điều 10 Thông tư 22/2011/TT-BYT',
    page: 4
  };
  const label3 = formatCitationLabel(c3);
  if (label3.title !== 'Thông tư 22/2011/TT-BYT' || label3.pageTag !== 'tr. 4') {
    throw new Error(`Failed TT 22 formatting: ${JSON.stringify(label3)}`);
  }
  console.log('✅ 3. Thông tư 22 label formatting passed!');

  // 4. Test Thông tư 20
  const c4: RagCitationItem = {
    source: 'Thông tư 20/2017/TT-BYT',
    legal_basis: 'Điều 15 Thông tư 20/2017/TT-BYT'
  };
  const label4 = formatCitationLabel(c4);
  if (label4.title !== 'Thông tư 20/2017/TT-BYT') {
    throw new Error(`Failed TT 20 formatting: ${JSON.stringify(label4)}`);
  }
  console.log('✅ 4. Thông tư 20 label formatting passed!');

  // 5. Test Thông tư 36
  const c5: RagCitationItem = {
    source: 'Thông tư 36/2018/TT-BYT GSP',
    legal_basis: 'Thông tư 36/2018/TT-BYT'
  };
  const label5 = formatCitationLabel(c5);
  if (label5.title !== 'Thông tư 36/2018/TT-BYT') {
    throw new Error(`Failed TT 36 formatting: ${JSON.stringify(label5)}`);
  }
  console.log('✅ 5. Thông tư 36 label formatting passed!');

  // 6. Test removeLegacySourceText preservation
  const rawWithSource = `• Paracetamol 500mg uống 4-6 giờ.\n\n*Căn cứ pháp lý: Dược thư Quốc gia*\nTệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf`;
  const cleanedWithCitations = removeLegacySourceText(rawWithSource, true);
  if (cleanedWithCitations.includes('Tệp:') || cleanedWithCitations.includes('*Căn cứ pháp lý:')) {
    throw new Error(`Legacy source text was not properly cleaned: ${cleanedWithCitations}`);
  }
  const preservedWithoutCitations = removeLegacySourceText(rawWithSource, false);
  if (!preservedWithoutCitations.includes('*Căn cứ pháp lý:')) {
    throw new Error(`Source text should be preserved when no citations: ${preservedWithoutCitations}`);
  }

  // 7. Test elimination of duplicate source line at end
  const rawWithTrailingToken = `• **Liều dùng:** 0,5 - 1 g/lần.\n\nNguồn: [DTQG tr.1118]`;
  const cleanedTrailing = removeLegacySourceText(rawWithTrailingToken, true);
  if (cleanedTrailing.includes('Nguồn:') || cleanedTrailing.includes('[DTQG tr.1118]')) {
    throw new Error(`Trailing source line was not stripped when citations present: ${cleanedTrailing}`);
  }

  const rawWithStandaloneToken = `• **Liều dùng:** 0,5 - 1 g/lần.\n\n[Dược thư tr.1118]`;
  const cleanedStandalone = removeLegacySourceText(rawWithStandaloneToken, true);
  if (cleanedStandalone.includes('[Dược thư tr.1118]')) {
    throw new Error(`Standalone citation token was not stripped when citations present: ${cleanedStandalone}`);
  }
  console.log('✅ 6. removeLegacySourceText smart preservation & trailing token stripping passed!');

  console.log('🎉 ALL CITATION PRESENTATION TESTS PASSED 100%!');
}

testCitationPresentation();
