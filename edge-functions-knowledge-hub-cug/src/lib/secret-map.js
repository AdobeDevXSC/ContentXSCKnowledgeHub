export function getSecretsMap(store, state) {
  if (!state.promise) {
    state.promise = (async () => {
      try {
        const entry = await store.get('secrets');
        return entry ? JSON.parse(entry.plaintext()) : null;
      } catch {
        return null;
      }
    })();
  }
  return state.promise;
}
