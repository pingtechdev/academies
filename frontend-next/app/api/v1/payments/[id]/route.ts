import { getStore, isAuthorized, jsonError } from "../../_lib/store";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const store = getStore();
  const index = store.payments.findIndex((p) => p.id === id);
  if (index === -1) return jsonError("Payment not found", 404);

  const body = await request.json().catch(() => ({}));
  store.payments[index] = { ...store.payments[index], ...body };
  return Response.json(store.payments[index]);
}
