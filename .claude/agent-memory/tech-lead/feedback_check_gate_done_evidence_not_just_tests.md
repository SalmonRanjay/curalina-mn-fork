---
name: check-gate-done-evidence-not-just-tests
description: Re-running a suite only proves the numbers; verify a phase gate against its workflow doc's own "Done evidence" clause, and check that named test directories aren't placeholders
metadata:
  type: feedback
---

When re-verifying a claim that a service "reached A*n*", **re-running
`make test` is necessary but not sufficient.** Open the owning
`agentic_flow/*_workflow.md` gate section and check the claim against its
literal **"Done evidence"** clause and its "Mandatory tests" list, item by
item.

**Why:** session 8, 2026-09-14. Recommendation and variants were recorded as
"full A3" across three sessions. Every headline number re-verified exactly
(259/91%/17 and 71/89%/27, no 0%-coverage modules, Ruff and `mypy --strict`
clean) — and the claim was still wrong. Both services' A3 done-evidence is
explicitly *integration*-level, and
`tests/integration/test_integration_scaffold.py` in both was still, in full:

```python
def test_integration_suite_placeholder_passes_until_a3() -> None:
    assert True
```

A placeholder that passes is invisible to every aggregate metric. Coverage
does not flag it, the suite does not flag it, and the per-module coverage
check the project already mandates does not flag it either — because the gap
is in the *tests*, not the source.

**How to apply:**
- `cat` the files in any `tests/integration/`, `tests/worker/` or similarly
  named directory the gate depends on. Do not infer their contents from the
  fact that they pass.
- Diff the gate's mandatory-test list against actual test names
  (`grep -rh "def test" tests/`). For variants this surfaced that lease
  expiry, worker-dies-after-claim, cancellation-racing-completion and
  asset-write-succeeds-but-DB-commit-fails had no tests at all, while
  fencing/idempotency/restart did.
- Report it as **"engineering done, gate evidence not met"**, not "A*n* is
  false". The distinction matters: the durable storage, leasing and fencing
  work was real and sound. What was missing was evidence, which is a small
  test packet, not a redesign.
- Check whether *dependent* gates actually fall over. Here A4 did not — the
  suite runner exercises the services over real HTTP, which is stronger
  evidence for A4's specific purpose than the missing integration tests would
  have been. Don't cascade a correction further than it reaches.

See also [[feedback-verify-before-ruling]].
