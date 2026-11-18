# Snark — mesh with meaning

**Internal standard of 3DGabro · file extension `.snark` · draft 0.1 · 18 November 2026**

> **Status: draft 0.1 — proposed syntax, partly implemented.** The first reference reader and writer is the Snark editor, now Snark_05 ([Snark-Editor/](../../Snark-Editor/README.md)). §16.1 lists exactly what it implements, and §17.3 what was checked. Everything else in this document is design, not tested behaviour. Names and syntax may change until version 1.0.

> *"What I tell you three times is true."*
> — the Bellman, in Lewis Carroll, *The Hunting of the Snark* (1876)

**მოკლედ.** Snark (`.snark`) ჩვეულებრივი OBJ მეშია, რომელსაც თავისი ნაჭრების ზუსტი აღწერა ახლავს: „ეს სიბრტყეა", „ეს ⌀12 ცილინდრია", „ამ წიბოს R1 მომრგვალება აქვს", „ამ წერტილზე ამ პროფილის ბორცვია". ნებისმიერი პროგრამა მას მეშად ხსნის. Snark-ის მცოდნე პროგრამა კი ფორმას ზუსტად აღადგენს იმ სიზუსტით, რაც სჭირდება: ეკრანი უხეშად, ჩარხი წვრილად. ერთ ფაილში ფორმა შეიძლება სამჯერ იყოს ნათქვამი — მეშით, ზუსტი ბარათებით და რეცეპტით (ანკეთით) — და სამივე ერთმანეთს უნდა ეთანხმებოდეს. პირველი რედაქტორი, რომელიც ამ ფორმატს წერს და კითხულობს, Snark_00-ია (ახლა Snark_05: ფიჩერები ბრტყელ ზედაპირებზე, მომრგვალებულ წიბოებზე და სფეროზე, ანიმაციაში ისინი დახეტიალობენ და ერთმანეთს კვეთენ, სხეულების ჭრილიც ჩანს); რა შეუძლია უკვე, §16.1-შია ჩამოთვლილი.

---

## Contents

0. [The name](#0-the-name)
1. [Why Snark](#1-why-snark)
2. [Principles](#2-principles)
3. [Glossary](#3-glossary)
4. [The model](#4-the-model)
5. [Exact surfaces (L1)](#5-exact-surfaces-l1)
6. [Profiles](#6-profiles)
7. [Features (L2)](#7-features-l2)
8. [Combining features](#8-combining-features)
9. [Patterns](#9-patterns)
10. [Freeform: cage and levels (L3)](#10-freeform-cage-and-levels-l3)
11. [Hidden hints](#11-hidden-hints)
12. [Recipe (L4)](#12-recipe-l4)
13. [Agreement and the Boojum](#13-agreement-and-the-boojum)
14. [Text form](#14-text-form)
15. [Binary form](#15-binary-form)
16. [Conformance levels](#16-conformance-levels)
17. [Examples](#17-examples)
18. [Open questions](#18-open-questions)
19. [Relation to other Gabro work](#19-relation-to-other-gabro-work)
20. [History and credits](#20-history-and-credits)

---

## 0. The name

The format is named after Lewis Carroll's poem *The Hunting of the Snark* (1876). A crew sets out to hunt a creature none of them can describe, and the poem has puzzled its readers ever since. Finding the exact shape hidden in a cloud of triangles is the same kind of hunt.

Two things from the poem are used in this standard:

- **The Bellman's rule**, "what I tell you three times is true", is the core principle of the format (§2.3): a Snark file may tell the same shape up to three times, and the tellings must agree.
- **A Boojum** is the dangerous kind of Snark. Here it is a file whose tellings disagree (§13).

The name was proposed by Gakely.

---

## 1. Why Snark

**A machine does not need an exact surface.** A controller moves in steps and a slicer takes a mesh. A mesh whose chord error is below the machine's resolution produces the same part as an exact surface. A ⌀12 hole within 0.001 mm needs 173 segments (§5.4) — a small number.

**What a mesh loses is meaning.** "⌀12 H7", "R3 on this edge", "this boss has that section" are what drawings, inspection and editing need. Machining needs it too: a CAM program that knows a hole is a circle can cut it with arc moves instead of a long chain of short straight moves, which many controllers handle poorly.

**NURBS keeps the meaning but costs a kernel.** Every operation on NURBS solids (Boolean, fillet, offset) needs a large geometric kernel. Few exist and most are commercial (Parasolid, ACIS, Rhino's own); OpenCascade is the main open one. A scan never arrives as NURBS anyway.

**Snark takes a third way.** It keeps the mesh as the body of the file, attaches meaning to it in small exact cards, describes smooth details with profiles instead of triangles, and lets every reader choose its own resolution. Snark is an internal working format of the Gabro projects. STL and STEP remain exchange formats that can be produced from it.

---

## 2. Principles

**2.1 Mesh first.** Every Snark text file is a valid Wavefront OBJ file. A program that knows nothing about Snark opens it and sees a mesh.

**2.2 Meaning is attached, never required.** Exact information lives in cards attached to parts of the mesh. A reader may ignore any card and still has a usable mesh.

**2.3 Three tellings.** A file may tell the shape in up to three ways:

1. **the mesh** — what it looks like;
2. **the exact cards and features** — what it is;
3. **the recipe** — how it was made.

Only the mesh is required. Where more than one telling is present, they must agree within the file's tolerance. A file where they do not is a Boojum (§13).

**2.4 Drawing numbers.** Exact values are the numbers a designer writes on a drawing — ⌀12, R3, 40, 2×45° — not knot vectors or control-point weights. Rotations in the recipe are the one exception in 0.1 (§12).

**2.5 The reader chooses the resolution.** The same file is drawn coarsely on a screen and evaluated finely for a machine.

**2.6 Local and bounded.** Every exact element declares a collision square (§7.1). A reader can tell quickly which elements touch a point, and it may skip an element at first and fill it in later.

**2.7 The detail limit is a human decision.** `detail` (default 1 mm) is the size below which nothing in the part is meaningful. Finer structure is treated as noise: scans are filtered at it, and subdivision levels stop at it.

---

## 3. Glossary

| English | ქართული | Meaning |
|---|---|---|
| mesh | მეში | points and faces with 3 or 4 corners |
| patch | ნაჭერი | a named group of mesh faces (an OBJ group) |
| card | ბარათი, თავსართი | the exact description attached to a patch or element |
| seam | ნაკერი | where two patches meet, optionally with its exact curve |
| host | მასპინძელი ზედაპირი | the patch a feature sits on |
| profile | პროფილი (სპლაინი) | a 2D path of lines, arcs and cubic curves |
| feature | ფიჩერი | a local exact change of the host: point, curve or edge |
| collision square | კოლიზიის კვადრატი | a square that contains everything a feature changes |
| edge rule | წიბოს წესი | how an edge is finished: sharp, round, chamfer, profile |
| blend rule | შერევის წესი | how overlapping features combine |
| pattern | ნიმუში, ბადე | a feature repeated on a lattice |
| envelope | ენველოპი | how a curve feature fades along its length |
| cage | ჩონჩხი, გალია | the coarse mesh of a subdivision surface |
| level | დონე, სიხშირე | one subdivision step with its displacements |
| detail limit | დეტალის ზღვარი | the smallest meaningful size (default 1 mm) |
| tolerance | დაშვება | precision of exact values; allowed disagreement |
| recipe | რეცეპტი, ანკეთა | construction history: primitives and Boolean operations |
| Boojum | ბუჯუმი | a file whose tellings disagree |

---

## 4. The model

### 4.1 Header values

- **Units:** millimetres. **Axes:** right-handed, +Z up — the floor or print bed is the XY plane.
- **`tol`** (default 0.001 mm): the precision of exact values, and the largest allowed disagreement between tellings.
- **`chord`** (informative): the largest distance between the stored mesh and the exact surfaces it approximates — how coarse the mesh is.
- **`detail`** (default 1 mm): the detail limit (§2.7).

### 4.2 Final mesh or base mesh

The header key `mesh` says whether the mesh already contains the whole part.

- **`mesh=final`** (default) — the mesh shows the whole part at the file's resolution, and every card describes what its faces approximate. Programs that know only OBJ see the correct part. Use it for exchange and for scans.
- **`mesh=base`** — the mesh is only the base. Edge rules, features, patterns and subdivision levels add geometry that is not in the mesh: a plate with a boss is 8 points and one profile. A program that knows only OBJ sees only the base. Use it between Snark-aware programs, for example inside a `.gabro` package.

The cards are the same in both modes; the only difference is whether the mesh already contains their result. In a final mesh each feature's faces form a patch of their own, so a reader can remove them and regenerate them exactly — as if a square were cut out of the face and filled from the profile.

### 4.3 Mesh and patches

- Vertices: `v x y z`.
- Faces: 3 or 4 corners (as in LightWave sub-patches), counter-clockwise seen from outside, so normals point out of the material.
- Patches are OBJ groups (`g name`). Every face belongs to exactly one patch.
- The mesh of a closed part is watertight: every edge is shared by exactly two faces, which run along it in opposite directions.

### 4.4 Order of evaluation

For a base mesh, a reader builds the shape in this order:

1. the mesh;
2. the exact surfaces of the patches (§5);
3. subdivision of cages and their levels (§10);
4. edge rules (§7.4);
5. features and patterns, combined by blend rules (§7–9);
6. output at the resolution the reader needs.

For a final mesh the same elements are descriptive. A reader that needs more precision than `chord` regenerates each element's faces from its card.

---

## 5. Exact surfaces (L1)

### 5.1 Patch cards

```
#@patch <group> <type> key=value …
```

| type | keys | meaning |
|---|---|---|
| `plane` | `o=` point, `n=` outward unit normal, `u=` a direction in the plane | flat face |
| `cyl` | `o=` point on the axis, `a=` axis direction, `d=` diameter, `side=out` or `in` | shaft or boss (`out`), hole (`in`) |
| `cone` | `o=`, `a=`, `d=` diameter at `o`, `angle=` included angle in degrees, `side=` | countersink, taper |
| `sph` | `c=` centre, `d=` diameter, `side=`; optional (draft): `a=` the pole and `u=` the direction of longitude 0 | ball or spherical seat; the optional frame places features on it (§5.2) |
| `torus` | `c=` centre, `a=` axis, `R=` radius of the centre circle, `r=` tube radius, `side=` | for example a fillet around the edge of a hole |
| `cage` | — | subdivision cage (§10) |
| `free` | — | no exact description (scanned or freeform without a cage) |

- A cone's diameter at distance t along `a` from `o` is `d + 2·t·tan(angle/2)`.
- The card gives the surface; the patch's faces give its borders.

### 5.2 Host frame

For a `plane` card, `v = n × u`; (u, v, n) is a right-handed frame. Coordinates on a plane are (u, v) in millimetres from `o`. Put `o` at the face's datum corner and the coordinates read like the dimensions of a drawing of that face. Features on a plane are placed in this frame.

For curved hosts the frame is a draft: on a cylinder, the position along the axis and the arc length around it. On a sphere (draft, used by Snark_03): longitude and latitude in degrees, in the frame of its card — `a=` the pole (latitude +90), `u=` the direction of longitude 0, longitude growing towards a × u; without them the file's axes (z the pole, x longitude 0). Cones and tori are open (§18).

### 5.3 Seams

```
#@seam <A> <B> line p0=x,y,z p1=x,y,z
#@seam <A> <B> circle c=x,y,z a=x,y,z d=<diameter>
```

A seam is optional: a reader can intersect two cards itself. A stated seam lets a drawing program dimension it directly and a CAM program cut it as a line or an arc. Seams of other shapes (ellipse, free) are reserved.

### 5.4 Re-tessellation and segment counts

An L1 reader may replace a patch's faces by a finer tessellation of its card, keeping the patch borders on the seams.

A circle of radius R within chord error e needs N segments:

```
N = ceil( π / arccos(1 − e/R) )
```

| circle | e = 0.01 mm | e = 0.001 mm |
|---|---|---|
| ⌀12 (R = 6) | 55 | 173 |
| R = 3 | — | 122 |
| R = 50 | — | 497 |

---

## 6. Profiles

A profile is a 2D path made of lines, arcs and cubic Bézier curves — a section, as it would be drawn on a drawing.

```
#@profile <id> start=x,h <segments…>
```

| segment | syntax | meaning |
|---|---|---|
| line | `L x,h` | straight to (x, h) |
| arc | `A x,h R` | circular arc to (x, h) with radius \|R\|; R > 0 turns counter-clockwise (centre on the left of travel), R < 0 clockwise; the shorter arc, at most 180° |
| cubic | `C x1,h1 x2,h2 x,h` | cubic Bézier to (x, h) with two control points |

**Coordinates.** The first coordinate is the distance from the feature's centre (r, point features) or the signed distance across its path (d, curve features). The second is the height h along the host's normal: positive out of the material, negative into it.

**Rules.**

- The first coordinate never decreases along the path. Vertical pieces (walls) are allowed; undercuts are not, in 0.1.
- The path ends at height 0 with a horizontal tangent: the feature meets the host parallel to it. Sharp corners inside the profile are allowed — they are real edges of the part. (Envelopes, §7.3, are the one exception: they end at height 1.)
- Arcs are exact circles, so the profile's numbers are drawing numbers.

**Example.** A boss ⌀10 × 4 with R2 at the top and R1 at the foot:

```
#@profile boss start=0,4 L 3,4 A 5,2 -2 L 5,1 A 6,0 1
```

Read it from the centre outward: a flat top to r = 3, an R2 rounding down to the wall at r = 5, the wall down to h = 1, an R1 fillet out to (6, 0), where it meets the host parallel to it. Every joint in this profile is tangent.

---

## 7. Features (L2)

### 7.1 Collision square

Every feature has a square on its host, aligned with (u, v), that contains everything the feature changes:

- point feature: side 2R around the centre, where R is the profile's last r;
- curve feature: the path's bounding box grown by the profile's width;
- pattern: the region grown by the template's R.

A reader uses the squares to find quickly which features can touch a point. It may first draw the host without a square and fill the square later. The square itself is never part of the shape.

### 7.2 Point feature

```
#@feature <id> point host=<patch> at=u,v profile=<pid> [blend=<rule>]
```

- r is the distance from the centre, measured along the host (on a plane, in its (u, v) frame; on a sphere and over an edge Snark_03 measures it through space, §7.5).
- The height is h = P(r) for r ≤ R, and 0 outside. The surface point is the host point plus h along the host's normal.
- Because the profile ends at h = 0 with a horizontal tangent, the feature meets the host without a step or a crease.
- The centre is free. Horizontal there gives a dome or a plateau; sloped gives a cone tip (a spike); rising and then falling gives a crater ("volcano").
- The profile may go up (boss, bump) or down (dimple, hollow).

### 7.3 Curve feature

```
#@curve <cid> [closed] start=u,v <segments…>
#@feature <id> curve host=<patch> path=<cid> profile=<pid> [cap=round|env:<pid>] [blend=<rule>]
```

The path lies on the host in (u, v) and uses the same segments as profiles. A closed path ends exactly where it starts.

- **Distance.** d is the distance from a point to the nearest point of the path, measured on the host. It is negative on the left of the direction of travel and positive on the right. For a counter-clockwise closed path, left is inside.
- **Section.** The profile runs from its left end (most negative d) to its right end, and h = P(d).
- **Right end:** height 0, horizontal.
- **Left end:** horizontal. For an open path it is also at height 0 — a ridge, a groove or a bead. For a closed path it may be at any height h_in: everything inside the path farther than the profile's left width gets h_in. The result is a raised plateau (a boss of any outline) or a sunken floor (a pocket), and its wall has exactly the profile's shape: vertical, drafted, rounded at top or bottom.
- **Corners.** Because d is the distance to the *nearest* point of the path, the feature behaves like a cutting tool. Around a convex corner of the path the section turns round. In a concave corner the two sides meet in a crease along the bisector, as a tool cannot enter a sharp inside corner.
- **Ends of an open path.** `cap=round` (default): beyond each end, d is the distance to the end point, which gives a round end. This requires a symmetric profile, P(−d) = P(d). `cap=env:<pid>`: an envelope e(t) multiplies the height along the path, where t is the distance from the nearer end, measured along the path. An envelope profile starts at (0, 0), ends at (T, 1), has horizontal tangents at both ends, and e = 1 beyond T.

**Example: a pocket of any outline.** A 30 × 20 pocket with R5 corners in plan, 5 deep, with an R1 fillet at the floor and a sharp top edge:

```
#@profile pocketwall start=-2,-5 L -1,-5 A 0,-4 1 L 0,0 L 0.5,0
#@curve outline closed start=10,5 L 30,5 A 35,10 5 L 35,20 A 30,25 5 L 10,25 A 5,20 5 L 5,10 A 10,5 5
#@feature pocket1 curve host=top path=outline profile=pocketwall
```

The wall stands exactly on the path (d = 0). Inside, farther than 2 mm from it, the floor is at −5.

### 7.4 Edge rules

```
#@edge <A> <B> <rule>          the seam between patches A and B
edge=<rule>                    in the header: the default for every real edge
```

**Real edges.** A real edge is a seam between two different patches. In a mesh without cards, it is an edge whose two faces differ by more than `edge_angle` (default 30°). Edges inside one patch — for example between the facets of a tessellated cylinder — are never rounded.

| rule | meaning |
|---|---|
| `sharp` | the default |
| `round:R` | circular arc of radius R tangent to both faces ("rolling ball") |
| `chamfer:a[,b]` | straight cut with setback a on the first patch and b on the second (b = a if omitted); `chamfer:2` on a right-angled edge is 2×45° |
| `profile:<pid>` | custom section in the edge frame: origin on the edge, first coordinate along the first patch away from the edge, second along its outward normal; the path starts on the first patch (h = 0) and ends on the line of the second |

For `round:R`, the setback from the edge on each face is

```
t = R / tan(α/2)        α = angle between the two faces, measured inside the material
```

At α = 90° the setback is R; at 120° it is 0.577·R; at 60° it is 1.732·R. A rounded convex edge loses material; a rounded concave edge gains it (a fillet).

**Corners.** Where edges with non-sharp rules meet at a vertex, a corner surface is needed. Version 0.1 defines one case (draft; implemented in Snark_00):

- **Three planes at right angles, one rule.** Some or all of the three edges carry one rule; the rest are sharp. The rule is `round`, `chamfer` or `profile`, with the same setback t on both faces and a section symmetric about the bisector.
- **Unit corner cell.** Near the vertex, measure each coordinate from the plane at depth t inside its face, in units of t: 0 on that plane, 1 on the face. A section A(s) = (a(s), b(s)) runs from (1, 0) on its first face to (0, 1) on its second. A sharp edge uses the square path (1, 0) → (1, 1) → (0, 1).
- **The product.** Call axis 3 the edge whose state (rule or sharp) differs from the other two; if all three are the same, any edge. Let A be the section of the edge along axis 3 and B the section of the other two. In coordinates along axes 1, 2 and 3, the corner surface is

  ```
  P(u, w) = ( a(u)·b₁(w),  b(u)·b₁(w),  b₂(w) )        B(w) = (b₁(w), b₂(w))
  ```

  It meets every edge surface along the edge's own section, so the seams close exactly, and it is smooth wherever the sections are.
- **What it gives.** For `round:R` the corner is exactly a sphere of radius R touching the three faces: a box with `edge=round:1` has 12 quarter-cylinders R1 and 8 spherical corners R1. For `chamfer` it is one flat triangle, a vertex chamfer (open question, §18). Two edges with the rule and one sharp edge give a mitre; a single edge with the rule ends in a flat corner.

Every other corner is open (§18): until then, a reader must make a smooth patch inside the corner and mark it as approximate.

### 7.5 Features across an edge (draft)

A feature whose collision square crosses an edge of its host continues onto the neighbouring patch, like a sticker pressed over the edge of a box: r (or d) is measured along the surface, across the edge and its rounding. Whether the distance should be measured along the surface or straight through space is open (§18).

**Snark_03 (18 November 2026)** draws such features, and features on spheres. It measures r straight through space, |p − c|, where c is the feature's centre on the present surface: on a plane that is the r of §7.2; over a rounding or on a sphere it is a little shorter than the distance along the surface — on a sphere of radius 20 a feature of R 8 comes out about 0.7 % wider. Gakely accepted this for now ("one percent is nothing"); question 1 of §18 stays open. The height is laid along the normal of the surface under each point. Where that normal turns more than 90° away from the normal at the centre, the height fades out, so a feature cannot print through a thin body to its other side. A feature keeps its place (its point of the sharp face) and its size when the rounding under it grows.

---

## 8. Combining features

Where the collision squares of two features overlap, their heights must be combined.

### 8.1 Weights

At every point, each feature has an inwardness t: 0 at its border, 1 at its centre.

- point feature: t = 1 − r/R;
- curve feature: t = 1 − |d|/W, where W is the profile's width on that side; t = 1 on the plateau of a closed path.

The weight is w = φ_s(t), with

```
φ_s(t) = (1 − s)·t + s·(6t⁵ − 15t⁴ + 10t³)
```

The sharpness s runs from 0 to 1. With s = 0 the weights are linear, and a deliberate crease shows where two features meet. With s = 1 the weights have zero slope at both ends, and the blend adds no crease.

### 8.2 Rules

The rule is set per feature (`blend=`) or for the whole file in the header. The default is `mix:1`.

| rule | effect | use |
|---|---|---|
| `sum` | heights add | waves, relief, independent small features |
| `mix:s` | each feature gives way to the other gradually; neither grows | two features merging into one form |
| `max:k` | union of two raised features, with a rounded valley between them | bosses growing into one body |
| `min:k` | the same for two pockets | pockets |

```
sum:    h = h₁ + h₂
mix:    h = (w₁·h₁ + w₂·h₂) / (w₁ + w₂)
max:    h = max(h₁, h₂) + max(0, k′ − |h₁ − h₂|)² / (4·k′)
min:    h = −max(−h₁, −h₂) with the same rounding
        where k′ = k · 4·w₁·w₂ / (w₁ + w₂)²
```

- `sum` is always smooth, because every profile ends at height 0 with a horizontal tangent.
- In `max` and `min`, k is in millimetres of height: the valley between two bosses fills by at most k/4. k = 0 gives a sharp union. The factor in k′ makes the rounding full where the two features are equally strong and fade out where either one ends, so the result joins each feature continuously.
- `max` is only for features with h ≥ 0 everywhere, and `min` only for h ≤ 0. Features that go both up and down combine with `sum` or `mix`.

These rules replaced an earlier idea of storing a third "intersection profile" wherever two features meet: the weights give the same control with nothing extra stored.

**What was checked.** In a throwaway numerical test on two overlapping domes (not a reader): `sum`, `mix:1` and `max:k` join each dome without jumps or slope breaks at the edges of the overlap, and `mix:0` shows the expected crease there. With k = 0 the slope breaks by about 1.5–1.8 where the domes cross; k = 0.5 brings that below 0.04. Snark_02 found one place that test missed: at the two points where the borders of the two features cross, `max:k` and `min:k` jump by k/4 (§18, question 14).

### 8.3 More than two features

`sum` and `mix` extend directly: sum over all features. `max` and `min` are applied in file order, with the combined part taking the largest weight of its members (draft).

---

## 9. Patterns

```
#@feature <tid> point template profile=<pid>
#@pattern <id> host=<patch> feature=<tid> lattice=… region=… [fade=w] [blend=<rule>]
```

A template is a feature written with the word `template` and no position. It is not drawn by itself.

- **`lattice=rect a=au,av b=bu,bv origin=u,v`** — copies at origin + i·a + j·b for all integers i, j. This covers square, rectangular, hexagonal (b at 60° to a) and oblique lattices.
- **`lattice=polar c=u,v n=<count> rad=<radius> [phase=<degrees>]`** — n copies on a circle, as on a bolt circle. On a sphere (draft, Snark_03): `c=lon,lat`; the copies lie at the distance `rad` from c, measured through space, the first one `phase` degrees from north (at a pole: from the frame's longitude 0), turning counter-clockwise seen from outside. `rect` lattices are not defined on a sphere.
- **`region=all | rect:u0,v0,u1,v1 | curve:<cid>`** — copies whose whole collision square lies inside the region are made; the others are not. `all` is the whole host patch: when its edges are rounded, copies near them go over the rounding (§7.5).
- **`fade=w`** — instead of dropping partial copies, heights are multiplied by φ₁(distance to the region's border / w), so the pattern fades out smoothly toward the border.
- **`grow=`** — draft: the amplitude or size of the copies changes linearly across the region.

A pattern is like a bump map, but its shape is real — the machine cuts it — and exact at any resolution. The file size does not depend on the number of copies. A reader finds the copies near a point directly from the lattice, by inverting the lattice basis, and checks only the copies whose squares contain the point.

Uses: knurling, anti-slip fields, fields of dimples, ribs and fins (with curve templates), textured faces. Common slicers offer only random texture ("fuzzy skin"), not a defined, repeatable one.

---

## 10. Freeform: cage and levels (L3)

*Draft.* This part is for shapes that are not made of primitives: car bodies, faces, sculpted handles.

### 10.1 Cage

```
#@patch <name> cage
```

The faces of the patch (3 or 4 corners) are the control cage of a Catmull–Clark subdivision surface, like a LightWave sub-patch. Each step splits every face into quads and moves the points toward the average of their neighbours. The limit is a smooth surface lying close to the cage — "a balloon inflated inside the cage". In regular regions, where every vertex has 4 neighbours, the limit is exactly a bicubic B-spline surface. So a cage converts to NURBS without loss everywhere except near irregular vertices.

### 10.2 Creases

```
#@crease <patch> <v1> <v2> [levels=k]
```

The cage edge between vertices v1 and v2 stays sharp — for k steps only, if `levels` is given (a semi-sharp edge).

### 10.3 Levels

```
#@level <patch> <k> <i>:<δ> <i>:<δ> …
```

After subdivision step k, vertex i moves by δ millimetres along its normal. Only |δ| > tol is listed.

The levels are frequencies: low levels carry the overall form, high levels the details, like the coefficients of a Fourier series. A writer stops at the first level whose edges are shorter than `detail`/2 — the detail limit acts as the cut-off frequency. Flat regions carry no level data, so detail is stored only where it exists.

**Vertex numbering at level k** (draft): the vertices of level k − 1 keep their numbers; then one new vertex per edge, in the order the edges first appear when the faces are walked in order and each face's edges in order; then one new vertex per face, in face order. This order, and which normal δ is measured along, will be frozen together with the reference reader.

---

## 11. Hidden hints

Programs that strip comments — for example re-saving the file in another editor — lose the cards. A circle can still survive in the geometry itself.

- **Circle.** A closed loop of N mesh vertices is read as a circle of radius R when N is a power of two and at least 32, and the vertices lie in one plane, all at distance R from their centre, at equal angular steps (all within `tol`). The vertices lie on the circle.
- **Cylinder.** A band of quads (or pairs of triangles) between two such loops with a common axis is read as a cylinder of diameter 2R. Opposite lateral edges are exactly 2R apart.

Powers of two from 32 are used because real parts often contain hexagons (nuts), octagons and other small even counts, while regular 32-, 64- or 128-gons almost never occur. A hint is a proposal — in 3DGabro it is shown to a person for confirmation — never a fact.

| N | chord error | for ⌀12 |
|---|---|---|
| 32 | 0.0048·R | 0.029 mm |
| 64 | 0.0012·R | 0.0072 mm |
| 128 | 0.0003·R | 0.0018 mm |

The hole in example 2 (§17) is such a 32-gon.

---

## 12. Recipe (L4)

The recipe tells how the part was built, as recorded by the Cripp editor in its ანკეთა.

```
#@recipe 1 solid box x=60 y=40 z=10 p=30,20,5 name="plate"
#@recipe 2 cut of=1 cyl d=12 h=12 p=0,0,0 name="hole"
```

- **`solid`** — a primitive placed in the world: `box x= y= z=` (centred), `cyl d= h=` (axis along local Z, centred) or `sph d=`. `p=` is the centre; `q=` is the rotation as a quaternion x,y,z,w (omitted means no rotation).
- **`cut` / `int`** — a tool applied to the target `of=<id>`. Its `p` and `q` are in the target's own frame, so it moves with the target. Operations apply in line order, and a tool is used up.
- **`group=<g>`** — members of a group move together. Groups never change the shape.
- At the end, all solids are united.

The recipe is descriptive: it is never applied on top of the mesh. A reader with a Boolean engine can rebuild the part from it and compare (§13). Quaternions break principle 2.4: they store Cripp's rotations exactly. An angle form is an open question.

---

## 13. Agreement and the Boojum

**Mesh against cards.** Every vertex of a patch must lie on the patch's surface within `tol`. Faces may deviate from it by up to `chord`.

**Cards against recipe.** A reader rebuilds the part from the recipe and compares it with the cards, within `tol`.

**The Boojum.** A reader that finds a disagreement reports a Boojum: the elements involved and the largest deviation. It never silently picks one telling. If it must continue anyway:

- for `source=design`, trust the recipe, then the cards, then the mesh;
- for `source=scan`, the mesh is the measurement and the cards are recognition hypotheses — trust the mesh.

Errors that are not disagreements — unknown references, a profile breaking the rules of §6 — make the file invalid.

---

## 14. Text form

### 14.1 File identity

The first line is `#@snark <version>` followed by header keys. Readers recognise a Snark file by this line, not by its extension.

The extension is `.snark`. Because the content is OBJ, a file can be renamed to `.obj` to open it in programs that know only OBJ.

### 14.2 Lines

- Lines starting with `#@` are Snark directives. Ordinary comments (`# `) are for people. OBJ readers ignore both.
- A line starting with `#@+` continues the previous directive (for long profiles, curves and level lists).
- Directives may appear anywhere after the first line and may refer to ids defined later.
- **Preamble and notes.** The ordinary comments directly under the first line (and `#@meta`) are the preamble: they describe the whole file. The preamble ends at the first blank line or the first other line. Any other comment is the note of the next element (`v` lines in between do not count); a blank line in between detaches it.

### 14.3 Tokens

- Tokens are separated by spaces; keyed values are `key=value`.
- Vectors are comma-separated without spaces: `n=0,0,1`.
- Text is in double quotes, UTF-8; Georgian names are allowed: `name="ფირფიტა"`.
- Decimal point: `.`. Ids: letters, digits, `_` and `-`. Patch ids are OBJ group names.
- Faces may use any OBJ form (`f 1/2/3 …`); readers take the vertex index.

### 14.4 Header keys

| key | values | default | meaning |
|---|---|---|---|
| (version) | `0.1` | — | first token after `#@snark` |
| `units` | `mm` | `mm` | only millimetres in 0.1 |
| `up` | `z` | `z` | the up axis |
| `tol` | mm | 0.001 | precision of exact values; allowed disagreement |
| `chord` | mm | — | informative: how far the mesh may lie from the exact surfaces |
| `detail` | mm | 1 | detail limit |
| `mesh` | `final`, `base` | `final` | whether the mesh already contains everything (§4.2) |
| `source` | `design`, `scan` | `design` | which telling to trust first (§13) |
| `uses` | list of `L1`…`L4` | — | conformance levels the file needs (§16) |
| `edge` | edge rule | `sharp` | default rule for every real edge (§7.4) |
| `edge_angle` | degrees | 30 | real-edge threshold for meshes without cards |
| `blend` | blend rule | `mix:1` | default blend rule (§8) |

`#@meta key="text" …` carries free metadata: title, author, tool, date.

### 14.5 Directives

| directive | syntax | § |
|---|---|---|
| `#@snark` | `#@snark 0.1 key=value …` — first line only | 14.1 |
| `#@meta` | `#@meta key="text" …` | 14.4 |
| `#@patch` | `#@patch <group> <type> key=value …` | 5.1 |
| `#@seam` | `#@seam <A> <B> line p0= p1=` · `circle c= a= d=` | 5.3 |
| `#@edge` | `#@edge <A> <B> <rule>` | 7.4 |
| `#@profile` | `#@profile <id> start=x,h <segments>` | 6 |
| `#@curve` | `#@curve <id> [closed] start=u,v <segments>` | 7.3 |
| `#@feature` | `#@feature <id> point\|curve [template] host= at=\|path= profile= [cap=] [blend=]` | 7 |
| `#@pattern` | `#@pattern <id> host= feature= lattice= … region= [fade=] [blend=]` | 9 |
| `#@crease` | `#@crease <patch> <v1> <v2> [levels=k]` | 10.2 |
| `#@level` | `#@level <patch> <k> <i>:<δ> …` | 10.3 |
| `#@recipe` | `#@recipe <id> solid\|cut\|int <primitive> … [of=] [group=] [name=]` | 12 |
| `#@+` | continuation of the previous directive | 14.2 |

### 14.6 Up axis

OBJ has no fixed up axis, and programs guess differently. If a program shows the part lying on its side, choose "Z up" in its import options.

### 14.7 Order of a written file (recommended)

Readers accept any order (§14.2). Writers are asked to put first what the shape is, then the mesh:

1. the first line, `#@meta`, the preamble, a blank line;
2. `#@recipe`, then `#@profile` and `#@edge`, then the other directives, a blank line;
3. the mesh, one body after another: the body's `v` lines, then its patches (`g`, `#@patch`, `f`).

OBJ numbers points in the order they appear, so the file stays plain OBJ, and a person reading it sees the meaning before the numbers. Snark_00 writes this order.

---

## 15. Binary form

Reserved. It is planned inside `.gabro` packages (Gabro-CNC-Controller, `spec/GABRO_PACKAGE.md`), with the mesh in binary arrays and the same directives. Not defined in 0.1.

---

## 16. Conformance levels

| level | a reader understands | a writer may use it for |
|---|---|---|
| L0 | OBJ only | the mesh |
| L1 | patch cards, seams, re-tessellation, hidden hints | analytic surfaces |
| L2 | profiles, point and curve features, edge rules, blends, patterns | local exact detail |
| L3 | cages, creases, levels | freeform |
| L4 | the recipe | construction history |

The header key `uses` lists the levels a file needs. A reader that lacks one still uses the rest, and says what it skipped.

Planned implementation order: L1, edge rules and point features on planes first (done in Snark_02; over edges and on spheres in Snark_03); curve features on planes next.

### 16.1 What the Snark editor implements (Snark_03, 18 November 2026)

| level | read and kept | built and drawn | written |
|---|---|---|---|
| L0 | points, faces, groups | the stored mesh (view "plain OBJ program") | yes |
| L1 | every card; seams kept as written | whole boxes (6 `plane` cards), cylinders (2 `plane` + `cyl`) and spheres (`sph`), rebuilt from the cards at any precision; any other body as its stored mesh | `plane`, `cyl`, `sph` (with its frame `a=`, `u=` when features sit on it); the final export adds `torus`, `cone` and `free` |
| L2 | edge rules, profiles, features, templates, patterns, curves | edge rules on boxes (12 edges) and cylinders (2 rims): one symmetric rule per body, corners by the product (§7.4); point features on box faces, cylinder caps and spheres, with `rect` and `polar` patterns (`region=all` or `rect`; on a sphere `polar` only) and the four blend rules (`max` and `min` with the change proposed in §18, question 14). Features inside a flat part are drawn exactly (rings that follow the profile); a body with a feature over a rounding, or on a sphere, is drawn as one grid laid over its whole surface, with r measured through space (§7.5). Curve features, `fade=`, `grow=` and `region=curve` are kept, not drawn | edge rules, profiles, point features, templates and patterns |
| L3 | kept as written | — | kept |
| L4 | `solid`, `cut`, `int` | `solid` steps compared with the cards; `cut` and `int` are not built (no Boolean engine) | `solid` steps |

The checks of §13 work as written: points against cards, and recipe solids against cards. Each solid step is paired with the nearest body of its kind; a disagreement is reported as a Boojum, and then the recipe is followed for `source=design`, the cards and the mesh for `source=scan`. Hidden hints (§11) and re-tessellation of stored meshes are not implemented. "Export for other programs" writes `mesh=final`: the evaluated faces with their cards, where the cards are exact.

---

## 17. Examples

### 17.1 `examples/plate_bump.snark` — base mesh

A 60 × 40 × 10 plate with all edges R1, a boss, a groove and twelve dimples. The whole file:

```
#@snark 0.1 units=mm up=z tol=0.001 detail=1 mesh=base source=design uses=L1,L2 edge=round:1 blend=mix:1
#@meta title="Plate with a boss, a groove and a field of dimples" made_by="hand" date="2026-11-18"
# Snark example 1 (standard draft 0.1). Base mesh: 8 points and 6 faces.
# Everything else - the R1 edges, the boss, the groove, the 12 dimples - is generated by a Snark reader.
# A plain OBJ program shows only the sharp 60 x 40 x 10 block.
v 0 0 0
v 60 0 0
v 60 40 0
v 0 40 0
v 0 0 10
v 60 0 10
v 60 40 10
v 0 40 10
g bottom
#@patch bottom plane o=0,0,0 n=0,0,-1 u=1,0,0
f 1 4 3 2
g top
#@patch top plane o=0,0,10 n=0,0,1 u=1,0,0
f 5 6 7 8
g front
#@patch front plane o=0,0,0 n=0,-1,0 u=1,0,0
f 1 2 6 5
g right
#@patch right plane o=60,0,0 n=1,0,0 u=0,1,0
f 2 3 7 6
g back
#@patch back plane o=60,40,0 n=0,1,0 u=-1,0,0
f 3 4 8 7
g left
#@patch left plane o=0,40,0 n=-1,0,0 u=0,-1,0
f 4 1 5 8
# Boss: diameter 10, height 4, R2 on top, R1 fillet at the foot.
#@profile boss start=0,4 L 3,4 A 5,2 -2 L 5,1 A 6,0 1
#@feature boss1 point host=top at=18,20 profile=boss
# Groove: 3 wide, 0.5 deep, smooth bottom, along a straight line with round ends.
#@profile groove start=-1.5,0 C -0.75,0 -0.75,-0.5 0,-0.5 C 0.75,-0.5 0.75,0 1.5,0
#@curve line1 start=4,6 L 26,6
#@feature groove1 curve host=top path=line1 profile=groove cap=round
# Dimples: diameter 5, depth 0.8, on a hexagonal lattice with 7 mm pitch.
#@profile dimple start=0,-0.8 C 1,-0.8 1.5,0 2.5,0
#@feature dimple1 point template profile=dimple
#@pattern field host=top feature=dimple1 lattice=rect a=7,0 b=3.5,6.0622 origin=34.5,8.5 region=rect:32,6,56,34
```

### 17.2 `examples/plate_hole.snark` — final mesh, three tellings

The same plate, without the decoration, with a ⌀12 through hole: 136 points, 148 faces. The hole is a 32-gon with its vertices on the exact circle. The file has 7 patch cards, 14 seams and a recipe of two steps, so the shape is told three times. Its beginning and end:

```
#@snark 0.1 units=mm up=z tol=0.001 chord=0.029 detail=1 mesh=final source=design uses=L1,L4
#@meta title="Plate 60 x 40 x 10 with a through hole d12" made_by="script" date="2026-11-18"
v 35.9711 20.5881 10
…
g hole
#@patch hole cyl o=30,20,0 a=0,0,1 d=12 side=in
f 33 1 2 34
…
#@seam top hole circle c=30,20,10 a=0,0,1 d=12
#@seam bottom hole circle c=30,20,0 a=0,0,1 d=12
#@seam top front line p0=0,0,10 p1=60,0,10
…
#@recipe 1 solid box x=60 y=40 z=10 p=30,20,5 name="plate"
#@recipe 2 cut of=1 cyl d=12 h=12 p=0,0,0 name="hole"
```

### 17.3 What was checked

Both files were checked by throwaway scripts that are not part of the standard:

- three.js `OBJLoader` reads both as plain OBJ, keeps every patch as its own group and ignores the directives;
- both meshes are closed and consistently oriented;
- volumes: 24000 mm³ for example 1, and 22876.28 mm³ for example 2 (an exact circle would give 22869.03 mm³ — the difference is the 32-gon's chord);
- every vertex lies on its patch card within `tol` (largest deviation 0.00005 mm, on the cylinder), and every face normal points the way the card says;
- every seam passes through the vertices its two patches share, and the hole's rim is readable as a hidden circle hint;
- every profile follows the rules of §6, and the dimple pattern gives 12 copies that do not overlap;
- the pocket example of §7.3 follows the rules, and its outline is closed and counter-clockwise.

**Since then (Snark_00, 18 November 2026):** both files open in Snark_00, which reads them and writes them back unchanged on the second pass. The 60 × 40 × 10 block of example 1 is recognised, and its R1 edges are drawn: 12 quarter-cylinders and 8 spherical corners, closed. Example 2 is shown as its stored mesh. The tests of Snark_00 are listed in [Snark-Editor/README.md](../../Snark-Editor/README.md).

**Since Snark_02 (18 November 2026):** the boss and the twelve dimples of example 1 are drawn, and the surface is closed; both can be edited and are written back as they were read. The groove (a curve feature) is not drawn yet.

---

## 18. Open questions

1. **Wrapping over edges:** measure the distance along the surface, or straight through space (§7.5)? Snark_03 measures through space for now.
2. **Corners:** §7.4 now covers three planes at right angles with one symmetric rule. Open: other angles, different rules meeting, unequal setbacks, profiles that are not symmetric — and for `chamfer`, whether three chamfers meet in a small triangle (as in Snark_00) or the three planes meet at a point (as in most CAD programs).
3. **Curved hosts:** the frame and the distance on cones, spheres and tori; what happens when a negative height is deeper than the host's radius of curvature (the offset folds). For spheres a frame is proposed in §5.2 and used by Snark_03.
4. **Undercuts:** profiles whose first coordinate goes back — needed, or left to the recipe?
5. **Steps on open curves:** a left end not at height 0 — needed?
6. **Envelopes:** do they change only the height, or the width too?
7. **Curve templates in patterns:** exact placement rules for fields of short grooves or fins.
8. **Subdivision levels:** the exact vertex order and the normal along which δ is measured (§10.3).
9. **A designed part whose recipe and cards disagree:** answered for readers — it is a Boojum, it is reported, and the recipe is followed (§13; Snark_00 does this). Still open: how to pair recipe steps with bodies in general (Snark_00 takes the nearest body of the same kind), and how to follow a step that turns a body differently from its cards.
10. **Seams** other than lines and circles: parameters for ellipses and free curves.
11. **Rotations in the recipe** in angle form.
12. **Tolerance classes** (H7, h6…) on cards — probably a card key such as `fit=H7`.
13. **The binary layout** inside `.gabro`.
14. **Rounding in `max` and `min` where two borders cross** (§8.2). The factor 4·w₁·w₂/(w₁ + w₂)² depends only on the ratio of the weights. At the two points where the borders of two features cross, both weights go to zero together with ratio 1, so k′ stays k there and the surface jumps by k/4 (0.125 mm with `max:0.5` on two domes R3 h2; found by Snark_02, where it showed as dark streaks). Proposal, used by Snark_02: k′ = k · 4·w₁·w₂ / (w₁ + w₂)² · s / (s + k/4), with s = |h₁| + |h₂|. The rounding then fades with the heights: no step, smooth at the crossing points, and where the features are much taller than k it is the k′ above (0.94 of it in the valley between the two test domes).

---

## 19. Relation to other Gabro work

- **Snark editor** (Snark_00 … Snark_05, [Snark-Editor/](../../Snark-Editor/README.md)): the first reference reader and writer of this draft (§16.1), and a bench for trying Snark bodies.
- **Cripp editor:** writes recipes (its ანკეთა) and cards. Its Boolean engine already knows which triangle came from which primitive, so the patches come for free.
- **3DGabro scan to drawing** ([SCAN_TO_DRAWING.md](../../SCAN_TO_DRAWING.md)): writes the scan as a final mesh filtered at `detail`, recognised planes and cylinders as cards, and profiles from slice analysis — all as hypotheses for a person to confirm.
- **Gabro-CNC-Controller:** its compiler can read circles and arcs from the cards and turn them into arc moves instead of chains of short lines.
- **2D drawings for laser cutting** (DXF, CorelDRAW): a contour plus one section profile is a curve feature — the bridge from a 2D outline to a 2.5D part.
- **STEP and NURBS:** planes, cylinders, cones, spheres, tori, arcs, revolved profiles and regular cage regions convert exactly. Blends, and sweeps along free curves, convert only approximately.

---

## 20. History and credits

**17–18 November 2026.** The concept was worked out in a conversation between Gakely and Claude.

**Ideas by Gakely:**

- keep the mesh and attach small exact headers to its pieces, instead of converting it to NURBS;
- hide a circle in the number of facets, so that the distance between opposite edges gives the diameter;
- round all edges with one general parameter and let the slicer do the work;
- a detail limit that a person sets before processing, 1 mm by default;
- the balloon inflated inside a cage (LightWave sub-patch), with detail added by frequencies;
- a point on a polygon with an attached profile that starts parallel to the surface; a free centre (spike, plateau or crater); a square that a reader may skip and fill later;
- weights instead of a third profile where two features meet — smooth, or deliberately creased;
- patterns like bump maps, but made with profiles;
- a profile running along a curve, starting and ending at different heights, with an envelope along the curve;
- rounding any mesh by attaching profiles to its edges;
- parametric surfaces as hosts;
- the name.

**Formalisation by Claude:** the three tellings and the Boojum check, formulas and blend rules, collision rules, syntax, conformance levels, the examples and their checks.

**18 November 2026, Snark_00.** Gakely asked for a bench to try Snark bodies: the scene and colours of EDITOR_35, a cube, a cylinder and a sphere whose edges are rounded by a spline, the write and read mechanism, the file kept in memory and its display. He tested it the same day. The word for setback, „უკან დახევა", is his. Claude built it, with the product rule for corners (§7.4), the recommended file order (§14.7) and the tests.

**18 November 2026, Snark_01 and Snark_02.** Gakely asked for an animation to show a friend — the bodies turning slowly while the setback runs from 1 to 20 mm and back — and then for features. Snark_02 draws point features with their patterns and blend rules (§7.2, §8, §9), and makes them breathe in the animation. Building it showed that `max` and `min` jump at the points where two borders cross (§18, question 14).

**18 November 2026, Snark_03.** Gakely asked that the features keep their size however much the edges soften, and that the cylinder's boss be put in many places on the cube and the sphere, with smaller and bigger features of other kinds. That needed features over a rounding (§7.5) and on a sphere (§5.2, §9). Asked how to measure r there — along the surface or through space — he answered that one percent does not matter; Snark_03 measures through space.

**18 November 2026, Snark_04.** Gakely asked that the features move chaotically and cross each other. In the animation of Snark_04 every copy wanders over its body and passes through the others; where they overlap, the blend rules of §8 combine them, so the animation also shows those rules at work. Nothing in the format changed.

**18 November 2026, Snark_05.** Gakely asked to see the bodies with their features in section. Snark_05 cuts the picture with a plane and hatches the cut faces; the section is still taken from the meshes, not yet from the exact description as a slicer would want it. Nothing in the format changed.

| version | date | change |
|---|---|---|
| 0.1 | 2026-11-18 | first draft |
| 0.1 | 2026-11-18 | update: first reference implementation, Snark_00 (§16.1); corner rule for three planes at right angles (§7.4); preamble and file order (§14); examples' checks, open questions 2 and 9 brought up to date |
| 0.1 | 2026-11-18 | update: Snark_02 draws point features, patterns and blends (§16.1, §17.3); open question 14 on `max` / `min` where borders cross, with a proposal |
| 0.1 | 2026-11-18 | update: Snark_03 — features over a rounding and on spheres (§5.1, §5.2, §7.5, §9, §16.1); questions 1 and 3 brought up to date |
| 0.1 | 2026-11-18 | update: Snark_04, the editor's animation with wandering features (history only; the format did not change) |
| 0.1 | 2026-11-18 | update: Snark_05, the editor's section view (history only; the format did not change) |
