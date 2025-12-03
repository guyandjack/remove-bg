//import des hooks
import { useState, useEffect, useRef } from "preact/hooks";

//import des composants enfants
import ColorPicker from "react-best-gradient-color-picker";

//import des data
import { planColor } from "@/data/content/components/editor/planColor";


type ReactColorPickerProps = {
  setColorValue?: (value: { type: "color"; value: string }) => void;
  setLastChoice: (value: string) => void;
};

const ReactColorPicker = ({ setColorValue, setLastChoice }: ReactColorPickerProps) => {
  const [color, setColor] = useState("rgba(200,77,150,0.5)");
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (color === "") return;
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      return;
    }
    setColorValue?.({ type: "color", value: color });
    setLastChoice(color);
  }, [color]);

  return (
    <ColorPicker
      value={color}
      onChange={setColor}
      presets={planColor}
      height={200}
      width={325}
      hideInputs={true}
      hideAdvancedSliders={true}
      hideColorGuide={true}
      hideInputType={true}
      hideGradientStop={true}
    />
  );
};

export { ReactColorPicker };
