
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, DriveFile, CleanupCandidate } from './types.ts';
import { driveService } from './services/googleDriveService.ts';
import { analyzeFilesWithGemini } from './services/geminiService.ts';
import FileCard from './components/FileCard.tsx';

const MOCK_FILES: DriveFile[] = [
  { id: 'm1', name: 'Draft_Budget_v1_FINAL_2022.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm2', name: 'Draft_Budget_v1_FINAL_2022.pdf', size: '12500000', mimeType: 'application/pdf', modifiedTime: '2022-03-12T10:00:00Z' },
  { id: 'm3', name: '4K_Drone_Footage_Unprocessed.mp4', size: '3200000000', mimeType: 'video/mp4', modifiedTime: '2023-11-20T15:30:00Z' },
  { id: 'm4', name: 'Backup_Logs_Temp.zip', size: '850000000', mimeType: 'application/zip', modifiedTime: '2024-01-10T09:15:00Z' },
  { id: 'm5', name: 'Meeting_Notes_2019.txt', size: '2500', mimeType: 'text/plain', modifiedTime: '2019-01-01T12:00:00Z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agentMessage, setAgentMessage] = useState<string>("System standby...");
  const [error, setError] = useState<{title: string, msg: string, origin: string} | null>(null);

  useEffect(() => {
    driveService.init((authStatus) => {
      setIsAuthenticated(authStatus);
      if (authStatus) {
        setAgentMessage("Drive connected. Ready to audit.");
      } else {
        setAgentMessage("Ready to reclaim your storage.");
      }
    });
  }, []);

  const startAnalysis = async (isDemo: boolean = false) => {
    setError(null);
    if (!isDemo && !isAuthenticated) {
        try {
            setAgentMessage("Handshaking with Google...");
            await driveService.login();
            return; 
        } catch (e: any) {
            setError({
                title: "Connection Failed",
                msg: e.message || "storagerelay error",
                origin: window.location.origin
            });
            return;
        }
    }

    setState(AppState.SCANNING);
    setAgentMessage("Parsing file hierarchy...");
    
    try {
      const fetchedFiles = isDemo ? MOCK_FILES : await driveService.listFiles();
      setFiles(fetchedFiles);
      
      setState(AppState.ANALYZING);
      setAgentMessage("AI Agent reasoning over metadata...");
      
      const analysis = await analyzeFilesWithGemini(fetchedFiles);
      setCandidates(analysis.candidates);
      
      const highConfidenceIds = analysis.candidates
        .filter(c => c.confidence > 0.7)
        .map(c => c.id);
        
      setSelectedIds(new Set(highConfidenceIds));
      setAgentMessage(analysis.summary);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      setError({
          title: "Audit Interrupted",
          msg: err.message || "Analysis engine failure.",
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
      setError({ title: "Cleanup Error", msg: err.message, origin: window.location.origin });
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fcfdfe] text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setState(AppState.LANDING)}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:rotate-6 transition-transform">P</div>
          <span className="text-xl font-black tracking-tight">DrivePurge<span className="text-indigo-600">AI</span></span>
        </div>
        <div className="flex items-center gap-5">
          {isAuthenticated && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-black uppercase tracking-widest border border-emerald-100">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Authorized
            </div>
          )}
          {state === AppState.REVIEWING && (
            <button onClick={handleCleanup} disabled={selectedIds.size === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white px-7 py-2.5 rounded-full font-bold text-sm shadow-xl transition-all active:scale-95">
              Secure Purge ({selectedIds.size})
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-16">
        {state === AppState.LANDING && (
            <div className="py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-8">Storage Intelligence</span>
                        <h1 className="text-6xl font-black text-slate-900 leading-[1.05] mb-8 tracking-tighter">
                            Reclaim space <br/> with <span className="text-indigo-600">AI reasoning.</span>
                        </h1>
                        <p className="text-xl text-slate-500 mb-12 leading-relaxed">Gemini Agent identifies duplicates, ancient drafts, and hidden storage hogs for you.</p>
                        <div className="flex flex-col sm:flex-row gap-5">
                            <button onClick={() => startAnalysis(false)} className="bg-slate-900 text-white px-10 py-6 rounded-2xl font-black text-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 shadow-2xl hover:-translate-y-1">
                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png" className="w-7 h-7 bg-white rounded-full p-1.5 shadow-sm" alt=""/>
                                {isAuthenticated ? 'Begin Scan' : 'Connect Drive'}
                            </button>
                            <button onClick={() => startAnalysis(true)} className="bg-white border-2 border-slate-100 text-slate-400 px-10 py-6 rounded-2xl font-black text-xl hover:border-indigo-100 hover:text-indigo-600 transition-all">Demo Audit</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {(state === AppState.SCANNING || state === AppState.ANALYZING || state === AppState.TRASHING) && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="relative w-32 h-32 mb-12">
                <div className="absolute inset-0 border-4 border-slate-50 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-5xl">🧠</div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="flex items-end justify-between mb-12">
                <div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Audit Findings</h3>
                    <p className="text-slate-400 font-medium">{candidates.length} candidates identified for removal.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="py-24 text-center">
                <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-7xl mx-auto mb-12">✨</div>
                <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">Space Reclaimed.</h2>
                <button onClick={() => setState(AppState.LANDING)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl">Return to Dashboard</button>
            </div>
        )}

        {error && (
            <div className="mt-12 p-10 bg-rose-50 border border-rose-100 rounded-[40px] flex flex-col gap-8 animate-in slide-in-from-top-4 shadow-xl">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-rose-100">⚠️</div>
                  <div className="flex-1">
                      <h4 className="font-black text-rose-900 text-2xl tracking-tight mb-2">Google Connection Blocked</h4>
                      <p className="text-rose-700 leading-relaxed font-medium">
                        The "storagerelay" error is usually caused by <strong>Third-Party Cookie settings</strong>.
                      </p>
                  </div>
                </div>
                
                <div className="bg-white p-8 rounded-3xl border border-rose-200 shadow-sm">
                  <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">How to fix this:</h5>
                  
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 mt-1">1</div>
                        <p className="text-sm text-slate-600">
                           <strong>Disable "Block third-party cookies"</strong> in your browser settings. Google needs these to pass the login token from their popup back to this page.
                        </p>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 mt-1">2</div>
                        <p className="text-sm text-slate-600">
                           <strong>Don't use Incognito Mode.</strong> Privacy modes often block the necessary scripts for Google Drive to communicate.
                        </p>
                    </div>

                    <div className="flex items-start gap-4 pt-4 border-t border-slate-100">
                        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-500 flex-shrink-0 mt-1">✓</div>
                        <p className="text-sm text-slate-600">
                           Your Google Console setting of <code>{error.origin}</code> is correct. No changes needed there!
                        </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <button onClick={() => setError(null)} className="px-12 py-4 bg-rose-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-rose-700 transition-all active:scale-95">RETRY CONNECTION</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
