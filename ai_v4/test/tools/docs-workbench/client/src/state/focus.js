// Węzeł, który Mapa ma wyśrodkować, gdy tylko pojawi się na płótnie.
// Zapis w module, a nie w zdarzeniu, bo Mapa może się dopiero zamontować
// (na przykład „Pokaż” w panelu walidacji z trybu Zasięg).
let pending = null;

export const requestFocus = id => { pending = id; };
export const peekFocus = () => pending;
export const clearFocus = () => { pending = null; };
