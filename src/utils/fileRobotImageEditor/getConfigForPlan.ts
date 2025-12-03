// Retourne une configuration Filerobot selon le plan

// Props du composant ImgEditor
type ImgEditorProps = {
  // src: image sans fond (dataURL/URL) retournée par votre API remove‑bg
  src: string;
  // plan: configuration Filerobot (onglets/outils)
  planUser: string;

  credit: number;
};


const getConfigForPlan = (
  plan: ImgEditorProps["planUser"],
  TABS: any,
  TOOLS: any
)=> {
  switch (plan) {
    case "free":
      return {
        tabsIds: [TABS.RESIZE],
        defaultTabId: TABS.RESIZE,
        defaultToolId: TOOLS.RESIZE,
        removeSaveButton: true,
      };
    case "hobby":
      return {
        tabsIds: [TABS.ADJUST, TABS.RESIZE, TABS.FILTERS],
        defaultTabId: TABS.RESIZE,
        defaultToolId: TOOLS.RESIZE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
    case "pro":
      return {
        tabsIds: [],
        defaultTabId: TABS.RESIZE,
        defaultToolId: TOOLS.RESIZE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
    default:
      return {
        tabsIds: [],
        defaultTabId: TABS.RESIZE,
        defaultToolId: TOOLS.RESIZE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
  }
}
export {getConfigForPlan}