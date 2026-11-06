# Clinical workspace redesign

Build the user's requested full UI replacement in the existing React app. Four active pages only: overview, prescriptions, pharmacy, cold chain. Preserve clinical records, prescription checks, role restrictions and printed forms.

Direction: a warm paper workspace, deep mineral green navigation, amber accents, generous editorial headings, quiet tables and an original vector topographic background. No stock hospital imagery or invented clinical metrics. One primary action per view, progressive disclosure for secondary filters, detail dialogs for full records. Typography and navigation must fit mobile without horizontal page overflow. Every page has a clear title, concise purpose and compact data summary.

Overview: prioritize attention items derived from actual provided data, with direct links to work. Remove marketing capabilities and PDF catalog. Keep patient lookup and medication lookup as compact actions, subject to role access. Expose demonstration data context clearly.

Prescriptions: concise list with identity, diagnosis, type, status and a detail action. Complete medication information stays in the detail. Pharmacy: product/strength/form, lot/expiry, stock/unit, location and explicit attention status. Registration and manufacturer remain in the detail. Cold chain: compact readings, last log, quarantine separate from temperature, inventory/log tabs. Do not claim GSP certification, valid MKT or hardware telemetry unsupported by supplied data.

Dialogs and assistant share typography, borders, radius, focus and colors. Preserve official A4 print styling. Do not fabricate patient matches or successful audit results when unavailable.

References: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ (hierarchy, grouping, restrained palette); https://www.w3.org/TR/WCAG22/ (contrast, keyboard focus, reflow and targets). Aim for 40px main controls; the WCAG 2.2 AA target minimum is 24px with exceptions.

Legal boundary: presentation changes are not a certification of regulatory compliance. Previously researched TT26/2025 prescription content, TT23/2011 inpatient use, GSP consolidated12/VBHN-BYT2025 AppendixIV, and current 2026 vaccination/controlled-drug rules inform what records remain accessible. Do not remove required prescription content from records or printouts.
