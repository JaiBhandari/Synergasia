import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string | null;
      role: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
}

export {};