import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Draft_Budget_2022_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm2', name: 'Draft_Budget_2022_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  // Fix: Wrapped 'video/mp4' in quotes to fix "Cannot find name 'video'" and "Type 'number' is not assignable to type 'string'" errors.
  { id: 'm3', name: '4K_Drone_Footage_Archive.mp4', size: '3200000000', mimeType: 'video/mp4', modifiedTime: '2023-11-20T15:30:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("Initializing...");
  const [error, setError] = useState<{title: string, msg: string, code?: string} | null>(null);

  useEffect(() => {
    driveService.init((authStatus) => {
      setIsAuthenticated(authStatus);
      if (authStatus) {
        setState(AppState.SCANNING);
        startScan();
      }
    });
  }, []);

  const startScan = async () => {
    setAgentMessage("Auditing your Drive hierarchy...");
    try {
      const fetchedFiles = await driveService.listFiles();
      setFiles(fetchedFiles);
      setState(AppState.ANALYZING);
      setAgentMessage("AI is reviewing file metadata...");
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.filter(c => c.confidence > 0.7).map(c => c.id)));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      console.error("Scan Error:", err);
      setError({ title: "Operation Interrupted", msg: err.message || "An unexpected error occurred during the scan." });
      setState(AppState.LANDING);
    }
  };

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (isDemo) {
      setFiles(MOCK_FILES);
      setState(AppState.ANALYZING);
      setAgentMessage("Running demo audit...");
      const analysis = await analyzeFilesWithGemini(MOCK_FILES);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.map(c => c.id)));
      setState(AppState.REVIEWING);
      return;
    }

    try {
      await driveService.login();
    } catch (e: any) {
      setError({ 
        title: "Connection Blocked", 
        msg: "The Google login popup failed to communicate with this app. This is common when running in restricted environments or if third-party cookies are blocked.",
        code: e.message 
      });
    }
  };

  const handleCleanup = async () => {
    if (selectedIds.size === 0) return;
    setState(AppState.TRASHING);
    setAgentMessage(`Trashing ${selectedIds.size} files...`);
    try {
      for (const id of Array.from(selectedIds)) {
        await driveService.trashFile(id);
      }
      setState(AppState.COMPLETED);
    } catch (err: any) {
      setError({ title: "Cleanup Failed", msg: err.message });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe] text-slate-900">
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
            Purge Selected ({selectedIds.size})
          </button>
        )}
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && !error && (
            <div className="py-24 text-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-8">Next-Gen Storage Cleanup</div>
                <h1 className="text-7xl font-black text-slate-900 leading-[1.1] mb-8 tracking-tighter">
                    Reclaim space with <br/> <span className="text-indigo-600">AI reasoning.</span>
                </h1>
                <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
                  DrivePurge uses Gemini 3 to identify redundant drafts, oversized video clips, and ancient files you forgot existed.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-6">
                    <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl hover:-translate-y-1">Connect Google Drive</button>
                    <button onClick={() => startAnalysis(true)} className="bg-white border-2 border-slate-100 text-slate-400 px-12 py-6 rounded-3xl font-black text-xl hover:border-indigo-100 hover:text-indigo-600 transition-all">Try Demo</button>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 border-[6px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-10"></div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h3 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Audit Summary</h3>
                  <p className="text-slate-500 font-medium">{agentMessage}</p>
                </div>
                <div className="px-6 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">Targeting</span>
                  <span className="text-2xl font-black text-indigo-600">{selectedIds.size} Files</span>
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
            <div className="py-24 text-center animate-in zoom-in duration-500">
                <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-6xl mx-auto mb-10 shadow-inner">✨</div>
                <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Cleanup Successful</h2>
                <p className="text-lg text-slate-500 mb-12">Your Drive is now leaner and better organized.</p>
                <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl">Start New Audit</button>
            </div>
        )}

        {error && (
            <div className="max-w-3xl mx-auto p-12 bg-white border-2 border-rose-100 rounded-[48px] shadow-2xl animate-in slide-in-from-top-8 duration-700">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-4xl shadow-sm">🛑</div>
                  <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{error.title}</h4>
                </div>
                
                <div className="space-y-10">
                    <div className="p-8 bg-rose-50 rounded-3xl border border-rose-100">
                        <p className="font-bold text-rose-900 text-lg mb-3">What happened?</p>
                        <p className="text-rose-800 leading-relaxed font-medium">{error.msg}</p>
                        {error.code && <code className="block mt-4 p-3 bg-white/50 rounded-lg text-xs font-mono text-rose-600">{error.code}</code>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h5 className="font-black text-slate-900 flex items-center gap-2">
                                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                                Browser Settings
                            </h5>
                            <p className="text-sm text-slate-500 leading-relaxed">
                              Ensure <strong>"Block third-party cookies"</strong> is disabled in your browser settings. Google uses these for cross-window communication.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <h5 className="font-black text-slate-900 flex items-center gap-2">
                                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                                Console Setup
                            </h5>
                            <p className="text-sm text-slate-500 leading-relaxed">
                              Verify that this EXACT origin is added to your Authorized JavaScript Origins in the Google Cloud Console:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-slate-100 p-3 rounded-xl font-mono text-[11px] text-indigo-600 truncate">{window.location.origin}</code>
                              <button onClick={() => navigator.clipboard.writeText(window.location.origin)} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Copy</button>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setError(null)} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-indigo-600 transition-all shadow-xl">Return to Dashboard</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;