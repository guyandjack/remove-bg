// FIEEditor.tsx
import { useEffect, useRef } from "preact/hooks";

type FIEEditorProps = {
  src: string; // URL ou dataURL de l'image à éditer
};

const ImgEditor = ({ src }: FIEEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let editor: any;

    const FIE = (window as any).FilerobotImageEditor;
    if (!FIE || !containerRef.current) {
      console.warn("FilerobotImageEditor non trouvé sur window.");
      return;
    }

    const { TABS, TOOLS } = FIE;

    const config = {
      source: src,
      onSave: (editedImageObject: any, designState: any) => {
        console.log("Image sauvegardée :", editedImageObject);
        // editedImageObject.imageBase64 -> ton image finale
      },
      tabsIds: [TABS.ADJUST, TABS.ANNOTATE, TABS.RESIZE],
      defaultTabId: TABS.ADJUST,
      defaultToolId: TOOLS.CROP,
    };

    editor = new FIE(containerRef.current, config);

    editor.render({
      onClose: () => {
        editor.terminate();
      },
    });

    return () => {
      try {
        editor?.terminate?.();
      } catch (e) {
        console.error(e);
      }
    };
  }, [src]);

  return (
    <div className={"w-full max-w-[1300px] h-[800px]"}>
      {/* IMPORTANT : ce div doit avoir une vraie taille */}
      <div ref={containerRef} className={"w-full h-[800px]"} />
    </div>
  );
};

export { ImgEditor } 
