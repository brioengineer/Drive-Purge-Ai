
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AppState, DriveFile, CleanupCandidate } from './types';
import { driveService } from './services/googleDriveService';
import { analyzeFilesWithGemini } from './services/geminiService';
import FileCard from './components/FileCard';

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
  const [error, setError] = useState<string | null>(null);

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
    const selectedSize = Array.from(selectedIds).reduce((acc, id) => {
        const f = files.find(file => file.id === id);
        return acc + (f?.size ? parseInt(f.size) : 0);
    }, 0);
    return { totalSize, candidateSize, selectedSize };
  }, [files, candidates, selectedIds]);

  const chartData = [
    { name: 'Redundant', value: stats.candidateSize || 0.1 },
    { name: 'Optimized', value: Math.max(0.1, stats.totalSize - stats.candidateSize) },
  ];

  const COLORS = ['#6366F1', '#E2E8F0'];

  const startAnalysis = async (isDemo: boolean = false) => {
    if (!isDemo && !isAuthenticated) {
        try {
            await driveService.login();
            return; // Login callback will handle state change if successful
        } catch (e: any) {
            setError(e.message);
            return;
        }
    }

    setState(AppState.SCANNING);
    setError(null);
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
      setError(err.message || "Analysis failed. Please try again.");
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
      setAgentMessage("Optimization cycle complete. Your storage health has been significantly improved.");
    } catch (err: any) {
      setError("Cleanup interrupted: " + err.message);
      setState(AppState.REVIEWING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-slate-900">
      {/* Premium Header */}
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

      {/* Main Experience */}
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
                            <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                <span>Analysis Depth: High</span>
                                <span>Security: AES-256</span>
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
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2">{state}</p>
            <h2 className="text-2xl font-bold text-slate-800">{agentMessage}</h2>
          </div>
        )}

        {state === AppState.REVIEWING && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
             {/* Stats Row */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
                <div className="bg-indigo-600 p-6 rounded-[24px] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">AI Recommendation</p>
                        <p className="text-sm font-bold leading-snug italic">"Audit complete. Recommending immediate purge of these duplicates."</p>
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
                <p className="text-slate-500 text-lg mb-10">I've successfully cleaned your drive. <br/> Feel free to run another audit anytime.</p>
                <button 
                    onClick={() => setState(AppState.LANDING)}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold transition-all hover:bg-indigo-600 shadow-xl shadow-indigo-50"
                >
                    Return to Dashboard
                </button>
            </div>
        )}

        {error && (
            <div className="mt-12 p-6 bg-rose-50 border border-rose-100 rounded-[24px] flex items-start gap-4 animate-in slide-in-from-top-4">
                <span className="text-2xl">🚨</span>
                <div>
                    <h4 className="font-bold text-rose-900">System Error</h4>
                    <p className="text-sm text-rose-600 leading-relaxed">{error}</p>
                    {error.includes('configured') && (
                        <p className="text-xs text-rose-400 mt-2 italic font-medium">Developer: Please check the Master Client ID in services/googleDriveService.ts</p>
                    )}
                </div>
            </div>
        )}
      </main>

      <footer className="px-12 py-10 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 mt-20">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center text-[10px] text-white font-bold">P</div>
                <span className="text-xs font-bold text-slate-800">DrivePurge AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Enterprise Storage Intelligence</p>
        </div>
        <div className="flex items-center gap-10 text-[10px] text-slate-400 font-black uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Gemini API Powered</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
