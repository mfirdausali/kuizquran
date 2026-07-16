import { beforeEach, describe, expect, it } from "vitest";
import { getGlossLang, setGlossLang, clearGlossLang } from "./glossLang.ts";

beforeEach(() => localStorage.clear());

describe("gloss language persistence (v2-D27)", () => {
  it("defaults to en when never set", () => {
    expect(getGlossLang()).toBe("en");
  });

  it("round-trips a choice", () => {
    setGlossLang("ms");
    expect(getGlossLang()).toBe("ms");
  });

  it("ignores a corrupt stored value and falls back to the default", () => {
    localStorage.setItem("iman-gloss-lang", "fr");
    expect(getGlossLang()).toBe("en");
  });

  it("clears back to the default", () => {
    setGlossLang("ms");
    clearGlossLang();
    expect(getGlossLang()).toBe("en");
  });
});
