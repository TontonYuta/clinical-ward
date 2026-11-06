import assert from 'node:assert/strict';
import { generateMedicationHtmlEmail } from '../src/services/prescriptionHtmlGenerator';
const attack = '<img src=x onerror="window.injected=true">';
const html = generateMedicationHtmlEmail({
  id:'test', patientName:attack, patientEmail:'<script>evil()</script>', doctorName:attack,
  startDate:'',endDate:'',createdAt:'',generalDoctorAdvice:attack,notificationStatus:'idle',
  medications:[{id:'m',medicationName:attack,dosage:'1',route:'Uống',durationDays:1,
    timeSlots:[{id:'morning',label:'Sáng',time:'',dosageText:attack,mealRelation:attack}]}],
});
assert.ok(!html.includes('<img'), 'patient/drug/advice text cannot inject HTML into preview or print');
assert.ok(!html.includes('<script>'), 'email is escaped as text');
assert.ok(html.includes('&lt;img'), 'visible clinical text is preserved');
assert.ok(html.includes('<table'), 'template markup remains intact');
console.log('Prescription HTML escaping checks passed');
const medication = { id:'m', medicationName:'Medication', dosage:'1.5 mL', route:'Uống', frequency:'3 lần/ngày', durationDays:5,
  timeSlots:[], specialInstructions:'Theo chỉ định đã ghi' };
const instructions = generateMedicationHtmlEmail({id:'test', patientName:'P', patientEmail:'', doctorName:'D',
  startDate:'',endDate:'',createdAt:'',generalDoctorAdvice:'',notificationStatus:'idle',medications:[medication]});
for (const text of ['1.5 mL','Uống','3 lần/ngày','Theo chỉ định đã ghi','Chưa cấu hình giờ dùng']) {
  assert.ok(instructions.includes(text), `Explicit prescribed instruction is preserved: ${text}`);
}
const React = await import('react');
const {renderToStaticMarkup} = await import('react-dom/server');
const {AdviceMedTable} = await import('../src/components/Modals/PrescriptionAdvice/AdviceMedTable');
const preview = renderToStaticMarkup(React.createElement(AdviceMedTable,{meds:[medication]}));
assert.ok(preview.includes('1.5 mL') && preview.includes('3 lần/ngày') && preview.includes('Theo chỉ định đã ghi'));
assert.ok(!html.includes('Bệnh Viện Lâm Sàng'), 'no invented healthcare facility');
assert.ok(!instructions.includes('Điều trị ngoại trú'), 'missing diagnosis is not invented');
const withSlot={...medication,timeSlots:[{id:'morning',label:'Sáng',time:'09:35',dosageText:'1.5 mL',mealRelation:'',note:'SLOT-NOTE <img src=x>'}]};
const slotHtml=generateMedicationHtmlEmail({id:'S',patientName:'P',patientEmail:'',doctorName:'',startDate:'',endDate:'',createdAt:'',generalDoctorAdvice:'',notificationStatus:'idle',medications:[withSlot]});
assert.ok(slotHtml.includes('SLOT-NOTE') && slotHtml.includes('&lt;img'));
const slotPreview=renderToStaticMarkup(React.createElement(AdviceMedTable,{meds:[withSlot]}));
assert.ok(slotPreview.includes('SLOT-NOTE'));
const {PrescriptionAdviceModal}=await import('../src/components/Modals/PrescriptionAdviceModal');
const advicePreview=renderToStaticMarkup(React.createElement(PrescriptionAdviceModal,{isOpen:true,onClose:()=>{},patients:[],order:{id:'SOURCE',patientId:'P',patientName:'P',clinicalNotes:'GLOBAL-SOURCE-INSTRUCTION',items:[]} as any}));
assert.ok(advicePreview.includes('GLOBAL-SOURCE-INSTRUCTION'), 'advice starts with source clinical notes');
