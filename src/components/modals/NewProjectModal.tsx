import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import type { ContractType } from '../../types/tender';
import { CONTRACT_TYPES, CONTRACT_TYPE_ORDER } from '../../utils/contractTypes';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; referenceNumber: string; contractType: ContractType; bidderNames: string[] }) => void;
}

// نوع العقد يُختار قبل إدخال أي بيانات، لأن التوصية (معايير المفاضلة) تتبعه
export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [contractType, setContractType] = useState<ContractType | null>(null);
  const [bidderNamesText, setBidderNamesText] = useState('');

  if (!isOpen) return null;

  const close = () => {
    setTitle('');
    setReferenceNumber('');
    setContractType(null);
    setBidderNamesText('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contractType) return;
    onCreate({ title: title.trim(), referenceNumber: referenceNumber.trim(), contractType, bidderNames: bidderNamesText.split(/\r?\n/) });
    close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">مناقصة / طلبية جديدة</h2>
              <p className="text-xs text-slate-400">يُحدد نوع العقد أولاً لتُصاغ التوصية وفق ضوابطه</p>
            </div>
          </div>
          <button onClick={close} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50 flex-1 overflow-y-auto">
          <fieldset>
            <legend className="block text-xs font-bold text-slate-700 mb-2">نوع العقد <span className="text-rose-600">*</span></legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CONTRACT_TYPE_ORDER.map(type => (
                <label
                  key={type}
                  className={`cursor-pointer rounded-xl border-2 px-3 py-3 text-center text-sm font-black transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 has-[:focus-visible]:ring-offset-2 ${
                    contractType === type
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="contractType"
                    value={type}
                    checked={contractType === type}
                    onChange={() => setContractType(type)}
                    className="sr-only"
                  />
                  {CONTRACT_TYPES[type].label}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              عقود الخدمات الاستشارية غير مشمولة: تُقيَّم فنياً قبل فتح عروضها التجارية (ضوابط رقم 4 ثانياً/3).
            </p>
          </fieldset>

          <div>
            <label htmlFor="new-project-title" className="block text-xs font-bold text-slate-700 mb-1">اسم / عنوان المناقصة <span className="text-rose-600">*</span></label>
            <input
              id="new-project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="new-project-ref" className="block text-xs font-bold text-slate-700 mb-1">رقم الطلبية أو المناقصة</label>
            <input
              id="new-project-ref"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-project-bidders" className="block text-xs font-bold text-slate-700 mb-1">أسماء الشركات المقدِّمة للعطاءات</label>
            <textarea
              id="new-project-bidders"
              aria-describedby="new-project-bidders-help"
              value={bidderNamesText}
              onChange={(e) => setBidderNamesText(e.target.value)}
              rows={4}
              placeholder={'اسم كل شركة في سطر، مثال:\nشركة الرافدين للمقاولات\nشركة دجلة للتجهيزات'}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
            />
            <p id="new-project-bidders-help" className="text-[11px] text-slate-500 mt-1">
              اختياري: تُنشأ لكل شركة صفحة جدول مصفّرة. ويمكن إضافة الشركات لاحقاً بزر «+ شركة جديدة».
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !contractType}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              إنشاء المناقصة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
