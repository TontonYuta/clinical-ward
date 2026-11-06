"""
Bộ chuẩn hóa hoạt chất quốc tế (Active Ingredient Normalizer) chuẩn Dược Thư & Cục QLD.
Bóc tách muối, nồng độ/hàm lượng, dạng bào chế và ánh xạ từ đồng nghĩa INN.
"""
from __future__ import annotations
import re

SALT_PATTERN = re.compile(
    r"\b(natri|kali|calci|magnesi|hydroclorid|hydrochloride|hcl|besylat|besylate|maleat|maleate|"
    r"phosphat|phosphate|acetat|acetate|succinat|succinate|tartrat|tartrate|sulfat|sulfate|"
    r"nitrat|nitrate|citrat|citrate|gluconat|gluconate|mesylat|mesylate|bromid|bromide|iodid|iodide|"
    r"valerat|valerate|propionat|propionate|dipropionat|dipropionate|fumarat|fumarate|lactat|lactate|"
    r"hydrat|hydrate|trihydrat|trihydrate|monohydrat|monohydrate|dihydrat|dihydrate|hemihydrat|hemihydrate|"
    r"sesquihydrat|sesquihydrate|disodium|sodium|potassium|calcium|hydrobromid|hydrobromide|edisylat|edisylate)\b",
    re.IGNORECASE
)

STRENGTH_PATTERN = re.compile(
    r"[\d.,\s\xa0]+(?:mcg|microgram|µg|μg|ug|mg|g|kg|ml|iu|ui|units?|%|đơn vị).*$",
    re.IGNORECASE
)

INN_ALIASES: dict[str, str] = {
    "acetaminophen": "paracetamol",
    "paracetamol": "paracetamol",
    "amoxicillin": "amoxicilin",
    "amoxicilin": "amoxicilin",
    "ceftriaxone": "ceftriaxon",
    "ceftriaxon": "ceftriaxon",
    "ampicillin": "ampicilin",
    "ampicilin": "ampicilin",
    "ciprofloxacin": "ciprofloxacin",
    "levofloxacin": "levofloxacin",
    "azithromycine": "azithromycin",
    "azithromycin": "azithromycin",
    "clarithromycin": "clarithromycin",
    "erythromycin": "erythromycin",
    "clindamycin": "clindamycin",
    "metronidazole": "metronidazol",
    "metronidazol": "metronidazol",
    "omeprazole": "omeprazol",
    "omeprazol": "omeprazol",
    "esomeprazole": "esomeprazol",
    "esomeprazol": "esomeprazol",
    "pantoprazole": "pantoprazol",
    "pantoprazol": "pantoprazol",
    "rabeprazole": "rabeprazol",
    "rabeprazol": "rabeprazol",
    "adrenaline": "adrenalin",
    "adrenalin": "adrenalin",
    "epinephrine": "adrenalin",
    "norepinephrine": "noradrenalin",
    "noradrenalin": "noradrenalin",
    "morphine": "morphin",
    "morphin": "morphin",
    "fentanyl": "fentanyl",
    "diazepam": "diazepam",
    "midazolam": "midazolam",
    "aspirin": "aspirin",
    "acid acetylsalicylic": "aspirin",
    "acetylsalicylic acid": "aspirin",
    "ibuprofen": "ibuprofen",
    "diclofenac": "diclofenac",
    "ketorolac": "ketorolac",
    "meloxicam": "meloxicam",
    "celecoxib": "celecoxib",
    "paroxetine": "paroxetin",
    "paroxetin": "paroxetin",
    "sertraline": "sertralin",
    "sertralin": "sertralin",
    "fluoxetine": "fluoxetin",
    "fluoxetin": "fluoxetin",
    "atorvastatin": "atorvastatin",
    "rosuvastatin": "rosuvastatin",
    "simvastatin": "simvastatin",
    "losartan": "losartan",
    "valsartan": "valsartan",
    "telmisartan": "telmisartan",
    "candesartan": "candesartan",
    "amlodipine": "amlodipin",
    "amlodipin": "amlodipin",
    "nifedipine": "nifedipin",
    "nifedipin": "nifedipin",
    "nicardipine": "nicardipin",
    "nicardipin": "nicardipin",
    "diltiazem": "diltiazem",
    "verapamil": "verapamil",
    "bisoprolol": "bisoprolol",
    "metoprolol": "metoprolol",
    "atenolol": "atenolol",
    "propranolol": "propranolol",
    "carvedilol": "carvedilol",
    "salbutamol": "salbutamol",
    "albuterol": "salbutamol",
    "aciclovir": "aciclovir",
    "acyclovir": "aciclovir",
    "hydrochlorothiazide": "hydroclorothiazid",
    "hydroclorothiazid": "hydroclorothiazid",
    "acetylcysteine": "acetylcystein",
    "acetylcystein": "acetylcystein",
    "chlorpheniramine": "clorpheniramin",
    "clorpheniramin": "clorpheniramin",
    "loratadine": "loratadin",
    "loratadin": "loratadin",
    "fexofenadine": "fexofenadin",
    "fexofenadin": "fexofenadin",
    "desloratadine": "desloratadin",
    "desloratadin": "desloratadin",
    "methylprednisolone": "methylprednisolon",
    "methylprednisolon": "methylprednisolon",
    "prednisone": "prednison",
    "prednison": "prednison",
    "prednisolone": "prednisolon",
    "prednisolon": "prednisolon",
    "ezetimibe": "ezetimib",
    "ezetimib": "ezetimib",
    "fenofibrate": "fenofibrat",
    "fenofibrat": "fenofibrat",
    "vancomycin": "vancomycin",
    "ceftazidime": "ceftazidim",
    "ceftazidim": "ceftazidim",
    "cefotaxime": "cefotaxim",
    "cefotaxim": "cefotaxim",
    "cefepime": "cefepim",
    "cefepim": "cefepim",
    "meropenem": "meropenem",
    "imipenem": "imipenem",
}

def clean_key(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"\(.*?\)", "", text)
    text = text.strip().lower()
    return re.sub(r"[^a-z0-9à-ỹ]+", "", text)

def extract_candidate_inns(raw_text: str | None) -> list[str]:
    """
    Trích xuất danh sách các INN tiềm năng từ chuỗi hoạt chất thô theo thứ tự ưu tiên.
    """
    if not raw_text or not raw_text.strip():
        return []

    text = raw_text.strip()
    
    # 1. Bóc tách tiền tố công thức: "Mỗi ... chứa: X", "Mỗi ml chứa X"
    if "chứa:" in text.lower() or "chứa " in text.lower():
        parts = re.split(r"chứa[:\s]+", text, flags=re.IGNORECASE)
        if len(parts) > 1:
            text = parts[1].strip()

    # 2. Xử lý hoạt chất đầu tiên nếu là dạng phối hợp
    first_token = re.split(r"[;+/]|\b(?:và|and)\b", text, flags=re.IGNORECASE)[0].strip()

    # 3. Xử lý "X tương đương Y" hoặc "X (dưới dạng Y)"
    equiv_match = re.search(r"tương đương(?: với)?\s+([A-Za-zÀ-ỹ\s]+)", first_token, re.IGNORECASE)
    base_from_equiv = equiv_match.group(1).strip() if equiv_match else None

    # 4. Loại bỏ hàm lượng
    clean_base = STRENGTH_PATTERN.sub("", first_token).strip()
    clean_base_no_paren = re.sub(r"\(.*?\)", "", clean_base).strip()

    # 5. Loại bỏ gốc muối
    no_salt = SALT_PATTERN.sub("", clean_base_no_paren).strip()

    candidates: list[str] = []
    for cand in (clean_base_no_paren, clean_base, no_salt, base_from_equiv, first_token):
        if cand and cand.strip():
            c_clean = cand.strip()
            if c_clean not in candidates:
                candidates.append(c_clean)
            c_lower = c_clean.lower()
            if c_lower in INN_ALIASES and INN_ALIASES[c_lower] not in candidates:
                candidates.append(INN_ALIASES[c_lower])
            no_salt_c = SALT_PATTERN.sub("", c_clean).strip()
            if no_salt_c and no_salt_c not in candidates:
                candidates.append(no_salt_c)
            if no_salt_c.lower() in INN_ALIASES and INN_ALIASES[no_salt_c.lower()] not in candidates:
                candidates.append(INN_ALIASES[no_salt_c.lower()])

    return candidates
