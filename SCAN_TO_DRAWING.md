# Scan to Engineering Drawing — concept

**Status:** concept only. Nothing here is implemented or tested. Every size and number below is an estimate to be replaced by measurement.

Goal: turn a 3D scan of a real part into what an engineer would have drawn — a list of standard primitives, their sizes and positions, and the Boolean operations between them (a CSG tree) — so the part can be edited, redrawn and manufactured again.

> If the construction step is preserved, modification becomes easy.

---

## 1. The blind-hands analogy

A blind person given a part can build its model by touch:

1. **Local recognition.** "This is flat — a plane. This is curved one way — a cylinder."
2. **Whole first, details next.** "It is a plate, and on it there are holes."
3. **Asking where unsure.** "Are these holes through?"

All three map to algorithms:

| Hands | Algorithm |
|---|---|
| touch → plane / cylinder | local normals and curvature → primitive fitting |
| whole, then details | base body first, then subtracted features (CSG hierarchy) |
| "is it through?" | uncertainty → question to the operator or a new measurement |

**Why it is solvable:** engineering parts use a small vocabulary — planes, cylinders, cones, holes, pockets, slots, steps, chamfers, fillets — and standard sizes (M6, ⌀10H7). A general shape is unrecoverable; an engineering part is not.

**Expected reach:**

- good: machined (prismatic) parts, turned parts, sheet metal;
- partial: castings (fillets, draft, rough surfaces);
- poor: freeform surfaces — a different tool is needed.

Separate question for worn or damaged parts: reconstruct **what is** or **what should have been** (nominal). Repair usually needs the nominal.

---

## 2. Pipeline

```
scan (point cloud)
   ↓
voxels, coarse → fine (octree: refine only where needed)
   ↓
neural network: per-voxel "what is here" + rough feature geometry
   ↓
grouping into feature candidates
   ↓
exact geometric fitting on raw points (sizes, axes, positions)
   ↓
snap to standards (⌀9.97 → ⌀10H7), detect patterns (hole circles, arrays, symmetry)
   ↓
CSG tree: base body − features
   ↓
questions where uncertain ("through?", "hidden face?")
   ↓
editable 3DGabro model → engineering drawing
```

**Division of labour:** the network says **what** and **roughly where**; geometry measures **exactly**; standards **correct**; the operator answers what neither can see.

### Coarse to fine = CSG levels

| Voxel size (example) | Sees |
|---|---|
| ~4 mm | base body: block, cylinder, plate |
| ~1 mm | pockets, steps, large holes |
| ~0.25 mm | small holes, chamfers, slots |

Each resolution sees one level of the tree.

---

## 3. Training data: generated, not collected

The usual blocker for such networks is labelled data. Here it can be generated without limit, because the answer comes first and the shape is computed from it:

1. random CSG trees from the primitive vocabulary → voxel part with known answer;
2. G-code programs run through the Gabro-CNC stock-cutting simulator → voxel part whose operations are known exactly;
3. parametric parts generator (gears, bearings, fasteners) → realistic standard parts;
4. scan simulation on top: noise, missing regions (occlusion, deep hole bottoms), surface roughness.

Risk: a network trained only on synthetic data works worse on real scans. A set of real scanned parts with hand-made answers is needed for honest evaluation.

---

## 4. Network size — first estimate (RTX 4060, 8 GB)

**Patch-wise processing.** Features are local, so the network does not need the whole part at once. It slides over the part in cubes (e.g. 64³ voxels) and labels each cube. Global structure — hole patterns, symmetry, which features belong together — is assembled afterwards by geometry, not by the network.

Large features that do not fit one patch are seen by the **coarse pass**: at ~4 mm a 250 mm part is ~64³ voxels — the whole part in one cube.

**Starting architecture:** 3D U-Net (encoder–decoder with skip connections), preferably on sparse voxels (only occupied voxels are stored).

| Item | First guess |
|---|---|
| input patch | 64³ voxels, 1 channel (occupied / empty) |
| depth | 4 down-sampling levels, ~16–20 convolution layers in total |
| channels | 32 → 64 → 128 → 256 |
| parameters | ~5–20 million |
| outputs per voxel | class (base, plane, cylinder, hole, pocket, chamfer, fillet, other) + offset to the feature's axis/surface + uncertainty |
| precision | fp16 (mixed precision) |
| batch | ~8–16 patches of 64³ in 8 GB |
| training | hours to about a day on synthetic data, per experiment |

This is deliberately small: the network only labels local geometry; exact dimensions come from fitting.

**Uncertainty is required, not optional** — without it the system cannot ask "is it through?" and will answer confidently and wrongly.

---

## 5. First experiments (in order)

1. **Clean synthetic, one level:** random blocks with holes and pockets, no noise → can the network label voxels correctly?
2. **Add fitting and snapping:** do recovered sizes match the generating answer within tolerance?
3. **Add noise and occlusion:** how fast does quality fall?
4. **Simulator parts:** G-code → voxels → recovered operations vs. original program.
5. **Real scans:** a small set of real parts with hand-made answers — the only test that counts.

Each step passes only on measured results.

---

## ქართული მოკლე აღწერა

**მიზანი:** სკანიდან ინჟინრული ნახაზის მიღება. შედეგი იქნება სტანდარტული ფიგურების სია, მათი ზომები და პოზიციები, და ბულის ოპერაციების ხე. ასეთი მოდელის შეცვლა ადვილია.

**ბრმა ადამიანის ანალოგია:** ხელით ფიგურას ამოიცნობს, ჯერ მთლიანს ხედავს და მერე დეტალებს, ხოლო სადაც არ იცის, კითხულობს.

**გზა:** ვოქსელები უხეშიდან ნაზისკენ → ნეირონული ქსელი ამბობს, **რა** არის და **დაახლოებით სად** → გეომეტრია ზომავს **ზუსტად** → სტანდარტი ასწორებს → სადაც გაურკვევლობაა, ოპერატორს ეკითხება.

**მონაცემები** უსასრულოდ შეიძლება აწარმოო: შემთხვევითი CSG ხეებიდან, G-code-ის სიმულატორიდან და დეტალების გენერატორიდან. პასუხი წინასწარ ცნობილია.

**ქსელი** პატარაა: 3D U-Net, 64³ კუბებით, 5–20 მილიონი პარამეტრი. RTX 4060-ზე ეტევა. დიდი ფიგურები უხეშ გავლაზე ჩანს. ყველა ციფრი მხოლოდ საწყისი შეფასებაა და ექსპერიმენტით უნდა შემოწმდეს.
