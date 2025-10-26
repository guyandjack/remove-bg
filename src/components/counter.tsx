import { useState } from "preact/hooks";
//import "../Styles/CSS/components/counter.css"

function Counter() {
    const [counterValue, setCounterValue] = useState<number>(0);
    const handleCounter = () => {
        setCounterValue(counterValue + 1);
    }
    return (
      <div className="counter-wrapper">
        <div className="p-5 w-fit border-sky border-1">{counterValue}</div>
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded 
               transition-colors duration-300 cursor-pointer"
          onClick={handleCounter}
        >
          Click me!
        </button>
      </div>
    );
}

export {Counter}
