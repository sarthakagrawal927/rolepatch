import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { endpointUrl, apiKey } = await request.json();

    if (!endpointUrl) {
      return NextResponse.json(
        { error: 'Endpoint URL is required' },
        { status: 400 },
      );
    }

    // Normalize: strip trailing slash, then append /models
    const base = endpointUrl.replace(/\/+$/, '');
    const modelsUrl = `${base}/models`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(modelsUrl, { headers });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${res.status} ${res.statusText}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    // OpenAI-compatible APIs return { data: [{ id: "model-name", ... }] }
    const models: string[] = Array.isArray(data?.data)
      ? data.data.map((m: { id: string }) => m.id).filter(Boolean)
      : [];

    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
