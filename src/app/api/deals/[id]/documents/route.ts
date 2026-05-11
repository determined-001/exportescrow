import { NextResponse } from 'next/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse<{ cid: string; filename: string } | { error: string }>> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  // TODO(documents): call uploadDocument(file) from lib/ipfs, update deals.document_cid/filename,
  // transition status to 'docs_submitted', emit an event row.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
