export function isNueva(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt.replace(' ', 'T'));
  if (isNaN(created.getTime())) return false;
  const diffMs = Date.now() - created.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  return diffDias <= 5;
}
