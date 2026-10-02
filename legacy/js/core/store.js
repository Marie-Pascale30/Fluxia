// Store minimaliste : un état unique + abonnés notifiés à chaque changement.

export function createStore(initialState) {
    let state = initialState;
    const listeners = new Set();

    return {
        get: () => state,

        // Accepte un objet partiel ou une fonction (state) => objet partiel
        set(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch;
            state = { ...state, ...next };
            listeners.forEach((listener) => listener(state));
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
