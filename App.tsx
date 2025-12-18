
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Draft_Proposal_v1_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm2', name: 'Draft_Proposal_v1_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm3', name: 'Raw_Video_Archive_2023.mp4', size: '4200000000', mimeType: 'video/mp4', modifiedTime: '2023-11-20T15:30:00Z' },
  { id: 'm4', name: 'Legacy_Database_Backup.sql', size: '1850000000', mimeType: 'text/plain', modifiedTime: '2021-02-15T09:00:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("System standby...");
  const [error, setError] = useState<{title: string, msg: string, code?: string} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempClientId, setTempClientId] = useState(driveService.getClientId());

  useEffect(() => {
    driveService.init((authStatus) => {
      if (authStatus) {
        startScan();
      }
    });
  }, []);

  const startScan = async () => {
    setState(AppState.SCANNING);
    setAgentMessage("Performing deep audit of file metadata...");
    try {
      const fetchedFiles = await driveService.listFiles();
      setFiles(fetchedFiles);
      setState(AppState.ANALYZING);
      setAgentMessage("Agent is reasoning about storage redundancy...");
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.filter(c => c.confidence > 0.7).map(c => c.id)));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    } catch (err: unknown) {
      // Safely narrow the unknown error type to a string.
      const msg = err instanceof Error ? err.message : String(err);
      setError({ title: "Audit Interrupted", msg: msg });
      setState(AppState.LANDING);
    }
  };

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (isDemo) {
      setState(AppState.ANALYZING);
      setAgentMessage("Simulating audit with sample data...");
      setFiles(MOCK_FILES);
      try {
        const analysis = await analyzeFilesWithGemini(MOCK_FILES);
        setCandidates(analysis.candidates);
        setSelectedIds(new Set(analysis.candidates.map(c => c.id)));
        setAgentMessage(analysis.summary);
        setState(AppState.REVIEWING);
      } catch (err: unknown) {
        // Fix for potential line 90 error: ensure caught error is explicitly handled as string.
        const msg = err instanceof Error ? err.message : String(err);
        setError({ title: "Demo Failed", msg: msg });
        setState(AppState.LANDING);
      }
      return;
    }

    try {
      await driveService.login();
    } catch (e: unknown) {
      // Safely handle the error from Google Identity Services.
      const msg = e instanceof Error ? e.message : String(e);
      setError({ 
        title: "Connection Failed", 
        msg: "The Google login could not be completed. This is often caused by an unauthorized Client ID or blocked third-party cookies.",
        code: msg 
      });
    }
  };

  const handleCleanup = async () => {
    setState(AppState.TRASHING);
    setAgentMessage(`Trashing ${selectedIds.size} flagged items...`);
    try {
      for (const id of Array.from(selectedIds)) {
        await driveService.trashFile(id);
      }
      setState(AppState.COMPLETED);
    } catch (err: unknown) {
      // Safely narrow the unknown error type to a string for UI display.
      const msg = err instanceof Error ? err.message : String(err);
      setError({ title: "Purge Failed", msg: msg });
      setState(AppState.REVIEWING);
    }
  };

  const saveSettings = () => {
    driveService.setClientId(tempClientId);
    setIsSettingsOpen(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fcfdfe] text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform group-hover:rotate-6">P</div>
          <span className="text-xl font-black tracking-tight">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            title="Configure Client ID"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          {state === AppState.REVIEWING && (
            <button 
              onClick={handleCleanup} 
              disabled={selectedIds.size === 0} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-bold shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              Start Purge ({selectedIds.size})
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && !error && (
            <div className="py-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-8">Storage Intelligence Agent</div>
                    <h1 className="text-7xl font-black text-slate-900 leading-[1.05] mb-8 tracking-tighter">
                        Reclaim space <br/> with <span className="text-indigo-600">AI reasoning.</span>
                    </h1>
                    <p className="text-xl text-slate-500 mb-12 max-w-xl leading-relaxed">
                      Audits your file metadata to identify redundant drafts, abandoned backups, and massive hidden files you forgot existed.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6">
                        <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3">
                          Connect Google Drive
                        </button>
                        <button onClick={() => startAnalysis(true)} className="bg-white border-2 border-slate-100 text-slate-400 px-12 py-6 rounded-3xl font-black text-xl hover:border-indigo-100 hover:text-indigo-600 transition-all">Launch Demo Audit</button>
                    </div>
                  </div>
                  <div className="hidden lg:flex items-center justify-center relative">
                    <div className="w-80 h-80 bg-indigo-600 rounded-[60px] rotate-6 absolute opacity-10"></div>
                    <div className="w-80 h-80 bg-white border-2 border-indigo-100 rounded-[60px] shadow-2xl flex items-center justify-center relative">
                      <span className="text-[120px]">📂</span>
                    </div>
                  </div>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="relative w-24 h-24 mb-12">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{agentMessage}</h2>
            <p className="text-slate-400 font-medium italic">Gemini is processing metadata...</p>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h3 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Audit Report</h3>
                  <p className="text-slate-500 font-medium max-w-2xl">{agentMessage}</p>
                </div>
                <div className="px-8 py-5 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Target List</span>
                  <span className="text-3xl font-black text-indigo-600">{selectedIds.size} Files</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((c) => {
                  const file = files.find(f => f.id === c.id);
                  return file ? <FileCard key={file.id} file={file} candidate={c} onSelect={(id) => {
                    const next = new Set(selectedIds);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedIds(next);
                  }} isSelected={selectedIds.has(file.id)} /> : null;
                })}
              </div>
          </div>
        )}

        {state === AppState.COMPLETED && (
            <div className="py-32 text-center animate-in zoom-in duration-700">
                <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-6xl mx-auto mb-12 shadow-inner">✨</div>
                <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Mission Accomplished.</h2>
                <p className="text-xl text-slate-500 mb-12">Drive assets have been relocated to the Trash.</p>
                <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl">Run New Audit</button>
            </div>
        )}

        {error && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-top-12 duration-700">
                <div className="p-12 bg-white border-2 border-rose-100 rounded-[56px] shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-12 opacity-5 text-[200px] pointer-events-none">🛠️</div>
                    
                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter mb-10 flex items-center gap-4">
                      <span className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl">!</span>
                      {error.title}
                    </h4>
                    
                    <div className="space-y-12 relative z-10">
                        <div className="p-8 bg-rose-50 rounded-3xl border border-rose-100 text-rose-900 font-medium">
                            <p className="mb-2 font-bold">Details:</p>
                            <p>{error.msg}</p>
                            {error.code && <code className="block mt-4 p-4 bg-white/60 rounded-xl text-[10px] font-mono whitespace-pre-wrap">{error.code}</code>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                                <h5 className="font-black text-indigo-600 uppercase text-xs tracking-widest mb-4">Step 1: Custom Client ID</h5>
                                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                  Google requires a Client ID from your OWN project. Create a <strong>Web Client ID</strong> in the Google Cloud Console.
                                </p>
                                <button onClick={() => setIsSettingsOpen(true)} className="text-xs font-black text-indigo-600 hover:underline">Update Client ID in Settings →</button>
                            </div>
                            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                                <h5 className="font-black text-indigo-600 uppercase text-xs tracking-widest mb-4">Step 2: Authorized Origin</h5>
                                <p className="text-sm text-slate-500 leading-relaxed mb-4">Add this exact URL to your <strong>Authorized JavaScript Origins</strong>:</p>
                                <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                  <code className="text-[10px] flex-1 truncate font-mono">{window.location.origin}</code>
                                  <button onClick={() => navigator.clipboard.writeText(window.location.origin)} className="text-[10px] font-bold text-indigo-600">COPY</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                          <button onClick={() => window.location.reload()} className="flex-1 bg-slate-900 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Try Again</button>
                          <button onClick={() => startAnalysis(true)} className="flex-1 bg-white border-2 border-slate-200 text-slate-400 py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all">Run Demo (Offline)</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Setup Configuration</h3>
            <p className="text-slate-500 text-sm mb-8">Paste your Google Cloud OAuth 2.0 Client ID here.</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3">Google Client ID</label>
                <input 
                  type="text" 
                  value={tempClientId} 
                  onChange={(e) => setTempClientId(e.target.value)} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-mono text-sm focus:border-indigo-600 outline-none transition-all"
                  placeholder="226301323416-..."
                />
              </div>
              
              <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  <strong>Note:</strong> After saving, the app will reload. Ensure your project's <strong>OAuth Consent Screen</strong> is set to "External" and you have added yourself as a <strong>Test User</strong> if the app is not published.
                </p>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsSettingsOpen(false)} className="flex-1 px-8 py-4 font-bold text-slate-400">Cancel</button>
                <button onClick={saveSettings} className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">Save & Reload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
