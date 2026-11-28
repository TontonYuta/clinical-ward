"""
Clinical Markdown Output Layout Normalizer.
Guarantees clean, deterministic Markdown structure across all Copilot responses:
- Repairs PDF hyphenated word breaks (e.g. "amino-\\nglycosid" / "amino- glycosid").
- Joins broken mid-sentence soft line-breaks without merging headings/lists/tables.
- Normalizes bullets ("• " -> "- "), heading spacing, and collapses excessive blank lines.
- Preserves citations[].excerpt untouched for exact PDF highlighting.
"""

from __future__ import annotations

import re
from typing import List

_LIST_OR_STRUCT_RE = re.compile(
    r"^\s*(?:[-*+•]\s+|\d+[.)]\s+|#{1,6}\s+|>\s+|\|.*\||-{3,}\s*$|\*{3,}\s*$)"
)
_SENTENCE_END_RE = re.compile(r"[.!?:;…)\"”'\]]\s*$")
_HYPHEN_CONTINUATION_RE = re.compile(r"^-\s+([a-zà-ỹ]{2,20}[.!?,;]?)$")
_BRACKET_HEADING_RE = re.compile(r"^\[([A-ZÀ-Ỹ][^\[\]\n]{3,60})\]\s*$")


def _heal_pdf_word_breaks(text: str) -> str:
    # Join hyphenated line-breaks from PDF extraction: "amino-\nglycosid" -> "aminoglycosid"
    text = re.sub(r"([A-Za-zÀ-ỹ])-\s*\n\s*([a-zà-ỹ])", r"\1\2", text)
    # Also heal common OCR inline split "amino- glycosid" (lowercase-hyphen-space-lowercase)
    text = re.sub(r"\b([a-zà-ỹ]{3,})-\s+([a-zà-ỹ]{3,})\b", r"\1\2", text)
    # Fix PDF spacing around unit slashes: "2,4 g/ ngày" -> "2,4 g/ngày", "mg/ kg" -> "mg/kg"
    text = re.sub(r"\b(mg|mcg|µg|g|ml|l|kg|UI|IU)/\s+([a-zà-ỹ]+)\b", r"\1/\2", text, flags=re.IGNORECASE)
    return text


def _is_structural_line(line: str) -> bool:
    return bool(_LIST_OR_STRUCT_RE.match(line))


_LATEX_SYMBOL_REPLACEMENTS = (
    (r"\\geq\b|\\ge\b", "≥"),
    (r"\\leq\b|\\le\b", "≤"),
    (r"\\neq\b|\\ne\b", "≠"),
    (r"\\approx\b", "≈"),
    (r"\\pm\b", "±"),
    (r"\\times\b", "×"),
    (r"\\cdot\b", "·"),
    (r"\\rightarrow\b|\\to\b", "→"),
    (r"\\alpha\b", "α"),
    (r"\\beta\b", "β"),
    (r"\\gamma\b", "γ"),
    (r"\\delta\b", "δ"),
    (r"\\mu\b", "µ"),
    (r"\\Delta\b", "Δ"),
    (r"\^\s*\\circ\s*\\text\{([CF])\}", r"°\1"),
    (r"\^\s*\\circ\s*([CF])\b", r"°\1"),
    (r"\^\s*\\circ\b|\\circ\b", "°"),
)


def _normalize_inline_latex_to_unicode(text: str) -> str:
    """Convert inline clinical LaTeX math ($\\ge 38.5^\\circ\\text{C}$) into clean Unicode for non-KaTeX Markdown."""
    if "\\" not in text and "$" not in text:
        return text

    def _clean_math_expr(expr: str) -> str:
        s = expr.strip()
        s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
        s = re.sub(r"\\mathrm\{([^}]*)\}", r"\1", s)
        for pattern, repl in _LATEX_SYMBOL_REPLACEMENTS:
            s = re.sub(pattern, repl, s)
        s = re.sub(r"\s{2,}", " ", s).strip()
        return s

    # Replace inline $...$ only when it actually contains LaTeX commands (never touch currency like $100)
    text = re.sub(
        r"\$([^$\n]*\\[A-Za-z][^$\n]*)\$",
        lambda m: _clean_math_expr(m.group(1)),
        text,
    )
    # Also clean any stray bare LaTeX macros outside $...$
    if "\\" in text:
        text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
        for pattern, repl in _LATEX_SYMBOL_REPLACEMENTS:
            text = re.sub(pattern, repl, text)
    return text


def _strip_extra_tags_and_fix_markdown(text: str) -> str:
    """Convert custom/admonition tags into pure standard Markdown with zero extra tags."""
    text = _normalize_inline_latex_to_unicode(text)
    # Remove internal LLM/XML tracking tags such as <ANSWER_CLAIMS> [] or <EVIDENCE>
    text = re.sub(r"<ANSWER_CLAIMS>[\s\S]*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"</?[A-Z][A-Z0-9_]{2,}(?:\s[^>]*)?>", "", text)
    # Remove HTML tags if any leaked from LLM
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(?:p|div|span|b|i|strong|em|ul|ol|li)\b[^>]*>", "", text, flags=re.IGNORECASE)
    # Convert GitHub-style admonition tags > [!WARNING] / [!NOTE] / [!TIP] / [!IMPORTANT]
    text = re.sub(
        r"^>\s*\[!(?:WARNING|CAUTION)\]\s*(.*)$",
        lambda m: f"> **Cảnh báo:** {m.group(1).strip()}" if m.group(1).strip() else "> **Cảnh báo:**",
        text,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    text = re.sub(
        r"^>\s*\[!(?:NOTE|TIP|IMPORTANT)\]\s*(.*)$",
        lambda m: f"> **Lưu ý:** {m.group(1).strip()}" if m.group(1).strip() else "> **Lưu ý:**",
        text,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    # Convert inline bracketed labels like "[Lưu ý an toàn]: Tránh..." into bold labels (only if text follows on same line)
    text = re.sub(
        r"(?m)^\[([A-ZÀ-Ỹ][^\[\]\n]{2,50})\]:?[^\S\n]+(?=\S)",
        r"**\1:** ",
        text,
    )
    # Fix mismatched bold/italic markers like "- *1. Phối hợp với Ketorolac:**" -> "- **1. Phối hợp với Ketorolac:**"
    text = re.sub(r"(?m)^(\s*[-•]\s+)\*([^*\n]+?)\*\*(:?)", r"\1**\2**\3", text)
    return text


def _heal_soft_line_breaks(lines: List[str]) -> List[str]:
    merged: List[str] = []
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            merged.append("")
            continue

        # Convert standalone bracketed section labels like "[Liều dùng - Trẻ em]" into Markdown H3
        m_br = _BRACKET_HEADING_RE.match(line.strip())
        if m_br:
            line = f"### {m_br.group(1).strip()}"

        # Preserve 2-space sub-bullet indentation while normalizing bullet glyphs to "- "
        indent_match = re.match(r"^(\s{2,})(?:[•▪◦\-]|\*\s{2,})\s*", line)
        if indent_match:
            rest = line[indent_match.end():].strip()
            line = f"  - {rest}"
        else:
            line = re.sub(r"^\s*[•▪◦]\s+", "- ", line)
            line = re.sub(r"^\s*\*\s{2,}", "- ", line)

        # Ensure QĐ 5948 child attribute bullets stay indented under numbered parent bullets
        if (
            merged
            and re.match(r"^-\s+\*\*\d+\.", merged[-1])
            or (merged and merged[-1].startswith("  - ") and re.match(r"^-\s+(?:\*\*)?(?:Mức độ|Cơ chế|Hậu quả|Xử trí|Căn cứ|\*Căn cứ)", line))
        ):
            if re.match(r"^-\s+(?:\*\*)?(?:Mức độ|Cơ chế|Hậu quả|Xử trí|Căn cứ|\*Căn cứ)", line):
                line = f"  {line}"

        # Prevent false bullet on PDF-wrapped hyphenated terms like "...thoái hóa xương\n\n- khớp."
        if _HYPHEN_CONTINUATION_RE.match(line.strip()) and merged:
            target_idx = -2 if (merged[-1] == "" and len(merged) >= 2) else -1
            prev = merged[target_idx]
            if (
                prev != ""
                and not re.match(r"^\s*(?:#{1,6}\s+|-{3,}\s*$|\*{3,}\s*$)", prev)
                and not _SENTENCE_END_RE.search(prev)
            ):
                if target_idx == -2:
                    merged.pop()
                merged[-1] = f"{merged[-1]} {line.strip()}"
                continue

        if (
            merged
            and merged[-1] != ""
            and not _is_structural_line(merged[-1])
            and not _is_structural_line(line)
            and not _SENTENCE_END_RE.search(merged[-1])
        ):
            merged[-1] = f"{merged[-1]} {line.lstrip()}"
        else:
            merged.append(line)
    return merged


def _heal_unclosed_markdown(text: str) -> str:
    stripped_triple = text.replace("***", "")
    if stripped_triple.count("**") % 2 != 0:
        text += "**"
    if text.count("`") % 2 != 0:
        text += "`"
    return text


def normalize_clinical_markdown_output(text: str) -> str:
    """Normalize clinical chatbot output into clean, consistent Markdown layout."""
    if not text:
        return ""
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    cleaned = _strip_extra_tags_and_fix_markdown(cleaned)
    cleaned = _heal_pdf_word_breaks(cleaned)

    lines = cleaned.split("\n")
    healed_lines = _heal_soft_line_breaks(lines)

    # Ensure clean spacing before headings and around horizontal rules (---)
    formatted: List[str] = []
    for line in healed_lines:
        is_hr = bool(re.match(r"^\s*-{3,}\s*$", line))
        is_heading = bool(re.match(r"^#{1,6}\s+", line))
        if (is_heading or is_hr) and formatted and formatted[-1] != "":
            formatted.append("")
        formatted.append("---" if is_hr else line)
        if is_hr:
            formatted.append("")

    out = "\n".join(formatted)
    out = re.sub(r"\n{3,}", "\n\n", out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = _heal_unclosed_markdown(out).strip()
    return out
