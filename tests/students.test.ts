import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { DEVELOPER, TEST_ADMIN, getLoggedInAgent, randomEmail, randomName } from "./helpers";

describe("Student Management", () => {
  let devAgent: supertest.Agent;
  let adminAgent: supertest.Agent;
  let testAdminId: string;
  let testStudentUserId: string;
  let testStudentAdminId: number;

  beforeAll(async () => {
    devAgent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);

    const adminRes = await devAgent.post("/api/developer/admins").send({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      firstName: TEST_ADMIN.firstName,
      lastName: TEST_ADMIN.lastName,
    });
    expect([200, 201]).toContain(adminRes.status);
    testAdminId = adminRes.body.id;

    adminAgent = await getLoggedInAgent(TEST_ADMIN.email, TEST_ADMIN.password);
  });

  afterAll(async () => {
    if (testAdminId) {
      await devAgent.delete(`/api/developer/admins/${testAdminId}`);
    }
  });

  it("admin can list students (initially empty for new admin)", async () => {
    const res = await adminAgent.get("/api/students");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("admin can create a student user", async () => {
    const res = await adminAgent.post("/api/users").send({
      email: randomEmail(),
      password: "Student123!",
      role: "student",
      firstName: randomName(),
      lastName: randomName(),
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeDefined();
    testStudentUserId = res.body.id;
  });

  it("new student appears in the student list", async () => {
    const res = await adminAgent.get("/api/students");
    expect(res.status).toBe(200);
    const match = res.body.find((s: any) => s.user?.id === testStudentUserId || s.userId === testStudentUserId);
    expect(match).toBeDefined();
    testStudentAdminId = match.adminStudentId;
  });

  it("can fetch the student by adminStudentId", async () => {
    if (!testStudentAdminId) return;
    const res = await adminAgent.get(`/api/students/by-admin-id/${testStudentAdminId}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it("deletes the student and removes them from the list", async () => {
    if (!testStudentAdminId) return;
    const deleteRes = await adminAgent.delete(`/api/students/${testStudentAdminId}`);
    expect([200, 204]).toContain(deleteRes.status);

    const listRes = await adminAgent.get("/api/students");
    const found = listRes.body.find((s: any) => s.adminStudentId === testStudentAdminId);
    expect(found).toBeUndefined();
    testStudentAdminId = 0;
  });
});
