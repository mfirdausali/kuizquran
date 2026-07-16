// Provide an in-memory IndexedDB for vitest (jsdom has none). Real IDB
// semantics — transactions, autoIncrement, durability-on-tx.done — not a mock.
import "fake-indexeddb/auto";
