# Physician Copilot Scope Design

## Intent

The clinical chatbot serves doctors as a work assistant. It helps retrieve referenced clinical and regulatory information, review a selected patient/case, and prepare operational drafts that doctors can also complete manually in the application. It does not act as a patient-facing symptom checker or conduct a consultation with the doctor as if the doctor were the patient.

## Goals

- Use professional clinician-facing language in greetings, explanations, examples, prompts, and suggested follow-ups.
- Frame patient-specific work around an explicitly identified patient, encounter, or prescription. Ask for missing case context instead of addressing the user as the patient.
- Keep drug monograph and regulatory lookup available as sourced reference information for clinicians.
- Keep manual workflows such as CPOE draft preparation, stock/shift review, and preparing patient instructions, while requiring review and explicit action in existing UI forms before persistence or sending.
- Never invent a patient, prescription, medication schedule, contact detail, or clinical context for an operational draft.
- Recast fever/headache scenario answers as clinician reference notes; do not prescribe individually or ask the doctor for their own symptoms.

## Non-goals

- Do not remove clinical knowledge lookup, patient record review, existing operational modules, or physician-approved patient communication workflows.
- Do not let chatbot text send, sign, dispense, or persist an order without the existing explicit workflow.
- Do not change the clinical evidence catalog or claim that indexed coverage is complete.

## Approaches

- Remove every workflow involving patient records or patient communication. Rejected because doctors need to operate those workflows.
- Keep all current behavior and only change “you”/“I” wording. Rejected because self-symptom prompts, fabricated drafts, and unscoped triage remain patient-facing behavior even after copy edits.
- Keep clinician workflows, but set clinician scope at intent routing and prompt boundaries, require case identity for patient-specific guidance, remove synthetic advice drafts, and update symptoms/examples as professional references. Chosen because it preserves useful manual operations while correcting both behavior and presentation.

## Behavior contract

- Greeting: greet the physician and offer medication/regulatory lookup and manual workflows; wellbeing greetings receive a short professional response without asking about the doctor's health.
- Drug question without a patient/case: answer sourced general drug information. If user asks for a decision about an individual, ask for the patient/encounter and relevant missing context.
- Symptom question: treat “I have fever/headache” as a clinician's question about a case only when case context is identified; otherwise clarify whether it is a general reference question or ask for case details. Use professional phrasing in responses and follow-up chips.
- Prescription/advice operation: never synthesize patient/medicine/schedule/contact fields. Clarify missing order/patient information and route to the existing form. Leave save/send to explicit UI actions.
- Operational intents: retain existing manual workflows, confirmations, and permission checks.

## Acceptance

- Tests prove greeting, ambiguous symptom, general drug lookup, patient-scoped review, and incomplete advice/order inputs do not turn the doctor into the patient.
- A patient advice request with insufficient structured source data produces clarification and no fabricated action card.
- UI welcome and guidance copy identify doctors as users and operational workflows as the purpose.
- Existing medication lookup, DDI, CPOE, and operations tests keep passing.
