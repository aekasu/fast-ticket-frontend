@AGENTS.md

## Starting a session (read this first — the user clears the conversation often)

This is a separate project from the backend at `../fast-ticket`; its `CLAUDE.md` workflow does not apply here.
Do this at the start of every conversation, before asking the user what to do:

1. Read `notes/NEXT.md`. It is the handoff: where things stand and what to do first. If it names a "Do first"
   item, start there unless the user asks for something else.
2. Skim `git log --oneline -10` and `git status`.
3. Before touching anything that calls the API, read the backend's contract: `../fast-ticket/notes/CLIENTS.md` and
   `../fast-ticket/notes/EVENTS.md` (and `KNOWN_LIMITS.md` for what is missing).
4. Tell the user in 3–5 lines what state the project is in and the first item you will take, then start it. Ask only
   for a genuine decision (the "Open decisions" in `AGENTS.md`).

Standing rules:
- Work only in this repo. A backend change is requested in `notes/BACKEND_REQUESTS.md`, not made from here.
- Verify each screen against the live stack and osTicket's own page, not mocks, before calling it done.
- Reading `../fast-ticket/.env` is allowed to log in to the dev stack (source it inside a command); never print its
  values or write them into this repo.
- Before ending a session: everything committed, `notes/NEXT.md` current (delete finished items, add what you found),
  and say in the final message whether the user can safely clear the conversation.
