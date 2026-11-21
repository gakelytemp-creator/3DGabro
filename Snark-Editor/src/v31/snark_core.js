// The two STEP converters of this folder import './snark_core.js'. In the repository the core is one folder up,
// so this file passes it on: `node step_snark.mjs in.step` and `node snark_step.mjs in.snark` run from here.
// The page build does not use this file (embed07.py takes the import line out).
export * from '../snark_core.js';
