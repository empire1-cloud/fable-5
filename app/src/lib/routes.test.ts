import { describe, expect, it } from "vitest";
import {
  afterSignInTarget,
  isPrivatePath,
  isPublicPath,
  PRIVATE_PATHS,
  resolveAccess,
  SIGN_IN_PATH,
} from "./routes";

describe("route table — public marketing surface", () => {
  it("treats every public path as public", () => {
    for (const p of ["/", "/how-it-works", "/proof", "/founding-access", "/trust", "/sign-in"]) {
      expect(isPublicPath(p)).toBe(true);
      expect(resolveAccess(p, false).allowed).toBe(true);
      expect(resolveAccess(p, true).allowed).toBe(true);
    }
  });

  it("the sign-in path is the canonical one used by guards", () => {
    expect(SIGN_IN_PATH).toBe("/sign-in");
    expect(isPublicPath(SIGN_IN_PATH)).toBe(true);
  });

  it("does not expose control-plane paths on the public table", () => {
    for (const p of PRIVATE_PATHS) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("access boundary — private workspaces require a session", () => {
  it("refuses unauthenticated users on every private path and points them at sign-in", () => {
    for (const p of PRIVATE_PATHS) {
      const decision = resolveAccess(p, false);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("unauthenticated");
        expect(decision.redirect.startsWith(`/sign-in?next=`)).toBe(true);
        expect(decision.redirect).toContain(encodeURIComponent(p));
      }
    }
  });

  it("admits authenticated users on every private path", () => {
    for (const p of PRIVATE_PATHS) {
      expect(resolveAccess(p, true)).toEqual({ allowed: true });
    }
  });

  it("covers every required control route", () => {
    for (const p of ["/control", "/control/evidence", "/control/decisions", "/control/escalations", "/control/settings"]) {
      expect(isPrivatePath(p)).toBe(true);
    }
  });
});

describe("post-sign-in targeting", () => {
  it("sends a user back where they were when they came from a private path", () => {
    expect(afterSignInTarget("/control/evidence")).toBe("/control/evidence");
    expect(afterSignInTarget("/billing")).toBe("/billing");
  });

  it("defaults to the control home for anything else", () => {
    expect(afterSignInTarget("/")).toBe("/control");
    expect(afterSignInTarget("/trust")).toBe("/control");
  });
});
