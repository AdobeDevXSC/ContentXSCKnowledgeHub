export function withPublicOrigin(env, site) {
  return { ...env, PUBLIC_ORIGIN: site.PUBLIC_ORIGIN };
}

export function publicOrigin(env, url) {
  return (env.PUBLIC_ORIGIN || url.origin).replace(/\/+$/, '');
}
