import { getStore, nextId, isAuthorized, jsonError, type MockChild } from "../_lib/store";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const search = searchParams.get("search")?.toLowerCase();

  let children = getStore().children;
  if (level) children = children.filter((c) => c.level === level);
  if (search) children = children.filter((c) => c.name.toLowerCase().includes(search));

  return Response.json(children);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("Not authenticated", 401);

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.date_of_birth || !body?.level) {
    return jsonError("name, date_of_birth and level are required", 422);
  }

  const child: MockChild = {
    id: nextId("c"),
    name: body.name,
    date_of_birth: body.date_of_birth,
    level: body.level,
    has_kit: !!body.has_kit,
    is_active: true,
    join_date: body.join_date || new Date().toISOString().split("T")[0],
  };

  getStore().children.push(child);
  return Response.json(child, { status: 201 });
}
