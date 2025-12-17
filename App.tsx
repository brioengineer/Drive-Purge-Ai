
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
  const [agentMessage, setAgentMessage] = useState<string>("Ready to audit your storage ecosystem.");
  const [error, setError] = useState<{title: string, msg: string, origin: string} | null>(null);

  useEffect(() => {
    driveService.init((authStatus) => {
      setIsAuthenticated(authStatus);
      if (authStatus) {
        setAgentMessage("Drive authenticated. I'm standing by for your command to begin the scan.");
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
                title: "Authentication Failed",
                msg: e.message || "The login popup was blocked or could not be initialized.",
                origin: window.location.origin
            });
            return;
        }
    }

    setState(AppState.SCANNING);
    setAgentMessage("Indexing file metadata and permission structures...");
    
    try {
      const fetchedFiles = isDemo ? MOCK_FILES : await driveService.listFiles();
      setFiles(fetchedFiles);
      
      setState(AppState.ANALYZING);
      setAgentMessage("Running Gemini AI analysis to detect redundancies and storage bloat...");
      
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
          title: "Analysis Error",
          msg: err.message || "Failed to process Drive files. Check console for details.",
          origin: window.location.origin
      });
      setState(AppState.LANDING);
    }
  };

  const handleCleanup = async () => {
    if (selectedIds.size === 0) return;
    setState(AppState.TRASHING);
    setAgentMessage(`Executing secure removal of ${selectedIds.size} files...`);

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
      setAgentMessage("Optimization cycle complete.");
    } catch (err: any) {
      setError({
          title: "Cleanup Failed",
          msg: err.message,
          origin: window.location.origin
      });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setState(AppState.LANDING)}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span className="text-lg font-bold tracking-tight text-slate-800">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>

        <div className="flex items-center gap-6">
          {isAuthenticated && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Connected
            </div>
          )}
          {state === AppState.REVIEWING && (
            <button 
              onClick={handleCleanup}
              disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white px-6 py-2 rounded-full font-bold text-xs transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              Purge Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-12">
        {state === AppState.LANDING && (
            <div className="py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            Next-Gen Storage Management
                        </span>
                        <h1 className="text-5xl lg:text-6xl font-black text-slate-900 leading-[1.1] mb-8">
                            Reclaim your <br/> digital space with <br/> <span className="text-indigo-600">AI precision.</span>
                        </h1>
                        <p className="text-lg text-slate-500 leading-relaxed mb-10 max-w-md">
                            The intelligent agent that audits your Google Drive to find duplicates, outdated drafts, and forgotten giants.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => startAnalysis(false)}
                                className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 hover:-translate-y-1 flex items-center justify-center gap-3"
                            >
                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png" className="w-6 h-6 bg-white rounded-full p-1" alt=""/>
                                Get Started Free
                            </button>
                            <button 
                                onClick={() => startAnalysis(true)}
                                className="bg-white border-2 border-slate-100 text-slate-500 px-10 py-5 rounded-2xl font-bold text-lg hover:border-indigo-100 hover:text-indigo-600 transition-all"
                            >
                                Try Demo Scan
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-4 bg-indigo-100 rounded-[40px] rotate-3 -z-10 opacity-50"></div>
                        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl relative">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">Agent Alpha</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Active Status</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-3 bg-slate-50 rounded-full w-3/4"></div>
                                <div className="h-3 bg-slate-50 rounded-full w-full"></div>
                                <div className="h-3 bg-slate-50 rounded-full w-1/2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mb-10">
                <div className="absolute inset-0 border-2 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl">
                    {state === AppState.TRASHING ? '🔥' : '⚙️'}
                </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-white border border-slate-100 p-6 rounded-[24px] shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-2xl">🗑️</div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Potential Savings</p>
                        <h4 className="text-2xl font-black text-slate-900">{(stats.candidateSize / (1024*1024)).toFixed(1)} MB</h4>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[24px] shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">📄</div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Files Flagged</p>
                        <h4 className="text-2xl font-black text-slate-900">{candidates.length}</h4>
                    </div>
                </div>
             </div>

             <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Audit Findings</h3>
                <div className="flex gap-4">
                  <button onClick={() => setSelectedIds(new Set(candidates.map(c => c.id)))} className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.1em] hover:text-indigo-800 transition-colors">Select All</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-black text-slate-300 uppercase tracking-[0.1em] hover:text-slate-500 transition-colors">Clear</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.map((candidate) => {
                  const file = files.find(f => f.id === candidate.id);
                  if (!file) return null;
                  return (
                    <FileCard
                      key={file.id}
                      file={file}
                      candidate={candidate}
                      onSelect={(id) => {
                        const next = new Set(selectedIds);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setSelectedIds(next);
                      }}
                      isSelected={selectedIds.has(file.id)}
                    />
                  );
                })}
              </div>
          </div>
        )}

        {state === AppState.COMPLETED && (
            <div className="py-20 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-10 shadow-inner">✨</div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Storage Optimized.</h2>
                <button 
                    onClick={() => setState(AppState.LANDING)}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold transition-all hover:bg-indigo-600 shadow-xl shadow-indigo-50"
                >
                    Return to Dashboard
                </button>
            </div>
        )}

        {error && (
            <div className="mt-12 p-8 bg-rose-50 border border-rose-100 rounded-[24px] flex flex-col gap-4 animate-in slide-in-from-top-4 overflow-hidden">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🚨</span>
                  <div className="flex-1">
                      <h4 className="font-bold text-rose-900">{error.title}</h4>
                      <p className="text-sm text-rose-600 leading-relaxed mb-4">
                        {error.msg}
                      </p>
                  </div>
                </div>
                
                <div className="bg-white/50 p-6 rounded-xl border border-rose-200">
                  <h5 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-4 underline decoration-2 underline-offset-4">HOW TO FIX THE 'DOESN'T COMPLY' 400 ERROR</h5>
                  <p className="text-xs text-rose-900 mb-4 leading-relaxed">
                    Google is blocking this request because the <strong>Authorized Origin</strong> in your Cloud Console does not match where the app is hosted.
                  </p>
                  <ol className="text-xs text-rose-900 space-y-3 list-decimal pl-4">
                    <li>Go to <strong>APIs & Services > Credentials</strong> in your Google Cloud Console.</li>
                    <li>Edit your <strong>OAuth 2.0 Client ID</strong> (ensure Type is "Web Application").</li>
                    <li>Under <strong>Authorized JavaScript origins</strong>, add this exact domain:</li>
                    <li className="list-none my-2"><code className="bg-rose-100 px-3 py-1.5 rounded font-mono font-bold text-rose-800 break-all">{error.origin}</code></li>
                    <li className="font-bold">Crucial: Do NOT add <span className="text-rose-600">/Drive-Purge-Ai/</span> to that field. Just the domain.</li>
                    <li>Add your email (<code className="bg-rose-100 px-1 rounded">steve@briotech.com</code>) to the <strong>Test Users</strong> list in the "OAuth consent screen" tab.</li>
                  </ol>
                  <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-100 text-[10px] text-amber-800 italic leading-snug">
                    * Changes can take 5-10 minutes to propagate on Google's side. Refresh and try again after updating.
                  </div>
                </div>
                
                <button onClick={() => setError(null)} className="self-end text-xs font-bold text-rose-700 hover:underline">Dismiss Error</button>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
