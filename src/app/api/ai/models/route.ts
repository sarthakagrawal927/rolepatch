import { handleModelsRequest } from '@saas-maker/ai/server';

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json(await handleModelsRequest(body));
}
