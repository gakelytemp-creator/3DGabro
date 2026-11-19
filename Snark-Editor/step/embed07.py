"""python3 embed07.py Snark_05 Snark_07 — the editor with both converters built in:
   Snark → STEP (snark_step.mjs, the "Export STEP" item) and STEP → Snark (step_snark.mjs, "Open…" takes .step / .stp)."""
import re, sys, pathlib
base, name = sys.argv[1], sys.argv[2]
HERE = pathlib.Path(__file__).resolve().parent; EDITOR = HERE.parent      # step/ and Snark-Editor/ in the repository
def body(path, fn):
    src = (HERE / path).read_text(encoding='utf-8')
    src = re.sub(r"^import \* as S from '\.\./src/snark_core\.js';\n", '', src, flags=re.M)
    src = src[:src.index("if (typeof process !== 'undefined'")].replace('export function ' + fn, 'function ' + fn)
    assert 'import ' not in re.sub(r'/\*[\s\S]*?\*/|//.*', '', src) and 'export ' not in src and '__dbg' not in src
    return src
out_ns = ("/* ═══════════════════ STEP export (snark_step 0.3, embedded) ═══════════════════ */\n"
          "const SnarkStep = (() => {\nconst S = { vec, arcGeom, otherAxes, bodyInstances, parseSnark, evaluate, evalBox, evalCyl, makeSkin };\n" + body('snark_step.mjs', 'snarkToStep') + "\nreturn { snarkToStep };\n})();\n")
in_ns = ("/* ═══════════════════ STEP import (step_snark 0.1, embedded) ═══════════════════ */\n"
         "const StepSnark = (() => {\nconst S = { vec, newDoc, writeSnark, triangulateHoles, fmt, fmtV };\n" + body('step_snark.mjs', 'stepToSnark') + "\nreturn { stepToSnark };\n})();\n")
handler = ("$('mStep').onclick = () => {\n"
           "  const btn = $('mStep'), label = btn.textContent; btn.textContent = '… STEP'; btn.disabled = true;\n"
           "  setTimeout(() => {        // let the page show that it is working: a scene with features over edges takes a while\n"
           "    try {\n"
           "      const r = SnarkStep.snarkToStep(PIPE.text, 'scene');\n"
           "      if (r.solids) download('scene.step', r.step, 'application/step');\n"
           "      if (r.log.length || !r.solids) alert(`STEP: ${r.solids} / ${r.bodies}\\n\\n` + r.log.join('\\n'));\n"
           "    } catch (e) { alert('STEP: ' + e.message); }\n"
           "    btn.textContent = label; btn.disabled = false;\n"
           "  }, 50);\n"
           "};\n")
opener = ("$('file').onchange = async e => {\n"
          "  const f = e.target.files[0]; e.target.value = ''; if (!f) return;\n"
          "  try {\n"
          "    const text = await f.text();\n"
          "    if (/\\.(step|stp|p21)$/i.test(f.name) || /^\\s*ISO-10303-21/.test(text)) {      // a STEP file: its faces become patches with cards, its mesh is made here\n"
          "      const r = StepSnark.stepToSnark(text, { title: f.name });\n"
          "      loadText(r.snark);\n"
          "      alert(`STEP → Snark: ${r.bodies} / ${r.faces} → ${r.patches}` + (r.skipped ? ` (−${r.skipped})` : '') + (r.log.length ? '\\n\\n' + r.log.join('\\n') : ''));\n"
          "    } else loadText(text);\n"
          "  } catch (err) { alert(t('openErr') + err.message); }\n"
          "};\n")
h = (EDITOR / (base + '.html')).read_text(encoding='utf-8')
a = '      <button id="mStl" data-t="exportStl"></button>\n'; assert h.count(a) == 1
h = h.replace(a, a + '      <button id="mStep" data-t="exportStep"></button>\n')
for lab, new in (("exportStl:'STL ექსპორტი',", " exportStep:'STEP ექსპორტი (ზუსტი ზედაპირები)',"), ("exportStl:'Export STL',", " exportStep:'Export STEP (exact surfaces)',")):
    assert h.count(lab) == 1; h = h.replace(lab, lab + new)
for lab, new in (("open:'გახსნა…'", "open:'გახსნა… (.snark, .step)'"), ("open:'Open…'", "open:'Open… (.snark, .step)'")):
    assert h.count(lab) == 1; h = h.replace(lab, new)
a = 'accept=".snark,.obj,.txt"'; assert h.count(a) == 1; h = h.replace(a, 'accept=".snark,.obj,.txt,.step,.stp,.p21"')
m = re.search(r"\$\('file'\)\.onchange = async e => \{.*\};\n", h); assert m and h.count(m.group(0)) == 1
h = h.replace(m.group(0), in_ns + opener)
k = "$('mSave').onclick"; assert h.count(k) == 1
h = h.replace(k, out_ns + handler + k).replace(base, name)
(EDITOR / (name + '.html')).write_text(h, encoding='utf-8'); print(name + '.html', len(h))
(HERE / (name + '.check.mjs')).write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
