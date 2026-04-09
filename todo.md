# Request Details - Future Plan

## Goal
Experiment with an alternate chat-style negotiation experience on the Request Details page, while keeping the existing layout stable.

## Planned Work
- Add a safe feature flag for UI variants (classic vs chat), with default set to classic.
- Build a WhatsApp-inspired offer timeline:
  - Left bubbles for counterparty offers.
  - Right bubbles for viewer offers.
  - Profile picture/avatar on each offer bubble.
- Move in-thread actions into chat cards:
  - Accept, Reject, Counter Offer.
  - Contact reveal actions (request/approve/decline).
  - OTP generate/regenerate/verify flow.
- Keep Cancel Request outside chat actions.

## UX Details To Finalize
- Bubble styling, spacing, and readability in dark/light mode.
- Offer metadata layout (type, amount, products, requested products).
- Action card tone and hierarchy so primary next step is obvious.
- Optional timestamps or relative time labels per offer.

## Technical Considerations
- Avoid unnecessary rerenders in countdown/timer and chat list.
- Ensure all actions remain permission-aware (turn/status-based).
- Keep fallback to classic UI fully intact.
- Add coverage for both UI variants in QA checks.

## Validation Checklist
- Classic UI unchanged.
- Chat UI action parity with classic flow.
- Turn labels and OTP responsibility are consistent.
- No regressions in contact reveal and transaction completion.
