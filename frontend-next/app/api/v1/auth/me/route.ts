import { MOCK_USER, isAuthorized, jsonError } from "../../_lib/store";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonError("Not authenticated", 401);
  }
  return Response.json(MOCK_USER);
}
