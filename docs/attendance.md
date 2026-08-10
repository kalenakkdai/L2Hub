# Attendance and whereabouts

Daily Leadership attendance for the shared iPad/MacBook kiosk.

## Access

- `/attendance`: **only Mr. Jan and Jadon Li** may open the kiosk and call
  `attendance.manage_all` (hard allowlist in
  `app/services/attendance_operators.py`). Other AC/ASBO accounts do not see
  the Attendance nav item and receive 403 from setup APIs.
- `/whereabouts`: `attendance.view_all` or scoped
  `attendance.view_committee`. Committee heads only receive active entries for
  members of committees they lead; operators with view_all receive all entries.
- `/settings`: every student may opt into an attendance passkey after Jan/Jadon
  enrolls their student ID.

The backend enforces these permissions; hiding navigation is not authorization.

## Daily calculation

Opening `/attendance` calls the idempotent `POST /attendance/days` endpoint.
The server creates at most one row for its current local school date, using:

- `ATTENDANCE_TIMEZONE` (default `America/Los_Angeles`)
- `ATTENDANCE_CLASS_START` (default `08:00`)
- `ATTENDANCE_CLASS_END` (default `08:50`)

The server timestamp is authoritative. More than 60 seconds after `starts_at`
is late and receives a 90% attendance score. Closing the day calculates time in
the room from arrival through class end, subtracting overlapping bathroom and
errand intervals. Below 80% sets `under_80`, which the UI draws with a red halo.

Manual changes retain editor, timestamp, and reason.

## Student IDs and camera

The kiosk requests the front camera and uses the browser's native
`BarcodeDetector`. Frames are processed on-device and are never uploaded.
Browsers without that API fall back to the large mobile keypad.

Raw student IDs are normalized, keyed with `ATTENDANCE_ID_PEPPER`, and stored
only as an HMAC-SHA256 digest plus the last four characters for administration.
Use a production-only random pepper; changing it requires re-enrolling IDs.

## Touch ID / Face ID

Websites cannot access, identify, or store fingerprints. The opt-in alternative
is WebAuthn:

1. A student adds a platform passkey from My Settings on their own device.
2. Only credential ID, public key, signature counter, and device label are
   stored. No fingerprint/face template reaches L2 Hub.
3. At the kiosk, **Check in with personal-device passkey** starts the browser
   authenticator chooser. A browser may offer cross-device QR authentication.
4. FastAPI cryptographically verifies user verification and binds the signed
   challenge to the open attendance day before check-in.

Production must set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to the deployed HTTPS
host. WebAuthn only works in secure contexts (HTTPS, with localhost allowed for
development).

## Parent email and SMS

Below-80% alerts are always written to the durable `parent_alerts` outbox.
They are marked sent only after configured SMTP accepts them. Configure
`SMTP_HOST`, `SMTP_FROM_EMAIL`, and optional credentials; otherwise they remain
honestly queued.

Whereabouts pings always create an in-app notification for linked students. If
the student has a verified phone, the API returns an `sms:` handoff and the UI
opens the device composer. The website does not silently send SMS because the
MVP has no paid messaging provider and should not claim delivery it cannot
verify.

## Map privacy

The MSJHS map is a schematic of the destination the student declared while
checking out. It does not request location permission and does not perform
background GPS tracking. Active entries disappear when Jan/ASBO marks the
student back.
