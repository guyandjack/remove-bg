//composant pricCard
type PlanKey =
  | "tag"
  | "title"
  | "price"
  | "bg"
  | "resolution"
  | "format"
  | "credit"
  | "tool_1"
  | "tool_2"
  | "subscribe"
  | "bill";
type Plan = Record<PlanKey, string>;
type PriceCardProps = {
  plan: Plan;
};

const PriceCard = ({ plan }: PriceCardProps) => {
  return (
    <div className="card w-96 h-[350px] bg-base-100 shadow-sm">
      <div className="relative card-body">
        {plan.tag === "Best seller" ? (
          <span className="absolute top-[-20px] badge badge-s badge-warning">
            {plan.tag}
          </span>
        ) : null}
        <div className="flex justify-between">
          <h2 className="text-3xl font-bold">{plan.title}</h2>
          <span className="text-xl">${plan.price}</span>
        </div>
        <ul className="mt-6 flex flex-col gap-2 text-s">
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{plan.bg}</span>
          </li>
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{plan.resolution}</span>
          </li>
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{plan.format}</span>
          </li>
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{plan.credit}</span>
          </li>
          {plan.tool_1 !== "" ? (
            <li className="">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 me-2 inline-block text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{plan.tool_1}</span>
            </li>
          ) : null}
          {plan.tool_2 !== "" ? (
            <li className="">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 me-2 inline-block text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{plan.tool_2}</span>
            </li>
          ) : null}
        </ul>
        <div className="absolute bottom-[10px] left-[50%] w-[80%] translate-x-[-50%]  ">
          <a
            href={`/signup?plan=${plan.title.toLowerCase()}`}
            className="btn btn-success btn-block hover:bg-success/80 "
          >
            {plan.subscribe}
          </a>
          <p>{plan.bill}</p>
        </div>
      </div>
    </div>
  );
};

export { PriceCard };
