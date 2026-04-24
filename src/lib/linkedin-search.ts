/**
 * Pure-function helpers that build Google search URLs scoped to LinkedIn
 * public profiles. No auth, no API — the link just opens Google with a
 * `site:linkedin.com/in` query so the user can pick a real human.
 */

function buildUrl(company: string, role: string): string {
  const safeCompany = company.trim();
  const safeRole = role.trim() || 'recruiter';
  const query = `site:linkedin.com/in "${safeRole}" "${safeCompany}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Returns a Google search URL for finding recruiters (or any `role`) on
 * LinkedIn at a given company. Defaults to "recruiter" when no role given.
 */
export function linkedinSearchUrl(company: string, role?: string): string {
  return buildUrl(company, role ?? 'recruiter');
}

/**
 * Returns a Google search URL for finding a hiring manager for a specific
 * job title at a company. The role term is combined with "hiring manager"
 * so the query targets people likely to own the req.
 */
export function hiringManagerSearchUrl(company: string, roleTitle: string): string {
  const trimmed = roleTitle.trim();
  const role = trimmed ? `${trimmed} hiring manager` : 'hiring manager';
  return buildUrl(company, role);
}
