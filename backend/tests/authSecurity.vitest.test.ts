import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "../function/createToken.js";
import { requireTrustedOrigin } from "../middelware/csrf/requireTrustedOrigin.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("cookie-only authentication hardening", () => {
  it("uses secure, HttpOnly, host-only paths outside local development", () => {
    process.env.NODE_ENV = "production";

    expect(getAccessCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api",
    });
    expect(getRefreshCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/auth",
    });
  });

  it("allows plain HTTP cookies only in explicit local development", () => {
    process.env.NODE_ENV = "development";
    expect(getAccessCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
  });
});

describe("CSRF origin protection", () => {
  it("rejects unsafe production requests from an untrusted origin", () => {
    process.env.NODE_ENV = "production";
    const status = vi.fn().mockReturnThis();
    const set = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const next = vi.fn();

    requireTrustedOrigin(
      {
        method: "POST",
        get: () => "https://attacker.example",
        originalUrl: "/api/login",
        url: "/api/login",
      } as any,
      { status, set, json } as any,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "mw_csrf_err1" }));
  });

  it("allows an unsafe request from the configured frontend", () => {
    process.env.NODE_ENV = "production";
    const next = vi.fn();

    requireTrustedOrigin(
      {
        method: "POST",
        get: () => "https://wizpix.ch",
        originalUrl: "/api/login",
        url: "/api/login",
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });
});
