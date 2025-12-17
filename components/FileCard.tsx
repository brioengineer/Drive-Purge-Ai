
import React from 'react';
import { DriveFile, CleanupCandidate } from '../types.ts';

interface FileCardProps {
  file: DriveFile;
  candidate?: CleanupCandidate;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

const FileCard: React.FC<FileCardProps> = ({ file, candidate, onSelect, isSelected }) => {
  const formatSize = (bytes?: string) => {
    if (!bytes) return 'Unknown size';
    const num = parseInt(bytes);
    if (num > 1024 * 1024 * 1024) return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (num > 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB';
    return (num / 1024).toFixed(1) + ' KB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'duplicate': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'large': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'old': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div 
      onClick={() => onSelect(file.id)}
      className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected 
        ? 'border-indigo-500 bg-indigo-50 shadow-md' 
        : 'border-transparent bg-white hover:border-slate-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {file.thumbnailLink ? (
            <img src={file.thumbnailLink} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">📄</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate" title={file.name}>
            {file.name}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500">{formatSize(file.size)}</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500">{formatDate(file.modifiedTime)}</span>
          </div>
          {candidate && (
            <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getCategoryColor(candidate.category)}`}>
              {candidate.category}: {candidate.reason}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
           <input 
              type="checkbox" 
              checked={isSelected} 
              readOnly 
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
            />
        </div>
      </div>
    </div>
  );
};

export default FileCard;
