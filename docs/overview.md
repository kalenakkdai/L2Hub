# L2 Hub Overview

L2 Hub is a student-government operations platform for Mission San Jose High School’s Leadership 2 class.

## First product: Maze Day debrief

The first launch feature is a synchronized five-minute event debrief for about 50 student leaders.

Core workflow:

1. An ASBO or AC starts a five-minute debrief session.
2. Students rate the event and participating committees.
3. Students enter exactly three strengths and three improvements.
4. Students may request materials with purchasing links.
5. Students may submit anonymous serious concerns.
6. A projected dashboard shows each participant as not started, writing, submitted, or absent.
7. A successful submission automatically creates a gradebook entry.
8. The system generates an Event Wrapped summary.
9. The system generates an editable meeting agenda.
10. Historical meeting notes may later be retrieved through a local RAG system.

## Roles

- **Member** — submit own debrief; view own grades and published summaries
- **Committee Head** — Member access plus scoped committee operations
- **ASBO** — manage organization-wide events, sessions, and live progress
- **President** — peer super-admin with AC
- **AC** — unrestricted administration, including feedback and role management

## Important design rules

- Backend is authoritative for timing and grading (do not trust the browser clock).
- Authorization is enforced on the backend.
- Anonymous concern authors must never be exposed.
