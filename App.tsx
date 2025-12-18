
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Draft_Budget_v1_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm2', name: 'Draft_Budget_v1_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm3', name: '4K_Drone_Footage_Archive.mp4', size: '3200000000', mimeType: 'video/mp4', modifiedTime: '2023-11-20T15:30:00Z' },
  { id: 'm4', name: 'Old_Log_Backup_2019.zip', size: '850000000', mimeType: 'application/zip', modifiedTime: '2019-05-15T09:00:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("System standby...");
  const [error, setError] = useState<{title: string, msg: string, code?: string} | null>(null);

  useEffect(() => {
    driveService.init((authStatus) => {
      setIsAuthenticated(authStatus);
      if (authStatus) {
        setAgentMessage("Drive access granted. Ready to audit.");
        startScan();
      }
    });
  }, []);

  const startScan = async () => {
    setState(AppState.SCANNING);
    setAgentMessage("Auditing file hierarchy...");
    try {
      const fetchedFiles = await driveService.listFiles();
      setFiles(fetchedFiles);
      setState(AppState.ANALYZING);
      setAgentMessage("AI Agent reasoning over metadata...");
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.filter(c => c.confidence > 0.7).map(c => c.id)));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    // Fix: Safely handle error as unknown type to extract a string message
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ title: "Analysis Interrupted", msg: msg || "Failed to parse files." });
      setState(AppState.LANDING);
    }
  };

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (isDemo) {
      setState(AppState.ANALYZING);
      setAgentMessage("Simulating audit with mock data...");
      setFiles(MOCK_FILES);
      try {
        const analysis = await analyzeFilesWithGemini(MOCK_FILES);
        setCandidates(analysis.candidates);
        setSelectedIds(new Set(analysis.candidates.map(c => c.id)));
        setAgentMessage(analysis.summary);
        setState(AppState.REVIEWING);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError({ title: "Demo Audit Failed", msg: msg || "Simulation error." });
        setState(AppState.LANDING);
      }
      return;
    }

    try {
      await driveService.login();
    // Fix: Safely handle error from login popup
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError({ 
        title: "Google Access Blocked", 
        msg: "The login popup failed to send the authorization token back to this app.",
        code: msg 
      });
    }
  };

  const handleCleanup = async () => {
    setState(AppState.TRASHING);
    setAgentMessage(`Trashing ${selectedIds.size} objects...`);
    try {
      for (const id of Array.from(selectedIds)) {
        await driveService.trashFile(id);
      }
      setState(AppState.COMPLETED);
    // Fix: Handle trashing errors safely
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ title: "Cleanup Failed", msg: msg || "Operation failed." });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fcfdfe] text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:rotate-6 transition-transform">P</div>
          <span className="text-xl font-black tracking-tight">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>
        {state === AppState.REVIEWING && (
          <button 
            onClick={handleCleanup} 
            disabled={selectedIds.size === 0} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-bold shadow-2xl transition-all active:scale-95 disabled:opacity-50"
          >
            Execute Purge ({selectedIds.size})
          </button>
        )}
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && !error && (
            <div className="py-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-8">Storage Intelligence Agent</div>
                    <h1 className="text-7xl font-black text-slate-900 leading-[1.05] mb-8 tracking-tighter">
                        Reclaim your <br/> space with <span className="text-indigo-600">AI.</span>
                    </h1>
                    <p className="text-xl text-slate-500 mb-12 max-w-xl leading-relaxed">
                      DrivePurge audits your file metadata to identify redundant drafts, abandoned backups, and hidden storage hogs.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6">
                        <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3">
                          <img src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png" className="w-6 h-6 bg-white rounded-full p-1" />
                          Connect Drive
                        </button>
                        <button onClick={() => startAnalysis(true)} className="bg-white border-2 border-slate-100 text-slate-400 px-12 py-6 rounded-3xl font-black text-xl hover:border-indigo-100 hover:text-indigo-600 transition-all">Demo Audit</button>
                    </div>
                  </div>
                  <div className="hidden lg:block relative">
                    <div className="w-full aspect-square bg-indigo-50 rounded-[60px] flex items-center justify-center animate-pulse">
                      <span className="text-[120px]">🧠</span>
                    </div>
                    <div className="absolute -bottom-6 -right-6 glass-panel p-8 rounded-3xl shadow-xl max-w-xs border-indigo-100">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Agent Status</p>
                      <p className="text-indigo-600 font-black text-lg">System Initialized & Ready.</p>
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
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{agentMessage}</h2>
            <p className="text-slate-400 mt-4 font-medium italic">Please keep this window open...</p>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h3 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Audit Findings</h3>
                  <p className="text-slate-500 font-medium">{agentMessage}</p>
                </div>
                <div className="px-8 py-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Items Flagged</span>
                  <span className="text-3xl font-black text-indigo-600">{selectedIds.size}</span>
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
                <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Space Reclaimed.</h2>
                <p className="text-xl text-slate-500 mb-12">Your Drive is now leaner and better organized.</p>
                <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl">Start New Audit</button>
            </div>
        )}

        {error && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-top-12 duration-700">
                <div className="p-12 bg-white border-2 border-rose-100 rounded-[56px] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10 text-[180px] pointer-events-none">⚠️</div>
                    
                    <div className="flex items-center gap-6 mb-10">
                      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-4xl shadow-sm">🛑</div>
                      <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{error.title}</h4>
                    </div>
                    
                    <div className="space-y-12">
                        <div className="p-8 bg-rose-50 rounded-3xl border border-rose-100">
                            <p className="font-bold text-rose-900 text-lg mb-3">Diagnostic Message:</p>
                            <p className="text-rose-800 leading-relaxed font-medium">{error.msg}</p>
                            {error.code && <code className="block mt-4 p-4 bg-white/60 rounded-xl text-xs font-mono text-rose-600 overflow-x-auto whitespace-pre">{error.code}</code>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <h5 className="font-black text-slate-900 flex items-center gap-3">
                                    <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                                    The "Cookie" Fix
                                </h5>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                  Go to your Browser Settings and <strong>Disable "Block third-party cookies"</strong>. Google needs these to pass the login token from the popup window back to this app.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h5 className="font-black text-slate-900 flex items-center gap-3">
                                    <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                                    Authorized Origin
                                </h5>
                                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                                  Ensure this EXACT URL is added to your Google Cloud Console "Authorized JavaScript Origins":
                                </p>
                                <div className="flex items-center gap-3 bg-slate-100 p-4 rounded-2xl border border-slate-200">
                                  <code className="flex-1 font-mono text-xs text-indigo-600 truncate">{window.location.origin}</code>
                                  <button onClick={() => navigator.clipboard.writeText(window.location.origin)} className="text-[10px] font-black text-indigo-600 hover:bg-white px-3 py-1.5 rounded-lg transition-colors">COPY</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <button onClick={() => window.location.reload()} className="flex-1 bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-indigo-600 transition-all shadow-xl">Retry Connection</button>
                          <button onClick={() => startAnalysis(true)} className="flex-1 bg-white border-2 border-slate-200 text-slate-400 py-6 rounded-3xl font-black uppercase tracking-widest text-sm hover:border-indigo-600 hover:text-indigo-600 transition-all">Launch Demo Audit</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
