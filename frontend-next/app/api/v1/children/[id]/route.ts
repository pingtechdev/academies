import { getStore, isAuthorized, jsonError } from "../../_lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const child = getStore().children.find((c) => c.id === id);
  if (!child) return jsonError("Child not found", 404);
  return Response.json(child);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const store = getStore();
  const index = store.children.findIndex((c) => c.id === id);
  if (index === -1) return jsonError("Child not found", 404);

  const body = await request.json().catch(() => ({}));
  store.children[index] = { ...store.children[index], ...body };
  return Response.json(store.children[index]);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const store = getStore();
  const index = store.children.findIndex((c) => c.id === id);
  if (index === -1) return jsonError("Child not found", 404);

  store.children.splice(index, 1);
  store.payments = store.payments.filter((p) => p.child_id !== id);
  return new Response(null, { status: 204 });
}
