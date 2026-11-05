import { chromium } from "playwright";

async function run() {
  console.log("🚀 Starting Playwright E2E for User Intent Accuracy & Multi-turn Pinpoint Presenters...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Navigate to overview / chat
  await page.goto("http://127.0.0.1:5173/#overview", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // 1. Open AI Copilot drawer if not open
  const copilotToggle = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
  if (await copilotToggle.isVisible()) {
    await copilotToggle.click();
    await page.waitForTimeout(600);
    console.log("✅ Opened Trợ lý AI Drawer.");
  }

  const inputSelector = 'input[placeholder*="Nhập câu hỏi hoặc"], textarea';
  const chatInput = page.locator(inputSelector).first();
  await chatInput.waitFor({ state: "visible", timeout: 10000 });

  // Turn 1: Lookup Paracetamol
  console.log("📝 Sending Turn 1: Paracetamol");
  await chatInput.fill("Paracetamol");
  await chatInput.press("Enter");

  await page.waitForTimeout(4500);

  // Turn 2: Deictic alcohol question: "thuốc này có kỵ rượu không"
  console.log("📝 Sending Turn 2: thuốc này có kỵ rượu không");
  await chatInput.fill("thuốc này có kỵ rượu không");
  await chatInput.press("Enter");

  await page.waitForTimeout(4500);

  // Verify response content
  const pageText = await page.innerText("body");
  const hasAlcohol = pageText.includes("Rượu") || pageText.includes("rượu");
  const hasPharmacology = pageText.includes("CYP2E1") || pageText.includes("NAPQI") || pageText.includes("Glutathion") || pageText.includes("độc tính gan");
  const hasCitation = pageText.includes("Dược thư tr.1118") || pageText.includes("Dược thư");

  console.log("Results:");
  console.log(" - Has Alcohol keywords:", hasAlcohol);
  console.log(" - Has Pharmacology mechanism:", hasPharmacology);
  console.log(" - Has Citation tag:", hasCitation);

  if (!hasAlcohol || !hasPharmacology) {
    throw new Error("Turn 2 did not provide pinpoint alcohol pharmacology response!");
  }

  // Screenshot as evidence
  const screenshotPath = "/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/screen_intent_accuracy_alcohol_verified.png";
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);

  await browser.close();
  console.log("🎉 Playwright E2E Test PASSED 100%!");
}

run().catch((err) => {
  console.error("❌ E2E Test Failed:", err);
  process.exit(1);
});
