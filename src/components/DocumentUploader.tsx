'use client';

import { useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  dealId: string;
  onUploaded?: (cid: string, filename: string) => void;
}

export function DocumentUploader({ dealId, onUploaded }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/deals/${dealId}/documents`, { method: 'POST', body });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      // TODO(documents): expect { cid, filename } from the route once implemented.
      const data = (await res.json()) as { cid?: string; filename?: string };
      if (data.cid && data.filename) onUploaded?.(data.cid, data.filename);
      toast.push('Document uploaded', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-slate-600 px-4 py-3 text-sm text-slate-300 hover:border-slate-400">
      <Upload size={16} />
      <span>{uploading ? 'Uploading…' : 'Upload shipping document'}</span>
      <input type="file" className="hidden" onChange={handleChange} disabled={uploading} accept="application/pdf,image/*" />
    </label>
  );
}
