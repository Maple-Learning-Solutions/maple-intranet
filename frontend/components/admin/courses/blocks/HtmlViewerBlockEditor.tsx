"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Link2 } from "lucide-react";

export default function HtmlViewerBlockEditor({ block, onUpdate }: { block: any, onUpdate: (data: any) => void }) {
  const metadata = block.metadata_json || {};
  const [url, setUrl] = useState(metadata.url || "");

  const handleSave = () => {
    onUpdate({ metadata_json: { ...metadata, url } });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-5 h-5 text-brand-green" />
        <h3 className="font-semibold text-ink">HTML / Course Link Viewer</h3>
      </div>
      
      <p className="text-sm text-slate-500">
        Enter the URL of the published course or HTML page you want to embed. 
        It will be displayed full-width in the course player without paddings.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Link URL</label>
        <div className="flex gap-2">
          <input 
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/published-course.html"
            className="flex-1 px-3 py-2 border border-input rounded-lg focus:border-brand-green outline-none"
          />
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Save Link
          </button>
        </div>
      </div>
      
      {metadata.url && (
        <div className="mt-4 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
          <p className="text-sm text-brand-green font-medium">Currently embedded:</p>
          <a href={metadata.url} target="_blank" rel="noreferrer" className="text-xs text-brand-teal-deep hover:underline truncate block mt-1">
            {metadata.url}
          </a>
        </div>
      )}
    </div>
  );
}
