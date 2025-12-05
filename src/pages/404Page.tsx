//import des hooks
import { useEffect } from "preact/hooks";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

type PropsPage = {
  routeKey: string;
};

const setLocation = (e:MouseEvent) => {
  e.preventDefault();
  window.history.back();
}

const Page404 = ({routeKey}: PropsPage) => {
  //affiche le titre de la page dans l' onglet
  useEffect(() => {
    setActiveLink();
    setDocumentTitle();
  }, [routeKey]);

  return (
    <div className={"page-container"}>
      <div className={"max-w-4xl"}>
        <section className="grid min-h-full place-items-center bg-component px-6 py-24 sm:py-32 lg:px-8">
          <div className="text-center">
            <p className="text-6xl font-semibold text-secondary">404</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
              Page not found
            </h1>
            <p className="mt-6 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
              Sorry, we couldn’t find the page you’re looking for.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button className={"btn btn-primary w-[150px] flex gap-3"}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                  />
                </svg>

                <a href="#" onClick={(e)=> setLocation(e)}>
                  Preview
                </a>
              </button>
              <button className={"btn btn-primary w-[150px] flex gap-3"}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>

                <a href="/" >
                  Home
                </a>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export { Page404 };

