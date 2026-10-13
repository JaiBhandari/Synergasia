import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { DEVELOPER, getLoggedInAgent, randomEmail, randomName } from "./helpers";

const TEST_ADMIN_EMAIL = `pfadmin_${Date.now()}@synergasia-test.local`;
const TEST_ADMIN_PASSWORD = "PfAdmin999!";

describe("Profile Field Save & Required-Field Validation", () => {
  let devAgent: supertest.Agent;
  let adminAgent: supertest.Agent;
  let counselorAgent: supertest.Agent;
  let student1Agent: supertest.Agent;

  let testAdminId: string;
  let testCategoryId: number;
  let testFieldId: number;
  let testCounselorAdminId: number;

  let student1AdminId: number;
  let student1Email: string;
  let student2AdminId: number;

  beforeAll(async () => {
    devAgent = await getLoggedInAgent(DEVELOPER.email, DEVELOPER.password);

    const adminRes = await devAgent.post("/api/developer/admins").send({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      firstName: "PfTestAdmin",
      lastName: "Automated",
    });
    expect([200, 201]).toContain(adminRes.status);
    testAdminId = adminRes.body.id;

    adminAgent = await getLoggedInAgent(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const categoryRes = await adminAgent.post("/api/profile-field-categories").send({
      name: "Test Category",
      value: "test_category",
    });
    expect([200, 201]).toContain(categoryRes.status);
    testCategoryId = categoryRes.body.id;

    const fieldRes = await adminAgent.post("/api/profile-fields").send({
      categoryId: testCategoryId,
      fieldName: "test_required_field",
      fieldLabel: "Test Required Field",
      fieldType: "text",
      isRequired: true,
      isEditable: true,
    });
    expect([200, 201]).toContain(fieldRes.status);
    testFieldId = fieldRes.body.id;

    const counselorEmail = randomEmail();
    const counselorPassword = "Counselor123!";
    const counselorUserRes = await adminAgent.post("/api/users").send({
      email: counselorEmail,
      password: counselorPassword,
      role: "counselor",
      firstName: randomName(),
      lastName: randomName(),
    });
    expect([200, 201]).toContain(counselorUserRes.status);
    const counselorUserId = counselorUserRes.body.id;

    const counselorListRes = await adminAgent.get("/api/counselors");
    expect(counselorListRes.status).toBe(200);
    const matchedCounselor = counselorListRes.body.find((c: any) => c.userId === counselorUserId);
    expect(matchedCounselor).toBeDefined();
    testCounselorAdminId = matchedCounselor.adminCounselorId;

    counselorAgent = await getLoggedInAgent(counselorEmail, counselorPassword);

    student1Email = randomEmail();
    const student1Res = await adminAgent.post("/api/users").send({
      email: student1Email,
      password: "Student123!",
      role: "student",
      firstName: randomName(),
      lastName: randomName(),
      counselorId: testCounselorAdminId,
    });
    expect([200, 201]).toContain(student1Res.status);
    const student1UserId = student1Res.body.id;
    student1Agent = await getLoggedInAgent(student1Email, "Student123!");

    const student2Res = await adminAgent.post("/api/users").send({
      email: randomEmail(),
      password: "Student123!",
      role: "student",
      firstName: randomName(),
      lastName: randomName(),
    });
    expect([200, 201]).toContain(student2Res.status);
    const student2UserId = student2Res.body.id;

    const studentsRes = await adminAgent.get("/api/students");
    expect(studentsRes.status).toBe(200);

    const student1 = studentsRes.body.find((s: any) => s.user?.id === student1UserId || s.userId === student1UserId);
    expect(student1).toBeDefined();
    student1AdminId = student1.adminStudentId;

    const student2 = studentsRes.body.find((s: any) => s.user?.id === student2UserId || s.userId === student2UserId);
    expect(student2).toBeDefined();
    student2AdminId = student2.adminStudentId;
  });

  afterAll(async () => {
    if (student1AdminId) await adminAgent.delete(`/api/students/${student1AdminId}`);
    if (student2AdminId) await adminAgent.delete(`/api/students/${student2AdminId}`);
    if (testFieldId) await adminAgent.delete(`/api/profile-fields/${testFieldId}`);
    if (testCategoryId) await adminAgent.delete(`/api/profile-field-categories/${testCategoryId}`);
    if (testCounselorAdminId) await adminAgent.delete(`/api/counselors/${testCounselorAdminId}`);
    if (testAdminId) await devAgent.delete(`/api/developer/admins/${testAdminId}`);
  });

  it("returns 400 when a required profile field is saved with an empty value", async () => {
    const res = await adminAgent.put(`/api/students/${student1AdminId}/profile`).send({
      fieldId: testFieldId,
      value: "",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("returns 400 when a required profile field is saved with a whitespace-only value", async () => {
    const res = await adminAgent.put(`/api/students/${student1AdminId}/profile`).send({
      fieldId: testFieldId,
      value: "   ",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("returns 200 when a required profile field is saved with a valid non-empty value", async () => {
    const res = await adminAgent.put(`/api/students/${student1AdminId}/profile`).send({
      fieldId: testFieldId,
      value: "Valid Entry",
    });
    expect(res.status).toBe(200);
  });

  it("returns 403 when counselor tries to update profile for a student not assigned to them", async () => {
    const res = await counselorAgent.put(`/api/students/${student2AdminId}/profile`).send({
      fieldId: testFieldId,
      value: "Should be blocked",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  // --- Batch endpoint tests ---

  it("batch: returns 400 when a required field is submitted with an empty value", async () => {
    const res = await adminAgent
      .put(`/api/students/${student1AdminId}/profile/batch`)
      .send({ fields: [{ fieldId: testFieldId, value: "" }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("batch: returns 200 and persists all fields when values are valid", async () => {
    const res = await adminAgent
      .put(`/api/students/${student1AdminId}/profile/batch`)
      .send({ fields: [{ fieldId: testFieldId, value: "Batch Valid Entry" }] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const profileRes = await adminAgent.get(`/api/students/${student1AdminId}/profile`);
    expect(profileRes.status).toBe(200);
    const saved = profileRes.body.find((f: any) => f.fieldId === testFieldId);
    expect(saved?.value).toBe("Batch Valid Entry");
  });

  it("batch: returns 403 when counselor tries to batch-update a student not assigned to them", async () => {
    const res = await counselorAgent
      .put(`/api/students/${student2AdminId}/profile/batch`)
      .send({ fields: [{ fieldId: testFieldId, value: "Should be blocked" }] });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  // --- Student-role isConfirmed guard tests ---

  it("student: can update their own unconfirmed profile field (200)", async () => {
    const res = await student1Agent.put(`/api/students/0/profile`).send({
      fieldId: testFieldId,
      value: "Student entry",
    });
    expect(res.status).toBe(200);
  });

  it("student: cannot update a confirmed profile field (400)", async () => {
    const confirmRes = await student1Agent.put(`/api/students/0/profile/${testFieldId}/confirm`);
    expect(confirmRes.status).toBe(200);

    const res = await student1Agent.put(`/api/students/0/profile`).send({
      fieldId: testFieldId,
      value: "Overwrite attempt",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/confirmed/i);
  });
});
