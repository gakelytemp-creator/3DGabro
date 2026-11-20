# Scan → drawing: working principles

**მოკლედ.** სამი წესი, რომლითაც სკანიდან ნახაზს ვაგებთ: (1) სიმეტრია — რაც ტოლია, ერთად იზომება; (2) მონაწილეობა — ყოველ პარამეტრზე ვიცით, წერტილების რა წილმა მიიღო მონაწილეობა; (3) ალგორითმი ითვლის და ამოწმებს, LLM ირჩევს ჰიპოთეზას გამოცდილების ბაზით.

Draft 0.1 · 20 November 2026 · ideas by Gakely, written down by Claude.

## 1. Symmetry

A drawing has far fewer numbers than a scan has points, because a part is full of symmetry. Every symmetry that is found lets more points speak for one number, and noise averages out.

- **Kinds:** translation along an axis (the section does not change — the "inheritance group" of sections); rotation (a hole, a shaft); mirror; repetition with a pitch (a row or grid of holes); equality (the same radius, the same diameter, parallel or square planes).
- **A symmetry is a hypothesis and is tested.** Elements are joined, fitted together, and the group stands only if the points fit the common value as well as they fitted their own. Otherwise a real difference would be forced into a false equality.
- **What averaging cannot do:** it removes random noise, not a systematic error of the scanner. Scatter *between* the pieces of a group tells the two apart.
- **Order of work:** the frame of the part first (its own axes are its largest symmetry), then signatures and sections along those axes, then groups.

## 2. Participation

For every number the work reports how many points took part in finding it.

- **Participation:** points used for a parameter ÷ points that could have been used (all points lying on that element or on its equals).
- **Explained share:** the part of the whole scan that some parameter explains.
- Both are driven towards 100 %, and both are printed after every change of the method: they are the measure of progress.

## 3. Algorithm and LLM

- **The algorithm** computes and verifies: signatures, fits, scatter. It never guesses.
- **The LLM** chooses a hypothesis: which symmetry to try, whether a short piece is a chamfer or noise, which drawing number a measured value stands for. It is not given raw points.
- **The algorithm** checks the hypothesis by scatter. The last word belongs to a number.
- **The experience base** keeps cases: the description the algorithm made, the decision, and the person's confirmation or correction. For a new case the similar old ones are attached to the question. This is what accumulates between sessions and works with any model.

## First results (scan 01, a cast housing, 1 476 198 points)

| group | pieces | each alone | together | points |
|---|---|---|---|---|
| fillet R4 | 12 | R 3.906 – 4.080 | R 3.998 ± 0.017 | 40 451 |
| holes ⌀8.5 | 7 | ⌀ 8.432 – 8.498 | ⌀ 8.472 ± 0.008 | 17 968 |
| holes ⌀11 | 2 | ⌀ 11.048 – 11.054 | ⌀ 11.050 ± 0.002 | 4 105 |
| rounded edge R9.5 | 8 | R 8.988 – 9.556 | R 9.373 ± 0.076 | 13 039 |

Scatter of the points did not grow in any of these groups (0.027 → 0.028 mm for R4). Open: a short arc cannot tell its radius from the place of its centre, so for the R9.5 group the test passes although the pieces differ by 0.57 mm — arcs need the two faces they join as a further condition.
