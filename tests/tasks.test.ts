import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { DEVELOPER, getLoggedInAgent, randomEmail, randomName } from "./helpers";

const TEST_ADMIN_EMAIL = `taskadmin_${Date.now()}@synergasia-test.local`;
const TEST_ADMIN_PASSWORD = "TaskAdmin999!";

describe("Task Management & Student Deletion Cleanup", () => {
  let devAgent: supertest.Agent;
  let adminAgent: supertest.Agent;
  let testAdminId: string;
  let testStudentDbId: number;
  let testStudentAdminId: number;
  let testTaskId: number;

  beforeAll(async () => {
    devAgent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);

    const adminRes = await devAgent.post("/api/developer/admins").send({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      firstName: "TaskTestAdmin",
      lastName: "Automated",
    });
    expect([200, 201]).toContain(adminRes.status);
    testAdminId = adminRes.body.id;

    adminAgent = await getLoggedInAgent(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const userRes = await adminAgent.post("/api/users").send({
      email: randomEmail(),
      password: "Student123!",
      role: "student",
      firstName: randomName(),
      lastName: randomName(),
    });
    expect([200, 201]).toContain(userRes.status);
    const userId = userRes.body.id;

    const studentsRes = await adminAgent.get("/api/students");
    const match = studentsRes.body.find((s: any) => s.user?.id === userId || s.userId === userId);
    expect(match).toBeDefined();
    testStudentDbId = match.id;
    testStudentAdminId = match.adminStudentId;
  });

  afterAll(async () => {
    if (testStudentAdminId) {
      await adminAgent.delete(`/api/students/${testStudentAdminId}`);
    }
    if (testAdminId) {
      await devAgent.delete(`/api/developer/admins/${testAdminId}`);
    }
  });

  it("creates a task for the test student", async () => {
    const res = await adminAgent.post("/api/tasks").send({
      studentId: testStudentDbId,
      title: "Automated Test Task",
      description: "Created by automated test suite",
      status: "pending",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeDefined();
    testTaskId = res.body.id;
  });

  it("task appears in the student task list", async () => {
    const res = await adminAgent.get(`/api/tasks?studentId=${testStudentDbId}`);
    expect(res.status).toBe(200);
    const found = res.body.find((t: any) => t.id === testTaskId);
    expect(found).toBeDefined();
    expect(found.title).toBe("Automated Test Task");
  });

  it("task appears with correct title and status", async () => {
    const res = await adminAgent.get(`/api/tasks?studentId=${testStudentDbId}`);
    expect(res.status).toBe(200);
    const task = res.body.find((t: any) => t.id === testTaskId);
    expect(task).toBeDefined();
    expect(task.title).toBe("Automated Test Task");
    expect(task.status).toBe("pending");
  });

  it("deleting student also removes their tasks (no orphaned tasks)", async () => {
    const deleteRes = await adminAgent.delete(`/api/students/${testStudentAdminId}`);
    expect([200, 204]).toContain(deleteRes.status);
    testStudentAdminId = 0;

    const tasksRes = await adminAgent.get(`/api/tasks?studentId=${testStudentDbId}`);
    const tasks = Array.isArray(tasksRes.body) ? tasksRes.body : [];
    const orphan = tasks.find((t: any) => t.id === testTaskId);
    expect(orphan).toBeUndefined();
  });
});
