import { fetchModels } from '@/lib/ai-vendor';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { endpointUrl?: string; apiKey?: string };
  const models = await fetchModels(body.endpointUrl ?? '', body.apiKey ?? '');
  return Response.json({ models });
}
