#!/usr/bin/env python3
import argparse,json,sys
from pathlib import Path
from app.services.ingredient_mapping import build_ingredient_dictionary,validate_reviewed_aliases
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description="Validate reviewed ingredient aliases before rebuilding staging")
 p.add_argument("--aliases",type=Path,default=ROOT/"backend/data/knowledge_base/ingredient_aliases_reviewed.json")
 p.add_argument("--dtqg",type=Path,default=ROOT/"backend/data/knowledge_base/dtqg_monographs_extracted.json")
 a=p.parse_args(); rows=json.loads(a.aliases.read_text(encoding="utf-8")); monos=json.loads(a.dtqg.read_text(encoding="utf-8")); errors=validate_reviewed_aliases(rows,build_ingredient_dictionary(monos))
 if errors:
  print(chr(10).join(errors),file=sys.stderr); return 1
 approved=sum(row.get("status")=="approved" for row in rows)
 print(f"Reviewed alias file valid: {approved} approved aliases, {len(rows)-approved} pending/rejected"); return 0
if __name__=="__main__": raise SystemExit(main())
