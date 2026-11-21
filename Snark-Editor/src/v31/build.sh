#!/bin/sh
# Builds Snark-Editor/Snark_31.html from Snark-Editor/Snark_05.html and the sources in this folder.
#   npm install          once: Manifold (its JavaScript and WebAssembly are copied into the page)
#   sh build.sh [name]   name: Snark_31 by default
set -e
cd "$(dirname "$0")"
NAME="${1:-Snark_31}"
python3 embed14.py Snark_05 "$NAME"          # embed14 runs embed13, which runs embed12 … down to embed07
node --check "$NAME.check.mjs"               # the script of the page, checked for syntax
mv "$NAME.html" ../../"$NAME.html"
rm -f "$NAME.check.mjs"
echo "built ../../$NAME.html"
