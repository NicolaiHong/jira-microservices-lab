import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";

import { getApiErrorKind, getApiErrorMessage } from "./apiError";

function httpError(status?: number, data?: unknown) {
  const response = status ? ({ status, data } as AxiosResponse) : undefined;
  return new AxiosError("failed", "ERR", undefined, undefined, response);
}

describe("API error classification", () => {
  it.each([
    [httpError(), "unavailable"],
    [httpError(503), "unavailable"],
    [httpError(401), "unauthorized"],
    [httpError(403), "forbidden"],
    [httpError(404), "not-found"],
    [httpError(409), "rejected"],
    [httpError(500), "unknown"],
    [new Error("boom"), "unknown"],
  ])("classifies %s as %s", (error, kind) => {
    expect(getApiErrorKind(error)).toBe(kind);
  });

  it("shows validation field messages, then the server message, then the fallback", () => {
    expect(getApiErrorMessage(httpError(400, { code: "VALIDATION_ERROR", message: "Request validation failed", details: { name: "name is required" } }), "fallback")).toBe("name is required");
    expect(getApiErrorMessage(httpError(409, { code: "PROJECT_KEY_ALREADY_EXISTS", message: "Project key already exists inside this workspace", details: {} }), "fallback")).toBe("Project key already exists inside this workspace");
    expect(getApiErrorMessage(httpError(500, { message: "Unexpected server error" }), "fallback")).toBe("fallback");
    expect(getApiErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });

  it("does not leak server prose for unavailable or expired-session failures", () => {
    expect(getApiErrorMessage(httpError(), "fallback")).toMatch(/cannot reach the server/i);
    expect(getApiErrorMessage(httpError(503, { message: "ISSUE_SERVICE_UNAVAILABLE" }), "fallback")).toMatch(/temporarily unavailable/i);
    expect(getApiErrorMessage(httpError(401, { message: "Token expired" }), "fallback")).toMatch(/session has expired/i);
  });
});
