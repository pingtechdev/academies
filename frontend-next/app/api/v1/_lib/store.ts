// In-memory mock backend for local UI preview (no real FastAPI server required).
// Data lives on `globalThis` so it survives Next.js dev-server hot reloads.

export const MOCK_TOKEN = "mock-dev-token";
export const MOCK_USER = {
  id: "user-1",
  username: "admin",
  role: "admin" as const,
  name: "Victory Admin",
};

export interface MockChild {
  id: string;
  name: string;
  date_of_birth: string;
  level: string;
  has_kit: boolean;
  is_active: boolean;
  join_date: string;
}

export interface MockPayment {
  id: string;
  child_id: string;
  amount: number;
  month: string;
  year: number;
  status: "paid" | "pending" | "overdue";
  due_date: string;
  paid_date: string | null;
}

export interface MockLevel {
  id: string;
  name: string;
  description?: string;
}

export interface MockUser {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface Store {
  children: MockChild[];
  payments: MockPayment[];
  levels: MockLevel[];
  users: MockUser[];
  nextId: number;
}

function seed(): Store {
  return {
    levels: [
      { id: "level-1", name: "beginner", description: "New to football fundamentals" },
      { id: "level-2", name: "intermediate", description: "Building core skills and match awareness" },
      { id: "level-3", name: "advanced", description: "Competitive players refining technique" },
    ],
    children: [
      { id: "c1", name: "Liam Carter", date_of_birth: "2015-03-12", level: "beginner", has_kit: true, is_active: true, join_date: "2025-01-15" },
      { id: "c2", name: "Sofia Martinez", date_of_birth: "2014-07-22", level: "intermediate", has_kit: true, is_active: true, join_date: "2025-02-10" },
      { id: "c3", name: "Noah Thompson", date_of_birth: "2013-11-05", level: "advanced", has_kit: false, is_active: true, join_date: "2025-03-01" },
      { id: "c4", name: "Ava Johnson", date_of_birth: "2016-01-30", level: "beginner", has_kit: false, is_active: true, join_date: "2025-05-20" },
      { id: "c5", name: "Ethan Brooks", date_of_birth: "2012-09-18", level: "advanced", has_kit: true, is_active: true, join_date: "2024-11-11" },
      { id: "c6", name: "Mia Rodriguez", date_of_birth: "2015-06-08", level: "intermediate", has_kit: true, is_active: false, join_date: "2024-08-14" },
      { id: "c7", name: "Lucas Bennett", date_of_birth: "2014-02-27", level: "intermediate", has_kit: false, is_active: true, join_date: "2026-04-02" },
      { id: "c8", name: "Zara Ahmed", date_of_birth: "2016-10-14", level: "beginner", has_kit: true, is_active: true, join_date: "2026-06-30" },
    ],
    payments: [
      { id: "p1", child_id: "c1", amount: 50, month: "June", year: 2026, status: "paid", due_date: "2026-06-01", paid_date: "2026-06-03" },
      { id: "p2", child_id: "c1", amount: 50, month: "July", year: 2026, status: "paid", due_date: "2026-07-01", paid_date: "2026-07-02" },
      { id: "p3", child_id: "c1", amount: 50, month: "August", year: 2026, status: "pending", due_date: "2026-08-01", paid_date: null },
      { id: "p4", child_id: "c2", amount: 60, month: "July", year: 2026, status: "paid", due_date: "2026-07-01", paid_date: "2026-07-05" },
      { id: "p5", child_id: "c2", amount: 60, month: "August", year: 2026, status: "overdue", due_date: "2026-08-01", paid_date: null },
      { id: "p6", child_id: "c3", amount: 70, month: "August", year: 2026, status: "pending", due_date: "2026-08-01", paid_date: null },
      { id: "p7", child_id: "c4", amount: 50, month: "August", year: 2026, status: "overdue", due_date: "2026-08-01", paid_date: null },
      { id: "p8", child_id: "c5", amount: 70, month: "July", year: 2026, status: "paid", due_date: "2026-07-01", paid_date: "2026-07-01" },
      { id: "p9", child_id: "c5", amount: 70, month: "August", year: 2026, status: "paid", due_date: "2026-08-01", paid_date: "2026-08-02" },
      { id: "p10", child_id: "c6", amount: 60, month: "August", year: 2026, status: "pending", due_date: "2026-08-01", paid_date: null },
      { id: "p11", child_id: "c7", amount: 60, month: "August", year: 2026, status: "paid", due_date: "2026-08-01", paid_date: "2026-08-10" },
      // c8 intentionally has no payments yet, to exercise the "no payments" placeholder row.
    ],
    users: [
      { id: "user-1", name: "Victory Admin", username: "admin", role: "admin" },
      { id: "user-2", name: "Coach Daniels", username: "jdaniels", role: "admin" },
    ],
    nextId: 100,
  };
}

const globalForStore = globalThis as unknown as { __mockStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__mockStore) {
    globalForStore.__mockStore = seed();
  }
  return globalForStore.__mockStore;
}

export function nextId(prefix: string): string {
  const store = getStore();
  store.nextId += 1;
  return `${prefix}-${store.nextId}`;
}

export function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${MOCK_TOKEN}`;
}

export function jsonError(message: string, status: number) {
  return Response.json({ detail: message }, { status });
}
