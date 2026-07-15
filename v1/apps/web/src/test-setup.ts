// Provide an in-memory IndexedDB for vitest (jsdom has none). This is real IDB
// semantics — transactions, autoIncrement, durability-on-tx.done — not a mock.
import "fake-indexeddb/auto";
