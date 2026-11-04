/** Prefix a site-relative path with the configured base (e.g. "/android-portfolio/"). */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\/+/, '');
}
