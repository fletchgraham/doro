import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEATURES,
  parseFeatureFlags,
  parseTodoistSettings,
} from "./settings";

describe("parseFeatureFlags", () => {
  it("defaults everything on except accomplishable coloring", () => {
    expect(parseFeatureFlags(null)).toEqual(DEFAULT_FEATURES);
    expect(DEFAULT_FEATURES).toEqual({
      gold: true,
      accomplishable: false,
      goals: true,
    });
  });

  it("reads stored flags", () => {
    expect(
      parseFeatureFlags(
        JSON.stringify({ gold: false, accomplishable: true, goals: false })
      )
    ).toEqual({ gold: false, accomplishable: true, goals: false });
  });

  it("fills in flags missing from a partial record", () => {
    expect(parseFeatureFlags(JSON.stringify({ gold: false }))).toEqual({
      gold: false,
      accomplishable: false,
      goals: true,
    });
  });

  it("ignores malformed values and unknown keys", () => {
    expect(
      parseFeatureFlags(JSON.stringify({ gold: "no", goals: 0, extra: true }))
    ).toEqual(DEFAULT_FEATURES);
    expect(parseFeatureFlags("{not json")).toEqual(DEFAULT_FEATURES);
    expect(parseFeatureFlags(JSON.stringify([true, true]))).toEqual(
      DEFAULT_FEATURES
    );
  });

  it("carries the old Show accomplishable switch over on first load", () => {
    expect(parseFeatureFlags(null, "true").accomplishable).toBe(true);
    expect(parseFeatureFlags(null, "false").accomplishable).toBe(false);
    expect(parseFeatureFlags(null, null).accomplishable).toBe(false);
  });

  it("prefers stored flags over the legacy switch", () => {
    expect(
      parseFeatureFlags(JSON.stringify({ accomplishable: false }), "true")
        .accomplishable
    ).toBe(false);
  });
});

describe("parseTodoistSettings", () => {
  it("is enabled by a saved token when the mode was never chosen", () => {
    expect(parseTodoistSettings(null, "tok", null)).toEqual({
      enabled: true,
      token: "tok",
      label: "",
    });
    expect(parseTodoistSettings(null, null, null).enabled).toBe(false);
  });

  it("honours an explicit choice regardless of the token", () => {
    expect(parseTodoistSettings("false", "tok", "work").enabled).toBe(false);
    expect(parseTodoistSettings("true", null, "work")).toEqual({
      enabled: true,
      token: "",
      label: "work",
    });
  });
});
