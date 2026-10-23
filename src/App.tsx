import { useState } from 'react';
import { lastBackupTime } from './utils/backupStatus';
import { isSaveBlocked } from './utils/storageService';
import { hasBidAmounts, exclusionThresholdOf } from './utils/recommendation';
import { exportTenderToExcel } from './utils/excelService';
import { isOfferLocked, offerStatus, offerDeviationTotals } from './utils/weightedOffer';

import { Navbar } from './components/Navbar';
import { KPIStatsCards } from './components/KPIStatsCards';
import { BOQTable } from './components/BOQTable';
import { WeightedOfferBar } from './components/WeightedOfferBar';
import { WeightedOfferControl } from './components/WeightedOfferControl';
import { ChartsView } from './components/ChartsView';
import { ExecutiveSummaryView } from './components/ExecutiveSummaryView';
import { StartScreen } from './components/StartScreen';
import { ProjectHeader } from './components/ProjectHeader';
import { AppFooter } from './components/AppFooter';

import { SmartTableImportModal } from './components/modals/SmartTableImportModal';
import { ImageOcrModal, OcrHandoff } from './components/modals/ImageOcrModal';
import { MultiBidderMatrix } from './components/modals/MultiBidderMatrix';
import { AuditTrailModal } from './components/modals/AuditTrailModal';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { PageBreaksModal } from './components/modals/PageBreaksModal';
import { PageSummaryTable } from './components/PageSummaryTable';
import { PrintReportModal } from './components/modals/PrintReportModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { ProjectsBrowserModal } from './components/modals/ProjectsBrowserModal';
import { UpdateNotice } from './components/UpdateNotice';
import { RecoveryNotice } from './components/RecoveryNotice';
import { ForeignDomNotice } from './components/ForeignDomNotice';
import { RESUMED_STATE } from './resume';

import { useProjectStore } from './app/useProjectStore';
import { createEditContext } from './app/editContext';
import { createItemHandlers } from './app/itemHandlers';
import { createOfferHandlers } from './app/offerHandlers';
import { createImportHandlers } from './app/importHandlers';
import { createBidderHandlers } from './app/bidderHandlers';
import { createProjectHandlers } from './app/projectHandlers';

export function App() {
  const {
    projects, setProjects, activeProjectId, setActiveId, loaded, recovered, backupMarks,
    unsaved, recordBackup, downloadRecovered, dismissRecovered
  } = useProjectStore();
  // بعد «حفظ والتحديث» يُستأنف التبويب الذي كان مفتوحاً (src/resume.ts)
  const [activeTab, setActiveTab] = useState<'table' | 'summary' | 'charts'>(RESUMED_STATE?.tab ?? 'table');

  // Modals
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [smartImportDocType, setSmartImportDocType] = useState<'bidder' | 'estimated' | 'both'>('bidder');
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  // ملفات PDF/صور سلّمتها نافذة الاستيراد الموحّدة لنافذة القراءة بالذكاء الاصطناعي (مع الوجهة)
  const [ocrHandoff, setOcrHandoff] = useState<OcrHandoff | null>(null);
  const [isMultiBidderOpen, setIsMultiBidderOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [isPageBreaksOpen, setIsPageBreaksOpen] = useState(false);

  // نافذة مفتوحة فيها عمل لم يُطبَّق أو يُحفظ بعد: يُمنع التحديث حتى تُكمل أو تُغلق
  const blockingWork = isOcrOpen ? 'قراءة جدول من PDF / صورة'
    : isSmartImportOpen ? 'استيراد جدول'
    : isSettingsOpen ? 'إعدادات المناقصة'
    : isNewProjectOpen ? 'مناقصة جديدة'
    : isPageBreaksOpen ? 'فواصل الصفحات'
    : null;

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeBidder = currentProject?.bidders.find(b => b.id === currentProject.activeBidderId) || currentProject?.bidders[0];

  const { handleBackupAll, handleBackupProject, handleCreateProject, handleImportBackup, handleDeleteProject,
    handleFactoryReset, handleOpenFromBrowser, handleImportAllBackup, selectProject } = createProjectHandlers({
    projects, setProjects, setActiveId, recordBackup, currentProject,
    closeSettings: () => setIsSettingsOpen(false),
    closeProjects: () => setIsProjectsOpen(false)
  });

  const recoveryNotice = (
    <RecoveryNotice
      entries={recovered}
      saveBlocked={isSaveBlocked()}
      onDownload={downloadRecovered}
      onDismiss={dismissRecovered}
    />
  );

  // لا مناقصة محفوظة (بعد «إعادة ضبط النظام» أو حذف آخر مناقصة): شاشة بداية بدل مناقصة فارغة تُنشأ تلقائياً
  if (loaded && projects.length === 0) {
    return (
      <StartScreen
        recoveryNotice={recoveryNotice}
        onCreate={handleCreateProject}
        onImportBackup={handleImportBackup}
      />
    );
  }

  if (!currentProject || !activeBidder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-base">
        جاري تحميل نظام تحليل وتقييم العطاءات المتكامل...
      </div>
    );
  }

  const ctx = createEditContext(currentProject, activeBidder, setProjects);
  const { handleUpdateItemFields, handleUpdateItem, handleCorrectReading, handleAdoptTafqeetThousands,
    handleUpdateStatedTotal, handleMarkUnreasonable, handleMarkBidderSigned, handleAddItem, handleDeleteItem,
    handleDuplicateItem, handleClearBidderPrices, handleExportBidderAudit, applyPageBreaks } = createItemHandlers(ctx);
  const { handleStartOffer, handlePauseOffer, handleAdoptOffer, handleUnadoptOffer, handleEditOfferUnit } = createOfferHandlers(ctx);
  const { handleApplyExtractedItems, referenceRows } = createImportHandlers(ctx);
  const { handleUpdateBidderName, handleAddNewBidder, handleDeleteBidder, handleUpdateBidderStatus,
    handleSaveSettings, handleResetAllBidders, selectBidder } = createBidderHandlers(ctx, { closeSettings: () => setIsSettingsOpen(false) });

  const handleApplyPageBreaks = (pages: (number | undefined)[]) => {
    applyPageBreaks(pages);
    setIsPageBreaksOpen(false);
  };

  // Select Table Tab and Scroll
  const handleSelectTableTab = () => {
    setActiveTab('table');
    setTimeout(() => {
      document.getElementById('boq-table-container')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {recoveryNotice}
      <ForeignDomNotice />

      {/* Top Navbar */}
      <Navbar
        project={currentProject}
        projects={projects}
        activeBidder={activeBidder}
        onSelectProject={selectProject}
        onNewProject={() => setIsNewProjectOpen(true)}
        onOpenProjectsBrowser={() => setIsProjectsOpen(true)}
        onOpenMultiBidder={() => setIsMultiBidderOpen(true)}
        onOpenAuditTrail={() => setIsAuditOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        unsavedCount={unsaved.length}
        lastBackupAt={lastBackupTime(backupMarks)}
        onBackupAll={handleBackupAll}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Project Header Info Banner */}
        <ProjectHeader
          project={currentProject}
          activeBidder={activeBidder}
          activeTab={activeTab}
          onSelectTableTab={handleSelectTableTab}
          onSelectTab={setActiveTab}
          onChangeProjectField={(field, value) =>
            setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, [field]: value, updatedAt: new Date().toISOString() } : p))}
          onSelectBidder={selectBidder}
          onRenameBidder={handleUpdateBidderName}
          onAddBidder={handleAddNewBidder}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Dynamic KPI Cards */}
        <KPIStatsCards
          totals={activeBidder.totals}
          currency={currentProject.currency}
          deviationThreshold={currentProject.deviationThreshold}
          exclusionThreshold={exclusionThresholdOf(currentProject)}
          statedTotal={activeBidder.statedTotal}
          pendingAuditCount={activeBidder.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length}
          onChangeStatedTotal={handleUpdateStatedTotal}
          offer={activeBidder.weightedOffer && isOfferLocked(activeBidder) ? {
            status: activeBidder.weightedOffer.status === 'adopted' ? 'adopted' : 'active',
            ...offerDeviationTotals(activeBidder.items, currentProject.deviationThreshold)
          } : undefined}
        />

        {/* Content based on Tab */}
        <div id="boq-table-container">
          {activeTab === 'table' ? (
            <>
            {hasBidAmounts(activeBidder) && (
              <div className="mb-4">
                <WeightedOfferBar bidder={activeBidder} threshold={currentProject.deviationThreshold} exclusionThreshold={exclusionThresholdOf(currentProject)} />
              </div>
            )}
            <BOQTable
              items={activeBidder.items}
              totals={activeBidder.totals}
              currency={currentProject.currency}
              deviationThreshold={currentProject.deviationThreshold}
              bidderName={activeBidder.name}
              onUpdateItem={handleUpdateItem}
              onUpdateFields={handleUpdateItemFields}
              onCorrectReading={handleCorrectReading}
              onAdoptTafqeetThousands={handleAdoptTafqeetThousands}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={handleDuplicateItem}
              onClearBidderPrices={handleClearBidderPrices}
              onExportAudit={handleExportBidderAudit}
              onOpenSmartImport={() => {
                // يُرفض قبل قراءة الملف لا بعدها: الإدراج مشترك فيرفضه قفل عرض أي مجهز، وكانت القراءة تضيع
                if (ctx.blockedByOffer({ shared: true })) return;
                setSmartImportDocType('bidder');
                setIsSmartImportOpen(true);
              }}
              offerMode={activeBidder.weightedOffer?.status === 'active' ? 'active' : activeBidder.weightedOffer?.status === 'adopted' ? 'adopted' : 'none'}
              sharedLocked={currentProject.bidders.some(isOfferLocked)}
              onEditOfferUnit={handleEditOfferUnit}
              onMarkUnreasonable={handleMarkUnreasonable}
              onMarkBidderSigned={handleMarkBidderSigned}
              offerControl={hasBidAmounts(activeBidder) ? (
                <WeightedOfferControl bidder={activeBidder} threshold={currentProject.deviationThreshold} exclusionThreshold={exclusionThresholdOf(currentProject)}
                  onStart={handleStartOffer} onPause={handlePauseOffer} onAdopt={handleAdoptOffer} onUnadopt={handleUnadoptOffer} />
              ) : undefined}
            />
            <div className="mt-4">
              <PageSummaryTable items={activeBidder.items}
                showOffer={!!activeBidder.weightedOffer && activeBidder.weightedOffer.status !== 'paused'}
                offerFinal={activeBidder.weightedOffer?.status === 'adopted' && !offerStatus(activeBidder)?.stale}
                onOpenPageBreaks={() => setIsPageBreaksOpen(true)} />
            </div>
            </>
          ) : activeTab === 'summary' ? (
            <ExecutiveSummaryView
              project={currentProject}
              onSelectBidder={selectBidder}
              onUpdateBidderStatus={handleUpdateBidderStatus}
              onOpenPrint={() => setIsPrintOpen(true)}
              onExportExcel={() => exportTenderToExcel(currentProject, activeBidder)}
            />
          ) : (
            <ChartsView
              bidders={currentProject.bidders.filter(hasBidAmounts)}
              currency={currentProject.currency}
              exclusionThreshold={exclusionThresholdOf(currentProject)}
            />
          )}
        </div>

      </main>

      {/* Sleek Permanent Footer */}
      <AppFooter onOpenWhatsNew={() => setIsWhatsNewOpen(true)} />

      {/* Modals */}
      <SmartTableImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onApplyExtractedItems={handleApplyExtractedItems}
        currentBidderName={activeBidder.name}
        initialDocType={smartImportDocType}
        tableRows={referenceRows}
        onReadWithAi={(files, docType) => {
          setIsSmartImportOpen(false);
          setOcrHandoff({ id: Date.now(), files, destination: docType === 'estimated' ? 'estimated_only' : 'bidder_only' });
          setIsOcrOpen(true);
        }}
      />

      <ImageOcrModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onApplyExtractedItems={handleApplyExtractedItems}
        handoff={ocrHandoff}
        tableRows={referenceRows}
      />

      <MultiBidderMatrix
        isOpen={isMultiBidderOpen}
        onClose={() => setIsMultiBidderOpen(false)}
        project={currentProject}
        onSelectBidder={selectBidder}
        onAddNewBidder={handleAddNewBidder}
        onUpdateBidderStatus={handleUpdateBidderStatus}
        onDeleteBidder={handleDeleteBidder}
      />

      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        logs={currentProject.auditLogs || []}
      />

      <PageBreaksModal
        // يُعاد تهيئة الحقول مع كل فتح ومع كل مجهز، كما في ProjectSettingsModal
        key={`${activeBidder.id}-${isPageBreaksOpen}`}
        isOpen={isPageBreaksOpen}
        onClose={() => setIsPageBreaksOpen(false)}
        items={activeBidder.items}
        bidderName={activeBidder.name}
        onApply={handleApplyPageBreaks}
      />

      <ProjectSettingsModal
        // يُعاد إنشاؤه مع كل فتح ومع كل مناقصة: حقوله تُهيأ من المشروع مرة واحدة عند الإنشاء،
        // وبدون ذلك تظهر بيانات مناقصة سابقة ويُكتب فوق الحالية عند الحفظ
        key={`${currentProject.id}-${isSettingsOpen}`}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={currentProject}
        onSaveSettings={handleSaveSettings}
        onExportBackup={handleBackupProject}
        onImportBackup={handleImportBackup}
        onExportAllBackup={handleBackupAll}
        onImportAllBackup={handleImportAllBackup}
        onDeleteProject={() => handleDeleteProject(currentProject.id)}
        onFactoryReset={handleFactoryReset}
        onResetAllBidders={handleResetAllBidders}
      />

      <UpdateNotice
        manualOpen={isWhatsNewOpen}
        onManualClose={() => setIsWhatsNewOpen(false)}
        blockingWork={blockingWork}
        getResumeState={() => ({ tab: activeTab, scrollY: window.scrollY })}
      />

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <ProjectsBrowserModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        projects={projects}
        activeProjectId={currentProject.id}
        onOpenProject={handleOpenFromBrowser}
        onDeleteProject={handleDeleteProject}
        onNewProject={() => {
          setIsProjectsOpen(false);
          setIsNewProjectOpen(true);
        }}
      />

      <PrintReportModal
        // خيار جدول الأسعار الموزونة يبدأ بقيمته الافتراضية مع كل فتح، كما في ProjectSettingsModal
        key={`${currentProject.id}-${isPrintOpen}`}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        project={currentProject}
        activeBidder={activeBidder}
      />

    </div>
  );
}
