//  The browser storage every store test stands on: a Map a case can read and
//  seed, behind the three methods zustand's persistence asks for. The map comes
//  in so that two stores can share one, the way two tabs share a browser's.
export function createMemoryStorage(values = new Map<string, string>()) {
    return {
        values,
        storage: {
            getItem: (name: string) => values.get(name) ?? null,
            setItem: (name: string, value: string) => {
                values.set(name, value);
            },
            removeItem: (name: string) => {
                values.delete(name);
            },
        },
    };
}
