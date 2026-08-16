import { getStore, nextId, isAuthorized, jsonError, type MockUser } from "../_lib/store";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);
  return Response.json(getStore().users);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.username || !body?.password) {
    return jsonError("name, username and password are required", 422);
  }

  const user: MockUser = {
    id: nextId("user"),
    name: body.name,
    username: body.username,
    role: body.role || "admin",
  };

  getStore().users.push(user);
  return Response.json(user, { status: 201 });
}
