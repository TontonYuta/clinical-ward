import { extractQuickDosageMetrics, parseClinicalBullets, formatContraindicationsList } from '../src/utils/clinicalFormatter';

const sampleAdultDosage = `Liều uống thường dùng là 0,5 - 1 g/lần, 4 - 6 giờ một lần; tối đa là 4 g/ngày. Đặt trực tràng: 0,5 - 1 g/lần, 4 - 6 giờ một lần, tối đa 4 lần/ngày.
Truyền tĩnh mạch trong 15 phút: Liều được tính theo cân nặng như sau: Trên 50 kg: Liều một lần là 1 g, cứ cách 4 - 6giờ truyền một lần, liều tối đa là 4 g/ngày. Dưới 50 kg: Liều một lần là 15 mg/kg, cứ cách 4 - 6 giờ truyền một lần; tối đa là 60 mg/kg/ngày. Không được vượt quá liều tối đa 3 g/ngày ở bệnh nhân nghiện rượu, suy dinh dưỡng mạn, bị mất nước.`;

const sampleContra = `Người bệnh quá mẫn với paracetamol hoặc với bất kỳ thành phần nào của thuốc. Suy gan nặng.`;

console.log("=== TEST DOSAGE METRICS EXTRACTION ===");
const metrics = extractQuickDosageMetrics(sampleAdultDosage);
console.log("Routes:", metrics.routes);
console.log("Max Daily Dose:", metrics.maxDailyDose);
console.log("Interval:", metrics.interval);
console.log("Special Warning:", metrics.specialWarning);

if (!metrics.routes.includes("Đường uống") || !metrics.routes.includes("Truyền tĩnh mạch")) {
  throw new Error("Missing extracted routes!");
}
if (!metrics.maxDailyDose?.includes("4 g/ngày")) {
  throw new Error("Failed to extract max daily dose 4 g/ngày!");
}

console.log("\n=== TEST CLINICAL BULLETS PARSER ===");
const bullets = parseClinicalBullets(sampleAdultDosage);
console.log("Total parsed bullets:", bullets.length);
bullets.forEach((b, i) => console.log(`[${i + 1}] ${b.label ? `[${b.label}] ` : ""}${b.content.slice(0, 70)}...`));

if (bullets.length < 2) {
  throw new Error("Bullets should be split into multiple clean points!");
}

console.log("\n=== TEST CONTRAINDICATIONS LIST ===");
const contras = formatContraindicationsList(sampleContra);
console.log("Parsed contras:", contras);
if (contras.length < 2) {
  throw new Error("Contraindications should be split into distinct items!");
}

console.log("\n✅ ALL CLINICAL FORMATTER TESTS PASSED 100%!");
