//import des hooks
import { useRef, useEffect, useState } from "preact/hooks";

//import des composants enfants
import { Cursor } from "../cursor/Cursor";

const Example = () => {
  const wrapper = useRef<HTMLDivElement | null>(null);
  const cursor = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [positionX, setPositionX] = useState(0); // X relative au wrapper

  // Calcule X local (dans le wrapper) et le borne dans [0, largeur]
  const computeLocalX = (clientX: number) => {
    if (!wrapper.current) return 0;
    const rect = wrapper.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(x, rect.width));
  };

  const updateFromEvent = (e: MouseEvent) => {
    if (!isDragging) return;
    const x = Math.round(computeLocalX(e.clientX));
    setPositionX(x);
  };

  const onMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    const x = Math.round(computeLocalX(e.clientX));
    setPositionX(x);
  };

  const onMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const wrap = wrapper.current;
    if (!wrap) return;

    // position initiale: centre du wrapper
    const rect = wrap.getBoundingClientRect();
    setPositionX(Math.round(rect.width / 2));

    wrap.addEventListener("mousedown", onMouseDown as any);
    window.addEventListener("mousemove", updateFromEvent as any);
    window.addEventListener("mouseup", onMouseUp as any);

    return () => {
      wrap.removeEventListener("mousedown", onMouseDown as any);
      window.removeEventListener("mousemove", updateFromEvent as any);
      window.removeEventListener("mouseup", onMouseUp as any);
    };
  }, [isDragging]);

  // Optionnel: recadre la position quand on redimensionne la fenêtre
  useEffect(() => {
    const handleResize = () => {
      if (!wrapper.current) return;
      const rect = wrapper.current.getBoundingClientRect();
      setPositionX((x) => Math.max(0, Math.min(x, Math.round(rect.width))));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative flex flex-row justify-center items-center gap-3 w-[1000px] h-[400px] border-[1px] border-white rounded-[10px]">
      <div ref={wrapper} className="relative z-10 w-[80%] h-[100%] overflow-hidden">
        {/* Couche du fond (arrière-plan transparent/cadrillage) */}
        <div className="absolute inset-0 bg-red-500 pointer-events-none select-none">
          {/* Remplacer par l'image de fond transparente (cadrillage) */}
        </div>

        {/* Couche du haut (arrière-plan original) limitée par positionX */}
        <div className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none" style={{ width: `${positionX}px` }}>
          <div className="absolute inset-0 bg-cyan-500 select-none">
            {/* Remplacer par l'image d'arrière-plan originale */}
          </div>
        </div>

        {/* Curseur positionné à positionX (X uniquement) */}
        <div
          ref={cursor}
          className="absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none"
          style={{ left: `${positionX}px`, transform: "translate(-50%, -50%)" }}
        >
          <Cursor />
        </div>

        {/* Affichage de la coordonnée X pour debug */}
        <div className="absolute bottom-2 left-2 text-white text-sm select-none">
          coordonnée X: {positionX}px
        </div>
      </div>
    </div>
  );
};

export { Example };
