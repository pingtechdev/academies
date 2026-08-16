import { getStore, nextId, isAuthorized, jsonError, type MockLevel } from "../_lib/store";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  return Response.json(getStore().levels);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const body = await request.json().catch(() => null);
  if (!body?.name) return jsonError("name is required", 422);

  const level: MockLevel = {
    id: nextId("level"),
    name: body.name,
    description: body.description,
  };

  getStore().levels.push(level);
  return Response.json(level, { status: 201 });
}
