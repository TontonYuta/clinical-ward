# Clinical Ward interaction and visual rules

Source skill: /home/ubuntu/.codex/skills/ui-ux-pro-max/SKILL.md, installed from nextlevelbuilder/ui-ux-pro-max-skill commit ccce51cba388476d4f403091ddb91636d5cd9fed.

User requirements: one page header; remove repeated title/context bands; clear severity colors; medical forms quick to find and operate, larger workspace permitted; preserve important clinical and printed information. Implement directly under the user's explicit authorization.

Use the skill's verified Accessible & Ethical and Minimalism & Swiss Style guidance: restrained mineral-green brand, warm neutral surfaces, readable contrast, one primary action, visible keyboard focus, text plus icons for status, native labeled controls, responsive layout and reduced motion. Keep a 16px standard reading scale, 24px page title and 16–18px section headings. Use the existing local font stack with Vietnamese support; no blocking external font requests.

The design-system search returned marketing landing-page patterns twice (Trust & Authority / Hero + Features). These are unsuitable for an internal clinical workstation and are not adopted or persisted as recommendations. Motion snippets, pricing, sales CTA and artificial trust badges are also excluded. UX searches verified Color Only, Color Contrast, Form Labels, Inline Validation and Submit Feedback. React search verified deriving display data instead of maintaining duplicate state.

Severity tokens: danger dark red (#b42318) on pale red; warning brown-orange (#8a4b00) on pale amber; info blue (#175cd3) on pale blue; success green (#067647) on pale green; neutral grey. Confirmed danger/counter-indication/expired are red. Pending review, near expiry and unsigned are amber. Context/help is blue. Green requires an actual recorded completion, never a fabricated safety/certification claim. Labels/icons accompany colors. Verify normal-text contrast >=4.5:1 against actual surfaces.

Page structure: sidebar or bottom navigation, one shared header with the page title and relevant action, then toolbar and data. No repeated breadcrumb page title, numbered eyebrow or generic description beneath it. Retain real section headings with distinct purpose. A document's official printed title is document content and is preserved.

Medical forms: wide dialog with one control header; searchable grouped form catalog; source-record selector; compact review notice; readable A4 preview with fit/100% toggle and one Print / PDF primary action. Advanced HTML export is secondary. Avoid eight long horizontal tabs, repeated A4 badges, fixed 0.88 fake fit, previous/next arrows and duplicated status footers. All eight form types remain available. Print body remains unchanged. Missing source data must be visible; do not silently substitute an unrelated record or imply template values are verified.

Verification: runtime duplicate-heading audit before/after, 375/768/1024/1440px and landscape, large font, keyboard operation, color contrast, unchanged text of all eight printed forms, print media controls hidden, no API writes during tests.

## Applied verification

The one-header implementation uses the App header for the title and React portals for page-owned actions, without a second PageHeading band. Medical forms use a 1660px maximum panel, 3 grouped catalog sections, explicit source selection, measured paper fitting and a short-height scroll rule. The mobile catalog is a separate focus scope and makes covered controls inert. All 8 printed-text hashes match baseline.

Final audited coverage: 104 TSX files and 90 desktop/mobile states; zero duplicate-heading candidates and zero collection errors with the declared audit data mode. Other clinical/backend/template-validation scope remains separate.
