# Ankета principles — consolidated review of the supplied draft

**Status:** working review, **not** an approved/frozen protocol. Source: Claude's supplied `anketa_principles.md` (F1–F8 / C1–C9 / M1–M7) plus subsequent user/GPT critique. Original clause IDs are preserved for cross-review; this document records **proposed amendments**, not a silent claim that Claude approved them.

## §1. Working definition — proposed replacement

An **anketa** is a versioned, provenance-bearing and potentially reversible organization of relationships between objects, actions, observations and results. Its concrete realization may use sparse **cells** carrying `yes/no/U`, and executable **columns** (cuts/questions) applicable across objects or collections.

Ankета is **not necessarily one object = one fixed form**: multiple views, equivalent construction hypotheses, drawer partitions and recursive questionnaires are allowed. A column is an executable test (with scope/version), not merely a word. Human class names reside in a separate explanatory mapping.

`U` means unknown or insufficiently tested; it never silently becomes `no`. A categorical judgment based on tolerance must retain its original numeric/observational evidence where available.

## §2. Benefits (hypotheses to measure)

- **Compression:** a reusable relation may summarize many observations.
- **Cheap reasoning:** queries against relations may avoid repeated geometric fitting, until evidence bounds are insufficient.
- **Unnamed clustering and transfer:** similar anketa responses can induce classes; discovered cuts can be reapplied to new objects.
- **Directed inquiry:** unknown or contradictory cells suggest productive next interventions.
- **Reversibility and auditability:** preserving both drawers plus membership and event log enables reconstruction.
- **Interoperability:** a common relation record can be inspected by neural learner, symbolic reasoner, and human CAD engineer.

These are **testable benefits**, not guarantees: new columns, metadata, or expensive checks could exceed the cost of geometry.

## §3. Flexibility — keep F1–F8, sharpen semantics

- **F1:** open schema; changed executable tests get new versions.
- **F2:** candidate columns may originate from unexpected observations; separate the *seed operator vocabulary* from learned compound columns.
- **F3:** sparse empty cells remain `U`, not `no`.
- **F4:** transferable questions across object/group levels must specify typed inputs and scope; not every test makes sense at every level.
- **F5:** one object may have multiple questionnaires, inner/outer views, and nonunique construction histories.
- **F6:** a cell concerns a relation between object(s), action and context; avoid treating action names as sufficient.
- **F7:** columns can be retired without destroying historical records.
- **F8:** what was testable/available must be represented; untried actions remain unknown.

**Add F9 (proposal):** partition/cut operations must specify whether they preserve complete reconstruction metadata; reversible and lossy abstractions are distinct.

**Add F10 (proposal):** a discovered relation may become a reusable executable cut and may itself be an object of further cuts. Its usefulness is separately checked on unseen data.

## §4. Correctness — keep C1–C9, add caveats

- **C1:** evidence links numerical measurements, uncertainty, test version/hash, data ID and random seed **when applicable** (deterministic analytic facts need not invent a seed or a floating measurement).
- **C2:** `yes/no/U` must be justified by decision rules, noise and tolerance; `U` is not a third truth value in the measured geometry.
- **C3:** separate measured/inferred and store dependency path. Replace hard fixed chain-length `L` as a universal criterion with **uncertainty-aware evidence propagation**; geometric recheck when current bounds are inconclusive. A practical fallback cap may exist but is not a mathematical guarantee.
- **C4:** append-only events with explicit supersession and replay.
- **C5:** four *candidate promotion signals*: rarity against a documented null model, replication on independent cases, nontriviality beyond existing cuts, and utility (description gain, prediction or decision improvement). **Review question:** do not require rarity as an absolute gate for frequently useful laws; avoid treating a zero-frequency estimate as proof.
- **C6:** record contradictions, inspect scopes and tolerances; do not silently reconcile.
- **C7:** freeze metrics, thresholds, test sets and compute budgets before confirmatory runs. Pilots are never included in the primary result.
- **C8:** human names are late and outside the learner's privileged label vocabulary; automatically check leakage.
- **C9:** surprisal `-log p_null` is **one measurable signal**, not the entire value hierarchy. Multiple testing and the selection of the null world matter; rare noise does not establish a useful law.

**Add C10 (proposal):** report irreducible ambiguity and missing information explicitly (e.g. identical geometry with multiple constructive explanations); never force unique historical reconstruction.

## §5. Implementation strategies — keep M1–M7

- **M1:** versioned reliable core and experimental candidate sandbox.
- **M2:** candidate → probation → accepted → retired, with traceable evidence and decisions.
- **M3:** remeasure when schema semantics change; do not silently reinterpret old cells.
- **M4:** cheap relational reasoning first, geometric/numeric validation when the intended decision requires it.
- **M5:** penalize columns which cost memory/compute without information/decision benefit.
- **M6:** choose unknown-cell tests by expected information/utility gain per cost, accounting for uncertainty of estimates.
- **M7:** independent evaluation with separate seeds/generators or an independent referee. Another LLM's opinion alone is not an independent measurement.

**Add M8 (proposal):** support reversible partition/join of objects, columns and evidence while preserving order and provenance where required; contrast to lossy projection.

## §6. Minimal conceptual record (not mandated JSON schema)

- **Event:** `source, operation, result, context, evidence_id, time/order`.
- **Question/column:** `executable_test_ref, version, input_domain, origin, status`.
- **Cell/answer:** `subject_ref, question_ref, yes|no|U, measured|inferred, evidence, scope, tolerance/uncertainty, dependencies`.
- **Partition:** `input_set, cut_ref, groups, membership, provenance, reversibility_flags`.
- **Promotion claim:** references predeclared evidence for rarity (if relevant), replication, novelty and utility.

The structure intentionally separates the *world history*, *current abstraction*, and *audit evidence*. Avoid inventing a raw number for every yes/no (some questions are exact logical statements).

## §7. Extra acceptance tests (in addition to original six)

7. **Reversible drawer:** partition + rejoin reproduces original objects, membership and declared order exactly.
8. **Lossy distinction:** deleting drawer contents fails reconstruction explicitly, not silently.
9. **New executable cut:** create a cut from previously found relations and apply to truly unseen subjects; compare to fixed-cut control.
10. **Inner vs outer:** torus parameter-space periodicity does not get mislabeled as two ambient continuous rigid symmetries.
11. **Approximate transitivity:** near-parallel A~B and B~C do not imply unconditional A~C.
12. **Null-model audit:** selected rare patterns are checked against multiple-test baselines and independent samples.
13. **Unknown remains unknown:** an untried operation cannot be promoted from lack of contradictions.

## §8. Open decisions — do not conceal these as defaults

1. Definition of executable primitive cut and whether arbitrary derived relation evaluators are allowed at birth.
2. Confidence/tolerance propagation and whether a convenience maximum dependency depth is needed.
3. Null worlds for geometry, discrete cards and other domains; candidate search multiple-testing correction.
4. Promotion thresholds, independent seeds and compute budget, preregistered after disjoint pilots.
5. Program-internal vs geometric-ambient representation and which one the learner is allowed to query.
6. How to verify reversible normalization in presence of symmetry/gauge ambiguity.
7. How to formally distinguish a useful new operator from mere recombination of old labels.
8. Separation of GSE-002 exploratory studies from GSE-001 confirmatory comparisons and frozen holdouts.

**Key correction to source draft:** the fixed `L` cutoff and rarity-only hierarchy are *suggested heuristics*, not universal laws. The extra F9/F10/C10/M8 and tests 7–13 are *proposals pending review*.
