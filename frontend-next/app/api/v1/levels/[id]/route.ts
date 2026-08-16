import { getStore, isAuthorized, jsonError } from "../../_lib/store";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const store = getStore();
  const index = store.levels.findIndex((l) => l.id === id);
  if (index === -1) return jsonError("Level not found", 404);

  const body = await request.json().catch(() => ({}));
  store.levels[index] = { ...store.levels[index], ...body };
  return Response.json(store.levels[index]);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  const { id } = await params;

  const store = getStore();
  const level = store.levels.find((l) => l.id === id);
  if (!level) return jsonError("Level not found", 404);

  const inUse = store.children.some((c) => c.level === level.name);
  if (inUse) return jsonError("Cannot delete a level that is assigned to children", 400);

  store.levels = store.levels.filter((l) => l.id !== id);
  return new Response(null, { status: 204 });
}
