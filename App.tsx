
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Annual_Report_2019_Draft.pdf', size: '12000000', mimeType: 'application/pdf', modifiedTime: '2019-03-12T10:00:00Z' },
  { id: 'm2', name: 'Annual_Report_2019_Draft.pdf', size: '12000000', mimeType: 'application/pdf', modifiedTime: '2019-03-12T10:00:00Z' },
  { id: 'm3', name: 'Event_Video_Raw_Unedited.mov', size: '2400000000', mimeType: 'video/quicktime', modifiedTime: '2021-11-20T15:30:00Z' },
  { id: 'm4', name: 'Temp_Backup_01.zip', size: '450000000', mimeType: 'application/zip', modifiedTime: '2022-04-10T09:15:00Z' },
  { id: 'm5', name: 'Old_Notes_v1.txt', size: '1500', mimeType: 'text/plain', modifiedTime: '2018-01-01T12:00:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("Initializing systems...");
  const [error, setError] = useState<{title: string, msg: string, origin: string} | null>(null);

  useEffect(() => {
    driveService.init((authStatus) => {
      setIsAuthenticated(authStatus);
      if (authStatus) {
        setAgentMessage("Drive authenticated. Ready for audit.");
      } else {
        setAgentMessage("Ready to audit your storage ecosystem.");
      }
    });
  }, []);

  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, f) => acc + (f.size ? parseInt(f.size) : 0), 0);
    const candidateSize = candidates.reduce((acc, c) => {
      const f = files.find(file => file.id === c.id);
      return acc + (f?.size ? parseInt(f.size) : 0);
    }, 0);
    return { totalSize, candidateSize };
  }, [files, candidates]);

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (!isDemo && !isAuthenticated) {
        try {
            await driveService.login();
            return; 
        } catch (e: any) {
            setError({
                title: "OAuth Validation Error",
                msg: e.message || "The login request was rejected by Google.",
                origin: window.location.origin
            });
            return;
        }
    }

    setState(AppState.SCANNING);
    setAgentMessage("Indexing metadata...");
    
    try {
      const fetchedFiles = isDemo ? MOCK_FILES : await driveService.listFiles();
      setFiles(fetchedFiles);
      
      setState(AppState.ANALYZING);
      setAgentMessage("AI Analysis in progress...");
      
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      
      const highConfidenceIds = analysis.candidates
        .filter(c => c.confidence > 0.8)
        .map(c => c.id);
        
      setSelectedIds(new Set(highConfidenceIds));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      setError({
          title: "Analysis Failure",
          msg: err.message || "Failed to process files.",
          origin: window.location.origin
      });
      setState(AppState.LANDING);
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
      const remainingFiles = files.filter(f => !selectedIds.has(f.id));
      const remainingCandidates = candidates.filter(c => !selectedIds.has(c.id));
      setFiles(remainingFiles);
      setCandidates(remainingCandidates);
      setSelectedIds(new Set());
      setState(AppState.COMPLETED);
    } catch (err: any) {
      setError({ title: "Cleanup Failed", msg: err.message, origin: window.location.origin });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setState(AppState.LANDING)}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span className="text-lg font-bold tracking-tight">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">Connected</div>
          )}
          {state === AppState.REVIEWING && (
            <button onClick={handleCleanup} disabled={selectedIds.size === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white px-6 py-2 rounded-full font-bold text-xs shadow-lg transition-all active:scale-95">
              Purge Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && (
            <div className="py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 leading-[1.1] mb-8">
                            Reclaim your storage <br/> with <span className="text-indigo-600">AI precision.</span>
                        </h1>
                        <p className="text-lg text-slate-500 mb-10 max-w-md">The intelligent agent that finds duplicates, ancient drafts, and hidden storage hogs.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1">
                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png" className="w-6 h-6 bg-white rounded-full p-1" alt=""/>
                                Get Started Free
                            </button>
                            <button onClick={() => startAnalysis(true)} className="bg-white border-2 border-slate-100 text-slate-500 px-10 py-5 rounded-2xl font-bold text-lg hover:border-slate-300">Try Demo Scan</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl font-bold text-slate-800">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Audit Findings</h3>
                <div className="flex gap-4">
                  <button onClick={() => setSelectedIds(new Set(candidates.map(c => c.id)))} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Select All</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-black text-slate-300 uppercase hover:underline">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.map((candidate) => {
                  const file = files.find(f => f.id === candidate.id);
                  return file ? (
                    <FileCard key={file.id} file={file} candidate={candidate} onSelect={(id) => {
                      const next = new Set(selectedIds);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setSelectedIds(next);
                    }} isSelected={selectedIds.has(file.id)} />
                  ) : null;
                })}
              </div>
          </div>
        )}

        {state === AppState.COMPLETED && (
            <div className="py-20 text-center animate-in zoom-in-95">
                <div className="text-6xl mb-8">✨</div>
                <h2 className="text-4xl font-black text-slate-900 mb-8">Storage Optimized!</h2>
                <button onClick={() => setState(AppState.LANDING)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all">Return to Dashboard</button>
            </div>
        )}

        {error && (
            <div className="mt-12 p-8 bg-rose-50 border border-rose-100 rounded-[32px] flex flex-col gap-6 animate-in slide-in-from-top-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">⚠️</span>
                  <div className="flex-1">
                      <h4 className="font-bold text-rose-900 text-xl">{error.title}</h4>
                      <p className="text-sm text-rose-700 leading-relaxed mt-1">
                        Your app isn't authorized yet. This is easy to fix!
                      </p>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-inner">
                  <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Fix: Update your Google Cloud Console</h5>
                  
                  <div className="mb-6">
                    <p className="text-xs text-slate-600 mb-2">1. Add this exact origin to <strong>"Authorized JavaScript origins"</strong>:</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-slate-100 p-3 rounded-lg font-mono text-xs font-bold text-indigo-700 border border-slate-200 break-all">
                            {error.origin}
                        </code>
                        <button 
                            onClick={() => navigator.clipboard.writeText(error.origin)}
                            className="bg-slate-900 text-white px-3 py-3 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-600 transition-colors"
                        >
                            Copy
                        </button>
                    </div>
                    <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-tight">⚠️ Important: DO NOT ADD "/Drive-Purge-Ai/" to this string.</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-2">2. Add your email as a <strong>Test User</strong> in the "OAuth Consent Screen" tab.</p>
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 italic text-center">
                  After saving, wait 2-3 minutes for Google's servers to update, then refresh this page.
                </div>
                
                <button onClick={() => setError(null)} className="self-center px-10 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-rose-700 transition-all">Close and try again</button>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
