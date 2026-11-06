import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const order={id:'RX-DETAIL-CONTEXT',prescriptionType:'outpatient',patientId:'P1',patientName:'Test patient',patientCccd:'',patientDob:'1990-01-01',patientGender:'Nam',department:'',diagnosisIcd10:'',diagnosisText:'Test',doctorName:'Test doctor',doctorCertificate:'',prescribedAt:'2026-11-05',status:'draft',daysPrescribed:3,items:[{id:'m1',medicationName:'Paracetamol 500mg',activeIngredient:'Paracetamol',dosage:'1 viên',frequency:'Ngày 2 lần',route:'Uống',quantity:6,unit:'Viên',instructions:'Theo chỉ định đã nhập',durationDays:3}]};
const browser=await chromium.launch();
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('clinical_user_role','doctor'));
 await context.route(u=>u.pathname.startsWith('/api/'),r=>{
  const p=new URL(r.request().url()).pathname;
  return r.fulfill({json:p.endsWith('/auth/me')?{authenticated:true,enabled:false,role:'doctor',username:'demo'}:p.endsWith('/cpoe')?[order]:[]});
 });
 const page=await context.newPage();await page.goto('http://localhost:3000/#cpoe');
 await page.getByRole('button',{name:order.id,exact:true}).click();
 await page.getByRole('tab',{name:'Thuốc (1)',exact:true}).click();
 const text=await page.getByRole('dialog').innerText();
 assert.equal(await page.locator('dt').filter({hasText:/^Liều kê$/}).count(),1,'separate prescribed dose from ingredient concentration');
 assert.ok(text.includes('Ngày 2 lần') && text.includes('Theo chỉ định đã nhập'));
 assert.ok(!text.includes('Naloxon') && !text.includes('test da'),'do not insert unrelated unsourced treatment protocols');
 console.log('Prescription detail contextual information checks passed');
}finally{await browser.close();}
