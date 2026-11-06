import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 await page.route(u=>u.pathname.startsWith('/api/'),r=>r.fulfill({json:{enabled:false,authenticated:true,username:'demo',role:'nurse'}}));
 await page.goto('http://localhost:3000/');
 await page.evaluate(async()=> (await import('/tests/fixtures/session-confirmation-harness.tsx')).mountSession());
 await page.getByText('server-pharmacist',{exact:true}).waitFor({timeout:2500});
 assert.equal(await page.getByText('Điền nhanh PIN demo',{exact:false}).count(),0);
 await page.getByRole('button',{name:'Xác nhận thao tác',exact:true}).click();
 await page.waitForFunction(()=>window.sessionCalls===1);
 assert.equal(await page.evaluate(()=>window.confirmedSigner.name),'server-pharmacist');
 assert.equal(await page.evaluate(()=>window.confirmedSigner.practiceCertificate),'');
 assert.equal(await page.evaluate(()=>window.confirmedMethod),'SESSION');
 await page.evaluate(async()=> (await import('/tests/fixtures/session-confirmation-harness.tsx')).mountSession(true));
 await page.getByRole('button',{name:'Xác nhận thao tác',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Xác nhận thao tác',exact:true}).isDisabled(),true,'unverified second witness cannot be fabricated');
 console.log('Authenticated session confirmation identity checks passed');
} finally {await browser.close();}
