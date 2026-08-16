import { getStore, nextId, isAuthorized, jsonError, type MockPayment } from "../_lib/store";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("child_id");
  const status = searchParams.get("status");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  let payments = getStore().payments;
  if (childId) payments = payments.filter((p) => p.child_id === childId);
  if (status) payments = payments.filter((p) => p.status === status);
  if (month) payments = payments.filter((p) => p.month === month);
  if (year) payments = payments.filter((p) => p.year === parseInt(year, 10));

  return Response.json(payments);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const body = await request.json().catch(() => null);
  if (!body?.child_id || !body?.amount || !body?.month || !body?.year) {
    return jsonError("child_id, amount, month and year are required", 422);
  }

  const payment: MockPayment = {
    id: nextId("p"),
    child_id: body.child_id,
    amount: body.amount,
    month: body.month,
    year: body.year,
    status: body.status || "pending",
    due_date: body.due_date || `${body.year}-01-01`,
    paid_date: body.paid_date || null,
  };

  getStore().payments.push(payment);
  return Response.json(payment, { status: 201 });
}
