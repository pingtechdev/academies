import { MOCK_TOKEN, MOCK_USER, jsonError } from "../../_lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;

  if (username !== "admin" || password !== "admin123") {
    return jsonError("Incorrect username or password", 401);
  }

  return Response.json({
    access_token: MOCK_TOKEN,
    token_type: "bearer",
    user: MOCK_USER,
  });
}
