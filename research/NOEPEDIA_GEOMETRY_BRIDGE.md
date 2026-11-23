# 3DGabro as Noepedia's geometric experiment polygon

**2026-11-23 · status: DRAFT cross-project architecture alignment**

## Central relationship (do not reverse it)

**[Noepedia](https://github.com/gakelytemp-creator/Noepedia) is the primary, domain-general knowledge/relational/navigation project.** 3DGabro supplies the **geometry, CAD, symmetry, scan reconstruction and edit-response application/test world** for a Noepedia research direction. 3DGabro is not itself the universal knowledge architecture.

The main Noepedia research records to read are:
- [Noepedia current architecture](https://github.com/gakelytemp-creator/Noepedia/blob/main/current/README.md) — authoritative prior current layer until reviewed updates merge.
- [New dated Noepedia conceptual snapshot (PR branch)](https://github.com/gakelytemp-creator/Noepedia/blob/research/anketa-2026-11-23/current/CONCEPTUAL_SNAPSHOT_2026-11-23_ANKETA_NAVIGATION.md).
- [Detailed conversation/context atlas for Claude/GPT](https://github.com/gakelytemp-creator/Noepedia/blob/research/anketa-2026-11-23/research/ANKETA_DIALOGUE_ATLAS_2026-11-23.md).
- [Noepedia–3DGabro handoff](https://github.com/gakelytemp-creator/Noepedia/blob/research/anketa-2026-11-23/research/ANKETA_CROSS_REPO_HANDOFF.md).

**Scope:** this document links and interprets the research; there is currently no deployed, shared live API or automatic sync between these repositories.

## Why 3DGabro is the right polygon

Real scans and synthetic geometric worlds make a relation query independently checkable. In particular:

1. **Observed contacts:** point cloud / mesh / slice traces, with raw source, coordinate frame, noise model, tolerance and provenance.
2. **Interventions:** rotation, translation, reflection, sweep and later geometric CAD/CAD-edit operations.
3. **New observations:** transformed coordinates, local/global invariants, intersection/cross-section results, changed shape/edit response.
4. **Candidate reusable cuts:** shared axis/center/distance, unchanged cross-section, equal pitch, commute/does-not-commute, constructive equivalence, constraint validity.
5. **Geometric referee:** does a candidate relation actually fit unseen measured data? Where do exceptions and uncertainty begin?
6. **Feedback to Noepedia:** evidence-backed objects, relations, counterexamples, unresolved questions, proven reusable executable tests—not a vague claim that a primitive was 'recognized'.

No preinstalled 'cylinder', 'sphere', 'hole' labels in the **learner's initial questionnaire**. These can exist in external generator/referee/human explanation. The domain kernel obviously must define the mathematical transformations it executes; this is not the same as providing the class names as discovery answers.

## Boundary between Noepedia field and geometric data

| Noepedia concern | 3DGabro concern |
|---|---|
| Object/action/result identity; relational addresses | Point clouds, patches, features, geometry files |
| Versioned questions, cuts, links and histories | Exact transformation code and numerical geometry evaluator |
| Evidence provenance, scope, `OPEN`, contradictions | Scanner noise, uncertainty, spatial tolerances, seed and sampling |
| Relationship-based search and rearrangement | Axis/plane/rotation/translation/sweep hypotheses |
| Knowledge candidates transferable to other tasks | CAD construction, edit-response and manufacturing checks |
| Noepedia current architecture precedence | Existing Snark/editor production code and isolated test environments |

Do not import every point of a large cloud into Noepedia SPO as a permanent triplet. Keep bulk geometry as blobs/references; store stable handles and reusable evidence-backed relations.

## Current experimental assets and what they prove

- [GSE-001 protocol #2](https://github.com/gakelytemp-creator/3DGabro/issues/2): autonomous-learning comparison plan; not running.
- [GSE-001 lesson/holdout issue #3](https://github.com/gakelytemp-creator/3DGabro/issues/3): preregistration draft, hidden cases to be committed off-repo before main runs.
- [PR #4](https://github.com/gakelytemp-creator/3DGabro/pull/4): deterministic, in-distribution 16×16×16 toy geometry and 25-candidate search baseline, two metric implementations, **only a smoke test**, not trained discovery. Its catalogue lacks constructive-aliasing pairs that separate geometric fit from semantic edit-response.
- [PR #5](https://github.com/gakelytemp-creator/3DGabro/pull/5): GSE-002 principles and first-cell concept documents, **draft**; they are best interpreted through the more general Noepedia context above.
- [SCAN_PRINCIPLES.md](../SCAN_PRINCIPLES.md): existing real scan symmetry/participation/hypothesis verification work (distinct lineage; do not claim GSE-002 result).

PR #4/#5 were open drafts at the time of review, not merged into main. This bridge is a proposed supplementary PR, not a replacement of GSE-001 protocol.

## Immediate minimum geometry probe

Before adding 20 more F/C/M rules:
- point and segment in 2D/3D under small finite motion families;
- independent-freeedom test (distinguish increased span/extent from new intrinsic dimension);
- order test `g(h(x))` vs `h(g(x))`;
- separate **construction history** and **observed setwise symmetry**, with plane and torus counterexamples;
- record `A, action, B, scope, evidence, tolerance, status`;
- provide a domain-specific oracle independent of learner labels;
- keep points where geometry does not justify a verdict as `U`.

**Experiment is proposed, not yet implemented.** Additional dialogue/navigation cross-domain probes belong under Noepedia's central research plan.

## Instructions for another Claude/GPT session

Read this bridge, then **Noepedia's snapshot and detailed atlas**, then [GSE-002 PR #5](https://github.com/gakelytemp-creator/3DGabro/pull/5) and its review discussion, followed by [GSE-001 PR #4](https://github.com/gakelytemp-creator/3DGabro/pull/4) if code is needed.

Review **conceptual role separation first**, then critique minimal falsifiable experiment. Never promote speculative statements to measured findings; do not silently rewrite Noepedia's dated canonical layers. It is acceptable to reply with a link to a GitHub issue/PR instead of asking the owner to relay long AI-to-AI messages.
