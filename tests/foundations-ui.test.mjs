import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('reusable skeleton is standalone and respects reduced motion', async () => {
 const source = await read('src/app/shared/skeleton-card.ts');
 assert.ok(source.includes('standalone: true'));assert.ok(source.includes('prefers-reduced-motion:reduce'));
 for(const path of ['src/app/pages/feed.page.ts','src/app/pages/profile.page.ts','src/app/pages/engagement-panel.ts','src/app/pages/wrapped.page.ts']) assert.match(await read(path),/SkeletonCard/);
});
test('route motion is short and disabled for reduced-motion users',async()=>{const css=await read('src/styles.css');assert.ok(css.includes('router-outlet+*{animation:viveu-route-in 200ms'));assert.ok(css.includes('@media(prefers-reduced-motion:reduce){router-outlet+*{animation:none}}'));});
