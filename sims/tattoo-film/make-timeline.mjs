// Writes timeline.json from the film's script and the machine's simulated cycles: node sims/tattoo-film/make-timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timeline} from '../tattoo-shared/timing.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'timeline.json');
const tl = timeline();
fs.writeFileSync(out, JSON.stringify(tl));
console.log(out, `closes ${tl.closes.length}, strikes ${tl.strikes.length}, buzz ${JSON.stringify(tl.buzz)}`);
