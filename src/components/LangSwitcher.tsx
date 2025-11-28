import { useEffect, useRef } from "preact/hooks";
import { langSignal } from "../utils/langSignal";
import { languageRef } from "@/data/content/components/languageNumber/languageRef";

const SelectLanguage = () => {
  const detailEl = useRef<HTMLDetailsElement | null>(null);

  const closeDetail = () => {
    const el = detailEl.current;
    if (!el) return;
    el.removeAttribute("open");
  };

  const selectLang = (ref: string) => {
    langSignal.value = ref;
    closeDetail();
  };

  useEffect(() => {
    const el = detailEl.current;
    if (!el) return;

    el.addEventListener("mouseleave", closeDetail);
    return () => {
      el.removeEventListener("mouseleave", closeDetail);
    };
  }, []);

  return (
    <details ref={detailEl} className="dropdown group w-25">
      <summary
        className={[
          "btn m-1 flex flex-row justify-center gap-3",
          "transition-all duration-300 ease-out",
          "hover:bg-primary/40",
        ].join(" ")}
      >
        {
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
          >
            {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
            />{" "}
          </svg>
        }
      </summary>

      <ul
        className={[
          "menu dropdown-content bg-base-100 rounded-box z-10 w-25 p-2 shadow-sm",
          "transition-all duration-300 ease-out origin-top overflow-hidden",
          "max-h-0 opacity-0 scale-95",
          "group-open:max-h-96 group-open:opacity-100 group-open:scale-100",
        ].join(" ")}
      >
        {languageRef.map(([code, label], index) => (
          <li className="flex-row justify-center" key={code + index.toString()}>
            <button
              className={[
                "p-2 w-15 flex-row justify-center items-center",
                "transition-all duration-300 ease-out",
                "hover:text-primary",
              ].join(" ")}
              type="button"
              onClick={() => selectLang(code)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};

export { SelectLanguage };
