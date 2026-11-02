# Chatbot Evidence and Bounded Context Design

## Intent
Improve physician-facing chatbot trust and follow-up continuity. Answers should expose the exact evidence behind citations, and later turns should resolve references to earlier turns without sending an unbounded transcript to the model.

## Goals
- Show a concise source excerpt alongside each clickable citation when excerpt data exists.
- Maintain bounded per-session conversation history for RAG/LLM follow-up resolution.
- Bound history by 8 recent turns and 12,000 prompt characters; truncate oversized messages and remove oldest turns first.
- Keep deterministic medication lookups and DDI checks authoritative; explicit current-turn entities override history.
- Expand automated evaluation for multi-turn resolution, missing/ambiguous DDI entities, citation evidence, and provenance.

## Non-goals
- Persistent conversation storage across backend restarts.
- Sending the complete browser transcript or patient records to the model.
- Replacing rules-based routing, DDI engines, or clinical review with an LLM.
- Changing mobile layout.

## Approaches
1. **Bounded server-side turn buffer (chosen):** store recent user/assistant text in the existing owner-scoped session state, with strict count/character limits. This minimizes client changes and keeps entity state colocated.
2. **Client sends complete transcript:** simpler to wire, but duplicates untrusted client history and encourages unbounded requests. Rejected.
3. **Persistent database conversation archive:** supports long-term retrieval but adds retention/privacy/migration scope not needed for follow-up continuity. Rejected.

## Design
- Add compact turn records and bounded append/render methods to session state; retain the existing owner namespace and 30-minute TTL.
- Record user input and assistant reply once per completed request, including deterministic replies. Do not store attachments or clinical-record contents. Keep at most 8 turns and 12,000 context characters; cap each side at 2,000 characters and drop oldest turns first.
- Resolve deictic medication follow-ups using active medication context already held in the session; explicit medicine names in the current query take precedence. Label history in RAG prompts as context, never as evidence. Retrieved sources remain factual evidence.
- Populate citations with bounded excerpts and render each as an expandable evidence disclosure with source title/page and excerpt, retaining the PDF link.
- Extend evaluation for multi-turn drug follow-up, session isolation, explicit entity override, ambiguous DDI clarification, and citation/excerpt contracts.

## Constraints and safety
- Conversation history is context only and never clinical evidence.
- Do not copy patient identifiers or clinical-record details into this history.
- Do not change authoritative DDI or medication-field routing.
- Do not share history across user/session namespaces.
- Cite only verified document mappings; never synthesize a page number.

## Success criteria
- A follow-up such as “còn chống chỉ định?” after a Paracetamol lookup resolves to Paracetamol with a source citation.
- Long sessions stay within the history limits; newest turns are retained and oldest dropped first.
- Users with the same requested session ID do not share history.
- Citation evidence can be expanded and PDF links continue to work.
- Existing chatbot/RAG/guardrail tests pass and new evaluation cases pass.
