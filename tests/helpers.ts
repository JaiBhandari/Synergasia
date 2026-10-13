import supertest from "supertest";

export const BASE_URL = "http://localhost:5000";
export const request = supertest(BASE_URL);

export const DEVELOPER = {
  email: "developer@synergasia.com",
  password: "dev123",
};

export const TEST_ADMIN = {
  email: `testadmin_${Date.now()}@synergasia-test.local`,
  password: "TestAdmin999!",
  firstName: "TestAdmin",
  lastName: "Automated",
};

export async function getLoggedInAgent(email: string, password: string): Promise<supertest.Agent> {
  const agent = supertest.agent(BASE_URL);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export function randomEmail() {
  return `testuser_${Date.now()}_${Math.random().toString(36).slice(2)}@synergasia-test.local`;
}

export function randomName() {
  return `Test${Math.random().toString(36).slice(2, 8)}`;
}
