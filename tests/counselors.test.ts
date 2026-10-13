import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { DEVELOPER, getLoggedInAgent, randomEmail, randomName } from "./helpers";

const TEST_ADMIN_EMAIL = `counadmin_${Date.now()}@synergasia-test.local`;
const TEST_ADMIN_PASSWORD = "CounAdmin999!";

describe("Counselor Management", () => {
  let devAgent: supertest.Agent;
  let adminAgent: supertest.Agent;
  let testAdminId: string;
  let testCounselorAdminId: number;
  let testStudentAdminId: number;

  beforeAll(async () => {
    devAgent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);

    const adminRes = await devAgent.post("/api/developer/admins").send({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      firstName: "CounTestAdmin",
      lastName: "Automated",
    });
    expect([200, 201]).toContain(adminRes.status);
    testAdminId = adminRes.body.id;

    adminAgent = await getLoggedInAgent(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  });

  afterAll(async () => {
    if (testStudentAdminId) {
      await adminAgent.delete(`/api/students/${testStudentAdminId}`);
    }
    if (testCounselorAdminId) {
      await adminAgent.delete(`/api/counselors/${testCounselorAdminId}`);
    }
    if (testAdminId) {
      await devAgent.delete(`/api/developer/admins/${testAdminId}`);
    }
  });

  it("admin can list counselors (initially empty for new admin)", async () => {
    const res = await adminAgent.get("/api/counselors");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("admin can create a counselor", async () => {
    const res = await adminAgent.post("/api/users").send({
      email: randomEmail(),
      password: "Counselor123!",
      role: "counselor",
      firstName: randomName(),
      lastName: randomName(),
    });
    expect([200, 201]).toContain(res.status);

    const listRes = await adminAgent.get("/api/counselors");
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);
    testCounselorAdminId = listRes.body[0].adminCounselorId;
  });

  it("counselor list only shows active (non-deleted) counselors", async () => {
    const res = await adminAgent.get("/api/counselors");
    expect(res.status).toBe(200);
    const deletedCounselors = res.body.filter((c: any) => c.user?.isDeleted === true);
    expect(deletedCounselors.length).toBe(0);
  });

  it("cannot delete a counselor who has an assigned student", async () => {
    const studentRes = await adminAgent.post("/api/users").send({
      email: randomEmail(),
      password: "Student123!",
      role: "student",
      firstName: randomName(),
      lastName: randomName(),
      counselorId: testCounselorAdminId,
    });
    expect([200, 201]).toContain(studentRes.status);

    const studentsRes = await adminAgent.get("/api/students");
    const match = studentsRes.body.find((s: any) => s.counselorId !== null);
    if (match) testStudentAdminId = match.adminStudentId;

    const deleteRes = await adminAgent.delete(`/api/counselors/${testCounselorAdminId}`);
    expect([400, 409]).toContain(deleteRes.status);
    expect(deleteRes.body.message).toMatch(/student/i);
  });

  it("can delete a counselor with no assigned students after unassigning", async () => {
    if (!testStudentAdminId || !testCounselorAdminId) return;

    await adminAgent.delete(`/api/students/${testStudentAdminId}`);
    testStudentAdminId = 0;

    const deleteRes = await adminAgent.delete(`/api/counselors/${testCounselorAdminId}`);
    expect([200, 204]).toContain(deleteRes.status);
    testCounselorAdminId = 0;
  });
});
