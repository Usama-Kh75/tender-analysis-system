import React, { useState } from 'react';
import { X, History, Search, User, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { AuditLogEntry } from '../../types/tender';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  logs
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                سجل التتبع والتدقيق التاريخي (Full Audit Trail)
                <span className="bg-amber-500/30 text-amber-300 text-xs px-2 py-0.5 rounded-full font-mono">
                  {logs.length} عمليات مسجلة
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تسجيل كافة التعديلات، الحسابات، وتغييرات الأسعار بالوقت والتاريخ لضمان الشفافية
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث في سجل العمليات والتعديلات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg pr-9 pl-3 py-1.5 text-xs sm:text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              لا توجد سجلات مطابقة للبحث
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-start justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {log.action}
                      </span>
                      {log.itemNo && (
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-mono px-1.5 py-0.5 rounded">
                          فقرة {log.itemNo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.details}</p>
                    
                    {log.oldValue !== undefined && log.newValue !== undefined && (
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        <span className="text-rose-600 line-through">السابق: {String(log.oldValue)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-600 font-bold">الجديد: {String(log.newValue)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end text-[11px] text-slate-400 whitespace-nowrap">
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <User className="w-3 h-3" />
                    {log.userName}
                  </span>
                  <span className="flex items-center gap-1 mt-0.5 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleString('ar-EG')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
