import { spawnSync } from 'node:child_process';
export function configurationForBranch(branch) {
  if (branch === 'main' || branch === 'master') return 'production';
  if (branch === 'develop' || branch === 'hml') return 'hml';
  return 'hml';
}
if (process.argv[1]?.endsWith('vercel-build.mjs')) {
  const configuration = configurationForBranch(process.env.VERCEL_GIT_COMMIT_REF);
  console.log(`Viveu: build ${configuration}`);
  const result = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build', `--configuration=${configuration}`], {stdio: 'inherit'});
  process.exit(result.status ?? 1);
}
