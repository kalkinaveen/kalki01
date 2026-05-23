import React from 'react';
import { TOOLS } from '../mock';
import { Download, Terminal } from 'lucide-react';
import { toast } from 'sonner';

const ToolsPage = () => {
  const onDownload = (t) => {
    toast.success('Download queued', { description: `${t.name} · ${t.size}` });
  };
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// ARSENAL</div>
          <h1 className="eh-display text-4xl md:text-6xl font-black">HACKING <span className="eh-neon">TOOLS</span></h1>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">For research and authorized testing only. Always operate within legal boundaries.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map(t => (
            <div key={t.id} className="eh-card eh-panel eh-brackets p-6">
              <span className="br-bl" /><span className="br-br" />
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-md grid place-items-center" style={{ background:'rgba(0,255,157,.08)', border:'1px solid rgba(0,255,157,.25)' }}><Terminal size={20} color="var(--eh-green)" /></div>
                <span className="eh-mono text-[10px] tracking-widest opacity-70">{t.category}</span>
              </div>
              <div className="text-base font-semibold leading-snug mb-1" style={{ fontFamily:'Inter,sans-serif' }}>{t.name}</div>
              <p className="text-sm opacity-70 leading-6 mb-4">{t.desc}</p>
              <div className="flex items-center justify-between eh-mono text-xs opacity-70 mb-4"><span>size : {t.size}</span><span>dl : {t.downloads.toLocaleString()}</span></div>
              <button onClick={()=>onDownload(t)} className="eh-btn-primary w-full text-xs"><Download size={14} /> DOWNLOAD</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ToolsPage;
