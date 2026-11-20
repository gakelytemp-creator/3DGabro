#!/bin/sh
# Builds Snark-Editor/Snark_18.html from Snark-Editor/Snark_05.html and the sources in this folder.
#   npm install          once: Manifold (its JavaScript and WebAssembly are copied into the page)
#   sh build.sh [name]   name: Snark_18 by default
set -e
cd "$(dirname "$0")"
NAME="${1:-Snark_18}"
python3 embed13.py Snark_05 "$NAME"          # embed13 runs embed12, which runs embed11 … down to embed07
node --check "$NAME.check.mjs"               # the script of the page, checked for syntax
mv "$NAME.html" ../../"$NAME.html"
rm -f "$NAME.check.mjs"
echo "built ../../$NAME.html"
