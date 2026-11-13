# StudyBrain — university workspace

Course files, homework deadlines, a heart that fills with task completion, and
50-minute focus sessions inside each task. The source directory remains
`/Users/raminisimov/studysnap`; the product is now called **StudyBrain**.
Legacy browser storage keys are intentionally retained so existing tasks/files remain.

## Run

Double-click `start.command`. It prepares a local virtual environment, installs
`requirements.txt`, and starts the server on <http://127.0.0.1:8000>.

Manual setup:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

Keep the terminal open. Use the same browser and address each time: localStorage
and IndexedDB belong to the origin, including hostname and port.

## Google sign-in

The UI uses Google Identity Services. `server.py` verifies the ID token with
Google's library (signature, issuer, audience, expiry), then checks the nonce and
verified email. The session cookie is HttpOnly and SameSite=Lax; only its SHA-256
hash is stored with the profile/expiry in `.studybrain/auth.sqlite3`.
Requests that change auth state require same-origin and a CSRF token.

**Configuration still required:** create a Google OAuth Web client and set
`GOOGLE_CLIENT_ID` in `.env`, then restart. See [the Hebrew setup guide](docs/google-signin.md).
The app shows an explicit setup message until this is configured; it does not
simulate successful sign-in. No Google client secret is used in this flow.

This remains a local workspace: Google sign-in identifies the user but does not
upload, sync, or isolate browser-local tasks/files by Google account. Existing
local work is available before login. Public deployment requires a production
server, HTTPS and Secure cookies, and account-scoped data authorization.
The local server binds only to loopback and does not serve `.env`, Git metadata,
source Python files, or the session database.

## Task focus sessions

Open a task and choose “התחל · 50 דקות”. The timer is in the task details, with
pause/resume/reset. Closing the dialog does not stop it. Refresh reconstructs the
remaining time from the stored deadline, so background tabs do not slow it down.
Starting another task pauses the prior running task and preserves its remaining
time. Finishing a timer does not automatically mark homework completed.
The study planner uses 50-minute blocks with 10-minute breaks; its CTA opens the
first task so the user can start that task's timer.

## Lamda homework skill

Installed at `~/.codex/skills/biu-homework-scan/SKILL.md`.
Invoke `$biu-homework-scan` to open Bar-Ilan Lamda in Chrome, sign in yourself when
needed, and scan all accessible courses/topic sections for assignments.
It produces sourced reports and JSON under `study-files/moodle-scans/` (Git ignored),
tracks coverage and uncertain deadlines, and does not submit assignments or
silently replace app tasks. Scan reports stay private on the local machine and are excluded from publication.

## Course files

Download files from <https://lemida.biu.ac.il/>, enter a course name and add files
(up to 25 MB per file). “יצירת מטלה” creates a task from the filename/course.
Download an original and attach it to the chat to work on it together; task export
provides JSON context. Files remain in IndexedDB and tasks in localStorage. Keep
original files and exports: clearing browser data removes local work. Google
sign-in does not recover that data. No automatic Moodle sync or AI/OCR extraction.

## Verification

```sh
node --test tests/timer.test.cjs
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

Timer tests cover exact duration, pause/reload, task switching, background expiry,
reset and unavailable storage. Auth tests cover CSRF/origin, missing configuration,
invalid credentials/nonce, verified-session lifecycle, and private file/host blocking.
The provider-verification boundary is mocked in unit tests; real Google login
requires the user's Client ID and browser sign-in.

Visual assets and prompts are documented in `assets/README.md`; heart styling is
in `css/heart-theme.css`. `planner.py` remains a standalone historical prototype,
not the app's active scheduler.

## Tabbed workspace

The home view centers the progress heart. Top tabs switch between Home, Tasks,
Exams, Calendar, and Files without stacking their contents. Home is the initial
view on each page load; tabs support arrow/Home/End keyboard navigation.
Exams can be added, edited, and deleted; they persist locally under
`studybrain-exams`. The month calendar combines exams with tasks that have an
explicit ISO due date. Tasks without precise dates are counted beneath the calendar
rather than assigned guessed dates. Clicking an event opens its task or exam.

## GitHub / Vercel

`npm run build` creates a static `dist/` using an explicit asset allowlist.
Vercel uses `vercel.json`; Python authentication remains local-only and the
unconfigured Google button is hidden on the static deployment. No server or
private university reports are included in the published output.

Tasks remain device-local, not cloud-synced. In the Files tab, export the task
backup on the source device, transfer that JSON privately, then import on the
other device. Import merges without replacing existing task progress; repeated
imports do not duplicate tasks. Files, exams and timers are not in this backup.
Never commit personal backups or Moodle downloads to this public repository.
