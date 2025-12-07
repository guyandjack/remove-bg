type Text = {
  url: string;
  title: string;
  description: string;
};

type PropsCard = {
  content: Text;
}

const FeatureCard = ({ content }: PropsCard) => {
  return (
    <a
      href={"/pricing"}
      class="w-[370px] h-[250px] rounded-xl bg-component px-6 py-8 shadow-sm flex flex-col justify-center items-center gap-3 hover:shadow-xl border hover:border-primary"
    >
      <div dangerouslySetInnerHTML={{ __html: content.url }}></div>
      <h3 class="my-3 font-display font-medium text-lg">{content.title}</h3>
      <p class="mt-1.5 text-m leading-6 ">{content.description}</p>
    </a>
  );
};

export { FeatureCard };
