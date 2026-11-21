"""python3 embed11.py Snark_05 Snark_11 — embed10 with the interface in English by default (Georgian stays in the KA / EN switch).
   The choice is kept under a new name, so that a browser which remembered Georgian from an older version starts in English too."""
import re, sys, subprocess, pathlib
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed10.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:80]); h = h.replace(a, b)
rep("LANG = store.get('lang', 'ka');", "LANG = store.get('lang2', 'en');")
rep("store.set('lang', LANG);", "store.set('lang2', LANG);")
rep('<option value="ka">KA</option><option value="en">EN</option>', '<option value="en">EN</option><option value="ka">KA</option>')
rep('<html lang="ka">', '<html lang="en">')
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
