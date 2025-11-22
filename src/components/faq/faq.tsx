const Faq = ({text}) => {
    return (
      
        
        <ul className={"mt-12 flex flex-col justify-start items-center gap-[20px] w-full"}>
          {text.map((item) => {
            return (
              <li className={"w-full max-w-[1000px]"}>
                <details
                  className="collapse bg-base-100 border border-base-300"
                  name="my-accordion-det-1"
                  open
                >
                  <summary className="collapse-title font-semibold lg:text-xl">
                    {item.question}
                  </summary>
                  <div className="collapse-content text-m">
                    {item.response}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      
    );
};

export { Faq };
