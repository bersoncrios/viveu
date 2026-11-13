/** Keep the SDK diagnostic available without exposing internal details in the UI. */
export function dataErrorMessage(error: unknown, fallback: string): string {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code.replace(/^firestore\//, '') : '';
  // An intentionally disabled feature is a normal availability state, not a
  // failed Firestore read/write. Keep real SDK errors visible in the console.
  if (code !== 'vaultlog/shared-disabled') console.error('[Viveu] Falha de persistência', error);
  switch (code) {
    case 'vaultlog/shared-disabled':
      return 'As jornadas em companhia ainda estão em preparação neste ambiente. Tente novamente mais tarde.';
    case 'vaultlog/shared-validation':
    case 'vaultlog/shared-access':
      return error instanceof Error ? error.message : fallback;
    case 'vaultlog/stale-entry':
      return 'Esta experiência mudou em outra sessão. Seu texto continua aqui. Copie suas alterações antes de reabrir a experiência para atualizar os dados.';
    case 'permission-denied':
      return `${fallback} O acesso aos dados foi negado. Entre novamente; se continuar, entre em contato com o suporte.`;
    case 'unauthenticated':
      return `${fallback} Sua sessão expirou. Entre novamente para continuar.`;
    case 'failed-precondition':
      return `${fallback} Este recurso está temporariamente indisponível. Tente mais tarde.`;
    case 'unavailable':
    case 'deadline-exceeded':
      return `${fallback} Confira sua conexão e tente novamente.`;
    case 'resource-exhausted':
      return `${fallback} O serviço está sobrecarregado. Aguarde um pouco antes de tentar novamente.`;
    default:
      return fallback;
  }
}
