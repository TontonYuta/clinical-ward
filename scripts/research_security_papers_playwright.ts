import { chromium } from 'playwright';
import * as fs from 'fs';

async function research() {
  console.log('🔍 Bắt đầu Playwright tra cứu tài liệu học thuật & repos bảo mật LLM/Chatbot...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const targets = [
    {
      name: 'NVIDIA NeMo Guardrails',
      url: 'https://github.com/NVIDIA/NeMo-Guardrails',
      outputPic: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_repo_nemo_guardrails.png'
    },
    {
      name: 'OWASP LLM Top 10 (Prompt Injection)',
      url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
      outputPic: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_paper_owasp_llm_top10.png'
    },
    {
      name: 'ProtectAI LLM Guard',
      url: 'https://github.com/protectai/llm-guard',
      outputPic: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_repo_llm_guard.png'
    },
    {
      name: 'arXiv Prompt Injection Greshake et al',
      url: 'https://arxiv.org/abs/2302.12173',
      outputPic: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_paper_indirect_prompt_injection_arxiv.png'
    }
  ];

  const results = [];

  for (const t of targets) {
    try {
      console.log(`📡 Truy cập: ${t.name} -> ${t.url}`);
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      await page.screenshot({ path: t.outputPic });
      console.log(`   ✅ Thành công [${t.name}]: ${title}`);
      results.push({ name: t.name, url: t.url, title, status: 'OK', screenshot: t.outputPic });
    } catch (err: any) {
      console.warn(`   ⚠️ Không tải được ${t.name} (${err.message}). Thử fallback...`);
      results.push({ name: t.name, url: t.url, status: 'FAILED', error: err.message });
    }
  }

  await browser.close();
  console.log('🎉 Hoàn thành tra cứu Playwright. Kết quả:');
  console.log(JSON.stringify(results, null, 2));
}

research().catch(console.error);
