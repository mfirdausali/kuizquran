// fake-indexeddb installs a spec-compliant IndexedDB onto globalThis, so the
// store modules run in Node exactly as they do in a browser — no mocks of our
// own code, which is the point: a hand-rolled fake would prove only that the
// fake works.
import "fake-indexeddb/auto";
