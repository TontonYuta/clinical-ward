import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface SotaCandidate {
  name: string;
  category: string;
  paperTitle: string;
  arxivUrl: string;
  githubUrl: string;
  focus: string;
}

const CANDIDATES: SotaCandidate[] = [
  {
    name: 'PaperQA2',
    category: 'Scientific Claim Verification & Superhuman Literature Synthesis',
    paperTitle: 'Superhuman scientific literature search and citation with PaperQA2',
    arxivUrl: 'https://arxiv.org/abs/2409.13740',
    githubUrl: 'https://github.com/Future-House/paper-qa',
    focus: 'Claim-level verification, zero citation hallucination, evidence summarization'
  },
  {
    name: 'Corrective RAG (CRAG)',
    category: 'Robust Self-Evaluating Retrieval & Web/DDI Fallback',
    paperTitle: 'Corrective Retrieval Augmented Generation',
    arxivUrl: 'https://arxiv.org/abs/2401.15884',
    githubUrl: 'https://github.com/HuskyHank/CRAG',
    focus: 'Retrieval evaluator (Correct/Ambiguous/Incorrect), query rewrite, fallback'
  },
  {
    name: 'Self-RAG',
    category: 'Adaptive Retrieval & Self-Reflection Tokens',
    paperTitle: 'Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection',
    arxivUrl: 'https://arxiv.org/abs/2310.11511',
    githubUrl: 'https://github.com/AkariAsai/self-rag',
    focus: 'Reflection tokens [Retrieve], [IsRel], [IsSup], [IsUse], critic models'
  },
  {
    name: 'LightRAG',
    category: 'Fast Knowledge Graph Dual-Level Retrieval',
    paperTitle: 'LightRAG: Simple and Fast Retrieval-Augmented Generation',
    arxivUrl: 'https://arxiv.org/abs/2410.05779',
    githubUrl: 'https://github.com/HKUDS/LightRAG',
    focus: 'Dual-level retrieval (low-level specific entities + high-level broad themes)'
  },
  {
    name: 'Microsoft GraphRAG',
    category: 'Modular Graph-based RAG with Community Summaries',
    paperTitle: 'From Local to Global: A Graph RAG Approach to Query-Focused Summarization',
    arxivUrl: 'https://arxiv.org/abs/2404.16130',
    githubUrl: 'https://github.com/microsoft/graphrag',
    focus: 'Knowledge graph community detection, hierarchical summarization'
  }
];

async function verifyCandidates() {
  console.log('Khởi chạy Chromium headless để kiểm chứng live các Paper và Repo SOTA RAG...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const results: any[] = [];
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

  for (const cand of CANDIDATES) {
    console.log(`\n==============================================`);
    console.log(`Đang kiểm tra: ${cand.name} (${cand.category})`);
    console.log(`==============================================`);

    let arxivVerified = false;
    let arxivTitle = '';
    let arxivDate = '';
    let arxivAbstract = '';

    try {
      console.log(`-> Mở arXiv: ${cand.arxivUrl}`);
      await page.goto(cand.arxivUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1000);
      arxivTitle = await page.locator('h1.title').innerText().catch(() => '');
      arxivDate = await page.locator('.dateline').innerText().catch(() => '');
      arxivAbstract = await page.locator('blockquote.abstract').innerText().catch(() => '');
      arxivVerified = arxivTitle.length > 0;
      console.log(`   ✅ arXiv verified: ${arxivTitle.replace('Title:', '').trim()} (${arxivDate.trim()})`);
    } catch (err: any) {
      console.error(`   ❌ Lỗi truy cập arXiv: ${err.message}`);
    }

    let ghVerified = false;
    let ghStars = '';
    let ghDesc = '';
    let ghLicense = '';

    try {
      console.log(`-> Mở GitHub: ${cand.githubUrl}`);
      await page.goto(cand.githubUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);

      const starEl = page.locator('#repo-stars-counter-star, a[href$="/stargazers"]').first();
      if (await starEl.isVisible({ timeout: 5000 }).catch(() => false)) {
        ghStars = await starEl.innerText();
      }

      const descEl = page.locator('p.f4.my-3, [data-testid="markdown-body"] p').first();
      if (await descEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        ghDesc = await descEl.innerText();
      }

      ghVerified = true;
      console.log(`   ✅ GitHub verified: Stars = ${ghStars || 'N/A'}, Desc = ${ghDesc.slice(0, 80)}...`);

      // Chụp ảnh GitHub
      const ssPath = path.join(artifactDir, `research_${cand.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_github.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`   📸 Đã chụp ảnh lưu: ${ssPath}`);
    } catch (err: any) {
      console.error(`   ❌ Lỗi truy cập GitHub: ${err.message}`);
    }

    results.push({
      candidate: cand.name,
      category: cand.category,
      arxiv: {
        url: cand.arxivUrl,
        verified: arxivVerified,
        title: arxivTitle.replace('Title:', '').trim(),
        date: arxivDate.trim(),
        abstractSnippet: arxivAbstract.replace('Abstract:', '').trim().slice(0, 200) + '...'
      },
      github: {
        url: cand.githubUrl,
        verified: ghVerified,
        stars: ghStars.trim(),
        description: ghDesc.trim()
      },
      focus: cand.focus
    });
  }

  await browser.close();

  const outPath = path.join(artifactDir, 'scratch', 'sota_rag_research_raw.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n🎉 HOÀN TẤT THU THẬP BẰNG PLAYWRIGHT! Dữ liệu lưu tại: ${outPath}`);
}

verifyCandidates().catch(console.error);
