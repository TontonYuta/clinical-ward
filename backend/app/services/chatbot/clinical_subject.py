"""Keep symptom consultations and patient names separate from drug lookups."""
import re
import unicodedata


SYMPTOM_PHRASES = ("sốt", "đau bụng", "buồn nôn", "nôn", "tiêu chảy", "đi ngoài",
                   "mất nước", "đau đầu", "chóng mặt", "khó thở")
DISEASE_SUBJECTS = ("huyết áp", "trào ngược", "đái tháo đường", "tiểu đường")


def medication_subject_text(query: str) -> str:
    """Mask patient references without changing the original clinical query."""
    masked = list(query)
    for match in re.finditer(r"\b(?:bệnh nhân|người bệnh|bn)\s+", query, re.IGNORECASE):
        # Prefix tokens must not form a herbal alias across a patient's name
        # (for example the `nhân Trần` in `bệnh nhân Trần Thị Mai`).
        masked[match.start():match.end()] = " " * (match.end() - match.start())
        end, names = match.end(), []
        while len(names) < 5:
            word = re.match(r"([^\W\d_][\w'’-]*)", query[end:])
            if not word or not word.group(1)[0].isupper():
                break
            names.append(word.group(1))
            end += word.end()
            whitespace = re.match(r"\s+", query[end:])
            if not whitespace:
                break
            end += whitespace.end()
        if len(names) >= 2:
            masked[match.end():end] = " " * (end - match.end())
    return "".join(masked)


def _normalized(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in text if not unicodedata.combining(char)).replace("đ", "d")


def is_symptom_consultation(query: str) -> bool:
    lower = _normalized(query)
    if not any(_normalized(symptom) in lower for symptom in SYMPTOM_PHRASES):
        return False
    if any(term in lower for term in ("thuoc nay", "thuoc do", "sau tiem", "phan ve", "soc")):
        return False
    asks_about_case = any(term in lower for term in (
        "trieu chung", "bieu hien", "benh gi", "bi gi", "nguyen nhan", "toi bi", "minh bi",
        "benh nhan", "nguoi benh", "nen uong", "nen dung", "thuoc nao", "thuoc gi",
    ))
    if not asks_about_case:
        return False
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    subject = medication_subject_text(query)
    return not (resolve_registered_medications(subject) or get_drug_lexical_matcher().extract_medications(subject))


def is_general_disease_consultation(query: str) -> bool:
    lower = _normalized(query)
    # Prescription/advice form commands belong to their workflow handlers.
    # The phrase `thuốc cho bệnh nhân` alone is not a disease subject.
    if any(term in lower for term in (
        "dan do don thuoc", "mo form ke don", "mo bieu mau ke don", "tao don thuoc",
    )):
        return False
    known_disease = any(_normalized(topic) in lower for topic in DISEASE_SUBJECTS)
    treatment_request = any(term in lower for term in (
        "thuoc dieu tri", "thuoc chua", "thuoc tri", "thuoc cho benh", "lua chon thuoc",
        "chon thuoc", "dieu tri benh", "phac do dieu tri",
    )) or ("thuoc" in lower and any(term in lower for term in ("dieu tri", "nen dung", "nen uong")))
    if any(term in lower for term in ("thuoc nay", "thuoc do")) and not known_disease:
        return False
    if not treatment_request and not (known_disease and any(term in lower for term in (
            "thuoc", "dieu tri", "phac do", "lua chon", "toi bi", "huong dan"))):
        return False
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    subject = medication_subject_text(query)
    return not (resolve_registered_medications(subject) or get_drug_lexical_matcher().extract_medications(subject))


def supports_disease_subject(query: str, title: str, source: str, content: str, entity_type: str) -> bool:
    if entity_type not in {"guideline", "protocol", "clinical_guideline", "circular"}:
        return False
    lower, heading = _normalized(query), _normalized(f"{title} {source}")
    topics = [_normalized(topic) for topic in DISEASE_SUBJECTS if _normalized(topic) in lower]
    if topics:
        if not all(topic in heading for topic in topics):
            return False
    else:
        # Unknown diseases are not mapped to a guessed drug or protocol. Keep
        # only guidance whose heading explicitly identifies the requested
        # subject; ambiguous wording conservatively produces abstention.
        filler = set("thuoc dieu tri chua cho benh lua chon nen dung uong phac do huong dan toi bi nao gi la va cua voi trong the nao nhu an toan vui long giup nguoi o".split())
        requested_terms = set(re.findall(r"[a-z0-9]+", lower)) - filler
        heading_terms = set(re.findall(r"[a-z0-9]+", heading))
        if not requested_terms or not requested_terms.issubset(heading_terms):
            return False
    evidence = _normalized(f"{title} {source} {content}")
    for population in (("suy than",), ("suy gan",), ("co thai", "mang thai", "thai ky", "thai phu"),
                       ("tre em", "tre nho", "nhi khoa"), ("nguoi lon",),
                       ("so sinh",), ("nguoi cao tuoi", "nguoi gia"), ("cho con bu",)):
        requested = any(term in lower for term in population)
        if requested and not any(term in evidence for term in population):
            return False
        if not requested and any(term in heading for term in population):
            return False
    return True


def supports_symptom_subject(query: str, title: str, source: str, entity_type: str) -> bool:
    if entity_type not in {"guideline", "protocol", "clinical_guideline", "circular"}:
        return False
    requested = [_normalized(symptom) for symptom in SYMPTOM_PHRASES if _normalized(symptom) in _normalized(query)]
    heading = _normalized(f"{title} {source}")
    return any(symptom in heading for symptom in requested)
