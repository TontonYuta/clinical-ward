import { chromium } from 'playwright';
import path from 'path';

const USER_DATA_DIR = path.join(process.cwd(), '.esms_browser_profile');

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: true });
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Listen to all network responses
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('Template') || url.includes('Dropdown') || url.includes('Brandname')) {
      try {
        console.log('API RESPONSE:', url, '=>', (await res.text()).slice(0, 300));
      } catch {}
    }
  });

  await page.goto('https://account.esms.vn/SMS/CreateNewSMS_Version2', { waitUntil: 'networkidle' });

  // Get all template dropdown data
  const templateData = await page.evaluate(async () => {
    // @ts-ignore
    const $ = window.jQuery;
    if (!$) return { error: 'No jQuery' };

    const brandnameDdl = $('#CustomerCare_BrandNameID').data('kendoDropDownList');
    let brands = [];
    if (brandnameDdl) {
      brands = brandnameDdl.dataSource.data().toJSON();
    }

    const typeDdl = $('#TypeOfSms').data('kendoDropDownList');
    let types = [];
    if (typeDdl) {
      types = typeDdl.dataSource.data().toJSON();
    }

    // Trigger select CSKH
    if (typeDdl) typeDdl.value(2);
    if (brandnameDdl) brandnameDdl.value(318269); // Baotrixemay

    // Read templates for this brandname
    const res = await fetch('/SMS/DropdownTemplate_Read?BrandNameID=318269&SmSType=2').then(r => r.json()).catch(e => e.message);
    const resAll = await fetch('/SMS/DropdownTemplate_Read?SmSType=2').then(r => r.json()).catch(e => e.message);
    const resTypes = await fetch('/SMS/DropdownBrandType_Read').then(r => r.json()).catch(e => e.message);

    return { brands, types, res, resAll, resTypes };
  });

  console.log('Template Data:', JSON.stringify(templateData, null, 2));

  await context.close();
}

main().catch(console.error);
