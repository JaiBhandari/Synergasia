import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import { BASE_URL, DEVELOPER, getLoggedInAgent, request } from "./helpers";

describe("Role-Based Access Control", () => {
  let devAgent: supertest.Agent;

  beforeAll(async () => {
    devAgent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);
  });

  it("unauthenticated requests get 401 on requireAuth-only routes", async () => {
    const routes = ["/api/tasks", "/api/developer/admins", "/api/developer/stats"];
    for (const path of routes) {
      const res = await request.get(path);
      expect(res.status, `Expected 401 for GET ${path}`).toBe(401);
    }
  });

  it("developer can access developer-only routes", async () => {
    const res = await devAgent.get("/api/developer/admins");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("developer gets 403 when accessing admin-only routes (students)", async () => {
    const res = await devAgent.get("/api/students");
    expect(res.status).toBe(403);
  });

  it("developer gets 403 when accessing admin-only routes (counselors)", async () => {
    const res = await devAgent.get("/api/counselors");
    expect(res.status).toBe(403);
  });

  it("sessions are isolated between agents", async () => {
    const unauthAgent = supertest.agent(BASE_URL);
    const authRes = await devAgent.get("/api/developer/stats");
    const unauthRes = await unauthAgent.get("/api/developer/stats");

    expect(authRes.status).toBe(200);
    expect(unauthRes.status).toBe(401);
  });

  it("developer can access platform stats", async () => {
    const res = await devAgent.get("/api/developer/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalAdmins");
    expect(res.body).toHaveProperty("totalStudents");
    expect(res.body).toHaveProperty("totalCounselors");
  });
});
