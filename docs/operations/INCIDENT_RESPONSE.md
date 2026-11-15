# ErgonX incident response

What to do when something goes wrong with ErgonX: an outage, an attack, a compromised
account, lost or exposed data. Written for the platform operator and organisation administrators.

## Who does what

| Role | Responsibility |
|---|---|
| Incident lead (platform operator) | Records the incident, decides actions, keeps the timeline, closes it |
| Organisation administrator | Acts inside their organisation: signs people out, suspends accounts, records privacy breaches |
| Data protection officer (per organisation) | Decides on notifying the Data Protection Commission and the people affected |

Keep a contact list (names, phones, backup contacts) outside ErgonX, so it is reachable when
ErgonX is down.

## Severity

| Level | Examples | Respond |
|---|---|---|
| SEV1 Critical | Service down; data exposed or lost; an administrator account compromised | Immediately, any hour |
| SEV2 Major | Payroll, leave or sign-in failing for some organisations; an attack in progress but blocked | Same working day |
| SEV3 Minor | One feature broken; a vulnerability with no sign of use | Next working day |

## The steps

1. **Detect and record.** Super Admin → Incidents → record it with the time it was detected,
   kind, severity and affected organisations. Everything after goes in its timeline.
2. **Contain.** Stop it getting worse:
   - Compromised account: an organisation admin opens Settings → Users → the person →
     *Sign out everywhere*, then resets their password or suspends them.
   - Organisation-wide compromise: Super Admin → the organisation → *Sign out everyone*
     (requires a reason), or *Suspend* the organisation.
   - Leaked API key or webhook secret: revoke it under Settings → Integrations.
   - Suspected server compromise: rotate `DJANGO_SECRET_KEY` (this signs everyone out) and every
     credential in the hosting environment.
   Mark the incident *Contained* with a note of what was done.
3. **Investigate.** Use the audit trail (Settings → Audit, Super Admin → Platform audit), the
   security overview, and the hosting logs. Note findings in the timeline.
4. **Recover.** Fix the cause, restore data if needed (see `DISASTER_RECOVERY.md`), confirm the
   service works, and mark the incident *Recovered*.
5. **Notify.** If personal data was exposed, lost or altered, every affected organisation records
   it in Privacy → Breaches. Ghana's Data Protection Act, 2012 (section 31) requires the
   organisation to notify the Data Protection Commission and the people affected as soon as
   reasonably practicable after discovering it; the register records when each was told, or why not.
6. **Close.** Record the root cause and lessons learned, then close the incident. Review open
   actions at the next team meeting.

## Built-in warning signs

- **Security overview** (Settings → Security): administrators without two-step sign-in, bursts of
  failed sign-ins, unused accounts, role changes, old API keys, export bursts, stale restore tests.
- **New-device alerts:** each person is notified (in ErgonX, and by email when email is on) when
  their account signs in from a device and network it has not used before.
- **Account lockout:** repeated wrong passwords lock the account and the source address for a while.

## Message templates

**To affected organisations (outage):** "ErgonX was unavailable from [time] to [time] because of
[short cause]. No data was lost [or: data entered after [time] needs re-entering]. We have
[fix] to prevent a repeat."

**To affected people (data breach), sent by the organisation:** "On [date] we found that [what
data] about you was [exposed/lost] because [cause]. We have [containment]. You may want to
[action, e.g. watch for suspicious messages]. Contact [data protection officer] with questions.
We have informed the Data Protection Commission."
