import { runAngular } from './angular-env.mjs';
export function configurationForBranch(branch) {
  if (branch === 'main' || branch === 'master') return 'production';
  if (branch === 'develop' || branch === 'hml') return 'hml';
  return 'hml';
}
if (process.argv[1]?.endsWith('vercel-build.mjs')) {
  const configuration = configurationForBranch(process.env.VERCEL_GIT_COMMIT_REF);
  console.log(`Viveu: build ${configuration}`);
  process.exit(runAngular('build', configuration === 'production' ? 'prod' : 'hml'));
}
