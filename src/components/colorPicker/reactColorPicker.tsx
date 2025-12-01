//import des hooks
import {useState, useEffect} from "preact/hooks"

//import des composants enfants
import ColorPicker from "react-best-gradient-color-picker";

//import des data
import { planColor } from "@/data/content/components/editor/planColor";


const  ReactColorPicker = ({setColorValue, setLastChoice})=> {
    const [color, setColor] = useState("");
    
    useEffect(() => {
        if (color === "") return;
        setColorValue({ type: "color", value: color });
        setLastChoice(color);
    },[color])

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
}

export { ReactColorPicker}
