import { addAuditLog } from '../utils/storageService';
import { basisLabel, savedRecommendationEdit } from '../utils/recommendationText';
import { RecommendationEdit, TenderProject } from '../types/tender';
import { EditContext } from './editContext';

export function createRecommendationHandlers(ctx: EditContext) {
  const { currentProject, saveProject } = ctx;

  // صياغة اللجنة لتوصية المحضر، أو null لاستعادة صياغة النظام. systemText: صياغة النظام كما في المعاينة الآن
  const handleSaveRecommendationEdit = (edit: RecommendationEdit | null, systemText: string) => {
    const before = savedRecommendationEdit(currentProject);
    if (!edit && !before) return;

    let updatedProj: TenderProject = {
      ...currentProject,
      recommendationEdit: edit ?? undefined,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      edit ? 'تعديل صياغة التوصية' : 'استعادة صياغة النظام للتوصية',
      edit
        ? `عدّلت اللجنة صياغة ${basisLabel(edit.basis)} في المحضر`
        : 'حُذفت صياغة اللجنة للتوصية، ويُطبع المحضر بصياغة النظام',
      { oldValue: before?.text ?? systemText, newValue: edit?.text ?? systemText }
    );

    saveProject(updatedProj);
  };

  return { handleSaveRecommendationEdit };
}
