import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { BASE_URL, DEVELOPER, getLoggedInAgent, request } from "./helpers";

describe("Authentication", () => {
  it("rejects unauthenticated access to protected API routes", async () => {
    const res = await request.get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("rejects login with wrong password", async () => {
    const res = await request
      .post("/api/auth/login")
      .send({ email: DEVELOPER.email, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("rejects login with unknown email", async () => {
    const res = await request
      .post("/api/auth/login")
      .send({ email: "nobody_xyz_abc@nowhere.invalid", password: "anything" });
    expect(res.status).toBe(401);
  });

  it("rejects login with missing email", async () => {
    const res = await request.post("/api/auth/login").send({ password: "abc" });
    expect(res.status).toBe(400);
  });

  it("rejects login with missing password", async () => {
    const res = await request.post("/api/auth/login").send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });

  it("logs in successfully with valid developer credentials", async () => {
    const agent = supertest.agent(BASE_URL);
    const res = await agent.post("/api/auth/login").send(DEVELOPER);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(DEVELOPER.email);
    expect(res.body.user.role).toBe("developer");
  });

  it("returns current user info after login", async () => {
    const agent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);
    const res = await agent.get("/api/auth/user");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(DEVELOPER.email);
  });

  it("logs out and subsequent API calls are rejected", async () => {
    const agent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);

    const logoutRes = await agent.get("/api/logout");
    expect([200, 302]).toContain(logoutRes.status);

    const afterRes = await agent.get("/api/auth/user");
    expect([401, 403]).toContain(afterRes.status);
  });

  it("new unauthenticated agent cannot access protected routes", async () => {
    const freshAgent = supertest.agent(BASE_URL);
    const res = await freshAgent.get("/api/tasks");
    expect(res.status).toBe(401);
  });
});
