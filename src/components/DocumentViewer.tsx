import { FileText } from 'lucide-react';
import { gatewayUrl } from '@/lib/ipfs';

interface Props {
  cid: string | null;
  filename: string | null;
}

export function DocumentViewer({ cid, filename }: Props) {
  if (!cid) {
    return <div className="text-sm text-slate-500">No documents uploaded yet.</div>;
  }
  return (
    <a
      href={gatewayUrl(cid)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
    >
      <FileText size={16} />
      <span>{filename ?? cid.slice(0, 12)}</span>
    </a>
  );
}
