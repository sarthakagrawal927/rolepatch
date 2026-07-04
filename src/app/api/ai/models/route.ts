import { fetchModels } from '@/lib/ai-vendor';
import { parseJsonObjectInput } from '@/lib/json-route-input';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseJsonObjectInput(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const endpointUrl =
    typeof parsed.body.endpointUrl === 'string' ? parsed.body.endpointUrl.trim() : '';
  const apiKey = typeof parsed.body.apiKey === 'string' ? parsed.body.apiKey.trim() : '';
  const models = await fetchModels(endpointUrl, apiKey);
  return Response.json({ models });
}
