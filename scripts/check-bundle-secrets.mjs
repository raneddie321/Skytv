/** Fails if the TMDB key (or any TMDB_API_KEY value) leaked into the production bundle. Run after `npm run build`. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const envFile = path.resolve('.env');
const key =
  process.env.TMDB_API_KEY ||
  (existsSync(envFile) ? /^TMDB_API_KEY=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() : undefined);
if (!key) {
  console.log('No TMDB_API_KEY configured; nothing to check.');
  process.exit(0);
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : [path.join(d, f)]));
const leaks = walk(path.resolve('dist')).filter((f) => /\.(js|html|css|map|json)$/.test(f) && readFileSync(f, 'utf8').includes(key));
if (leaks.length) {
  console.error('TMDB key found in the client bundle:\n' + leaks.join('\n'));
  process.exit(1);
}
console.log('OK: the TMDB key is not present in dist/.');
