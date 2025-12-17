
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Draft_Budget_2022_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm2', name: 'Draft_Budget_2022_FINAL.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm3', name: 'Raw_Video_Archive.mp4', size: '3200000000', mimeType: 'video/mp4', modifiedTime: '2023-11-20T15:30:00Z' },
  { id: 'm4', name: 'Temp_Backup.zip', size: '850000000', mimeType: 'application/zip', modifiedTime: '2024-01-10T09:15:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("Standby...");
  const [error, setError] = useState<{title: string, msg: string} | null>(null);

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
    setAgentMessage("Scanning file hierarchy...");
    try {
      const fetchedFiles = await driveService.listFiles();
      setFiles(fetchedFiles);
      setState(AppState.ANALYZING);
      setAgentMessage("AI is reviewing your storage...");
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.filter(c => c.confidence > 0.7).map(c => c.id)));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      setError({ title: "Scan Failed", msg: err.message });
      setState(AppState.LANDING);
    }
  };

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (isDemo) {
      setFiles(MOCK_FILES);
      setState(AppState.ANALYZING);
      const analysis = await analyzeFilesWithGemini(MOCK_FILES);
      setCandidates(analysis.candidates);
      setSelectedIds(new Set(analysis.candidates.map(c => c.id)));
      setState(AppState.REVIEWING);
      return;
    }

    try {
      await driveService.login();
    } catch (e: any) {
      setError({ title: "Auth Error", msg: e.message });
    }
  };

  const handleCleanup = async () => {
    setState(AppState.TRASHING);
    try {
      for (const id of Array.from(selectedIds)) {
        await driveService.trashFile(id);
      }
      setState(AppState.COMPLETED);
    } catch (err: any) {
      setError({ title: "Cleanup Error", msg: err.message });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-5 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">P</div>
          <span className="text-xl font-black tracking-tight">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>
        {state === AppState.REVIEWING && (
          <button onClick={handleCleanup} disabled={selectedIds.size === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold shadow-xl transition-all active:scale-95 disabled:opacity-50">
            Purge Selected ({selectedIds.size})
          </button>
        )}
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && !error && (
            <div className="py-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h1 className="text-6xl font-black text-slate-900 leading-tight mb-6 tracking-tighter">
                    Clean your Drive <br/> with <span className="text-indigo-600">AI Intelligence.</span>
                </h1>
                <p className="text-xl text-slate-500 mb-12">The first agent that actually understands what a "duplicate" is.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl">Connect Google Drive</button>
                    <button onClick={() => startAnalysis(true)} className="bg-white border border-slate-200 text-slate-400 px-10 py-5 rounded-2xl font-black text-xl hover:border-indigo-600 hover:text-indigo-600 transition-all">Demo Mode</button>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl font-black text-slate-800">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in duration-500">
              <h3 className="text-3xl font-black mb-8">Review Recommendations</h3>
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
            <div className="py-20 text-center">
                <div className="text-7xl mb-6">✨</div>
                <h2 className="text-4xl font-black mb-4">Cleanup Complete!</h2>
                <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">Start New Audit</button>
            </div>
        )}

        {error && (
            <div className="max-w-2xl mx-auto p-8 bg-white border-2 border-rose-100 rounded-[32px] shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">🛑</span>
                  <h4 className="text-2xl font-black text-rose-900">Connection Blocked</h4>
                </div>
                
                <div className="space-y-6 text-slate-600">
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                        <p className="font-bold text-rose-800 mb-1">Check your Browser Settings:</p>
                        <p className="text-sm">Go to Settings > Privacy > Cookies and ensure <strong>"Block third-party cookies"</strong> is turned OFF.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-bold text-slate-800 mb-1">Verify Google Origin:</p>
                        <p className="text-sm mb-3">Copy this EXACT string into your Google Console "Authorized JavaScript origins":</p>
                        <code className="block bg-white p-3 rounded border font-mono text-xs select-all">{window.location.origin}</code>
                    </div>

                    <button onClick={() => setError(null)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm">Retry Connection</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
