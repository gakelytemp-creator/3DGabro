# First Cell — from relations and interventions to learned cuts

**Status: conceptual research proposal, 2026-11-23.** Human vocabulary below explains the system to engineers; it is **not** a list of labels to inject into the learner.

## 1. The smallest useful event

A source object or collection **A**, an executable action **T**, and an observation/result **B**:

`(A, T, B, context, evidence)`

- `A` may itself be an earlier result, a group of objects, an action, or a questionnaire.
- `T` can be a spatial transformation, a measurement, a query, a filtering/partitioning operation, or composition of previously available operations.
- `B` includes what the action produced **and** where it was observed. Merely changing a coordinate frame is not necessarily changing the shape.
- Reverse question: which candidate `(A,T)` pairs can explain observed `B`? The inverse may be one-to-many, unknown or impossible from available observations. It is distinct from undoing a bijective coordinate transform.
- The event record is append-only and has evidence/provenance; a later reinterpretation does not rewrite history.

**Proposal, not an already established minimum:** initially supply an object interface plus cut/probe, compare, and count. Action execution and finite observation remain necessary implementation primitives. Whether relation predicates must be primitive or can be built by composition is an **experiment**, not an assumption.

## 2. The 'chief accountant's drawer' is an operator

Given a set `X` and a cut/query `q`, partition it into the elements satisfying a criterion and its complement:

`Split(X,q) = (X_yes, X_no, X_unknown; q, membership/provenance)`.

Keeping one partition on the desk and setting aside another can make common relations visible. **Reconstruction** means retaining *every* element and sufficient membership/provenance to rebuild the original; merely discarding entries is not reversible.

A useful cut need not be a single predefined label: it may be a composed, newly learned test. Examples:
- cards: suit equality; rank-order relation; composite suit-and-primality test;
- geometry: shared distance to some candidate center; shared distance to an axis; equal projection on a direction; repeated angular spacing.

Important separation:
1. **partition/abstraction** — expose a property by ignoring others;
2. **canonicalization/normalization** — choose a representative under a specified equivalence relation;
3. **geometric reconstruction** — recover physical coordinates/shapes from stored transformation metadata.

A hidden drawer does *not* automatically implement all three.

## 3. 'Questions grow from answers'

A relation found in one observation can become the **executable question** asked of new objects or groups. Example:
- find a candidate point C and a group of points with approximately equal distance from C;
- save the tested relation, scope, residuals and counterexamples;
- promote its executable test for use on other groups;
- ask whether multiple groups share a center (a higher-order relation).

Avoid hard-coding 'sphere', 'concentric' or 'cylinder' as the learner's initial target vocabulary. Merely inventing a column name is not discovering a relation: an accepted cut must generalize to new observations and help a later query or task.

## 4. Geometric exploration through actions

In generic dimension d, let a shape be a set of states/points `A`; let `g_t` be a family of transformations. The **sweep/orbit** is `B = union_t g_t(A)` over the specified parameter domain.

- A moving point can trace a line; sweeping a segment transversely can generate a surface; analogous higher-dimensional operations require no human 3D visualization.
- A transformation family can *add accessible states* without raising dimension (e.g. a curve translated along itself, or a discrete reflection producing separated copies). Measure intrinsic dimension separately from number of samples.
- A symmetry is a transformation **that preserves the result set** (`g(B)=B`); it is not every operation that helped generate `B`. A finite sweep generally is not invariant under unrestricted translation.
- A motion may fix points, move points inside the same set, or move points outside it. Distinguish pointwise fixed loci from setwise preservation.
- The result has potentially different **intrinsic** dimensions, **ambient** dimensions, **orbit/quotient** dimensions and **pose** degrees of freedom.
- Construction history is not uniquely identifiable from final geometry; more symmetries may lead to equivalent descriptions but do not determine the number of CAD histories.

Two movements are interrogated by comparing `g(h(x))` with `h(g(x))`. A nonzero difference is a learnable relationship, not automatically an error. A derived operator can arise from this relationship.

### Intrinsic versus ambient symmetries

A standard embedded torus admits two periodic **parameters** but ordinarily only one continuous **ambient rigid rotation**. Its construction via two revolutions does not imply two commuting rigid symmetries. A plane generated by two translations may acquire an additional rotational symmetry about the normal. Thus **construction operators and discovered invariances must have separate records**.

An earlier rotation's preservation under later constructions is conditional; even a final partial sweep does not automatically carry the full continuous symmetry. Do not make the rule 'the last motion is always a symmetry' unconditional.

## 5. Scale and pose

An optional engineering adapter normalizes geometry into a chosen common cube, e.g. `[-0.5, 0.5]^3`. Store an invertible mapping for return:

`p_world = R S p_local + t` with nonzero scale components.

- Save `R`, `S`, `t`, coordinate frame, order and relevant ambiguity. For symmetric shapes a unique canonical orientation may not exist.
- Independent per-axis scaling is generally **not** a rigid motion: it can create or destroy Euclidean symmetries. Compare shape under the proper transformation class; do not silently transfer the sphere's rotational symmetries to an ellipsoid.
- Do not enforce 3D normalization as a mandatory ontology. Higher-dimensional work can have its own coordinate adapter.
- A reversible questionnaire partition is a cheaper *possible alternative representation*, not mathematical proof that physical fitting or error estimation is unnecessary.

## 6. Relational cells and cost

A question/test applied to an object(s) can yield `yes`, `no`, or `U` (insufficient evidence). `U` is **not** negative evidence. Each measured or inferred answer refers to evidence and a stated scope/tolerance.

An exact logical relation and its tolerance-qualified approximation are distinct: near-coaxial or near-parallel relations are not necessarily transitive. Instead of an unconditional maximum chain length, propagate uncertainty bounds where possible; trigger numeric/geometric recheck when a desired conclusion cannot be certified from bounds.

The 'cheap accountant' seeks symbolic compression and transfer of reusable relationships before running expensive geometry. But a cheap conclusion must **not** outrun its evidence.

## 7. First experiments — observational, not a rigged recognition exam

1. **Reversibility:** partition a randomly generated collection; reconstruct exactly from all drawers and saved membership/order; distinguish a deliberately lossy variant.
2. **Discovery vs recall:** supply an operator vocabulary without prelabelled shapes; learn a compound cut on development cases and apply it on disjoint generators/seeds without explicit class names.
3. **Geometry:** run point/segment sweeps in 2D, 3D and optionally 4D; measure whether a movement added independent dimension, merely duplicated observations, or preserved the set; include fixed loci and discrete symmetries.
4. **Motion order:** test commuting and noncommuting rotations/translations, plus a torus and plane counterexample to 'history equals symmetries'.
5. **Noise and scope:** compare symbolic relations against geometric referee; include near-parallel chains that invalidate naive transitivity.
6. **Cost:** compare computational work, stored information, predictive/generalization utility, and failures against simple fixed-feature and no-learning baselines.

These are **proposals**. Define exact oracles, null model, budgets, pilot/main separation and frozen acceptance thresholds before any confirmatory evaluation.

## 8. Open questions

- Does the minimal system need a primitive general relation checker, or can cuts/composition/count yield non-equality patterns such as order and periodicity?
- What constitutes an executable new cut, distinct from a restatement of old ones?
- How are canonical representatives chosen without injecting names or losing history/geometry?
- Is the object **itself** an arbitrary graph of events, or a handle to externally supplied observations? How is backward compatibility of schema handled?
- Which movement families and intrinsic/ambient representations are exposed at birth? How is this measured as inductive bias?
- Which claims can be certified cheaply from evidence and which need geometry?
- Under which null distribution is a pattern rare, and how does multiple-testing selection affect surprise?
