const Faq = ({text}) => {
    return (
      
        
        <ul className={"mt-12 flex flex-col justify-start items-center gap-[20px] w-full"}>
          {text.map((item) => {
            return (
              <li className={"w-full max-w-[1000px] p-3 "}>
                <div className="collapse collapse-plus bg-base-100 border border-base-300 bg-component">
                  <input type="radio" name="my-accordion-3" />
                  <div
                    dangerouslySetInnerHTML={{ __html: item.question }}
                    className="collapse-title font-semibold text-lg text-secondary"
                  >
                   
                  </div>
                  <div className="collapse-content text-base">
                    {item.response}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      
    );
};

export { Faq };
