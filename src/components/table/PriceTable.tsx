type PlanOption = {
  name: string;
  price: number;
  credit: number;
  format: string;
  remove_bg: boolean;
  change_bg_color: boolean;
  tools_qt: string;
  tool_name: string[];
  model_IA_ressource: string;
  gomme_magique: boolean;
  img_pexels: boolean;
  delay_improved: boolean;
  bg_IA_generation: boolean;
  bundle: boolean;
  api: boolean;
  api_external: boolean;
};

type TableLang = {
  title_h2: string;
  price: string;
  credit: string;
  formats: string;
  remove_bg: string;
  change_bg_color: string;
  tools: string;
  model_IA_ressource: string;
  gomme_magique: string;
  img_pexels: string;
  delay_improved: string;
  bg_IA_generation: string;
  bundle: string;
  api: string;
  api_external: string;
};

type PricingComparisonTableProps = {
  option: PlanOption[]; // plans dynamiques depuis le backend
  lang: TableLang; // contenu textuel traduit
};

const renderBool = (val: boolean) =>
  val ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="size-5 inline-block text-success"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <span className="text-base-content/50">-</span>
  );

const PricingComparisonTable = ({ option, lang }: PricingComparisonTableProps) => {
  const plans = Array.isArray(option) ? option : [];
  if (!plans.length) return null;

   return (
     <section className="mt-12">
       <div className="overflow-x-auto">
         <div className="rounded-2xl border border-base-300/70 bg-base-100/80 shadow-xl backdrop-blur bg-component">
           <table className="table w-full text-sm lg:text-base">
             <thead className="bg-base-200/80">
               <tr>
                 <th className="text-base-content/70"> </th>
                 {plans.map((p) => (
                   <th
                     key={`head-${p.name}`}
                     className={`text-center font-bold text-2xl capitalize max-w-[20%] w-full
                   ${
                     p.name === "hobby"
                       ? "text-success"
                       : p.name === "pro"
                       ? "text-info"
                       : "text-secondary"
                   } `}
                   >
                     {p.name}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.price}</td>
                 {plans.map((p) => (
                   <td key={`price-${p.name}`} className="text-center">
                     {p.price}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.credit}</td>
                 {plans.map((p) => (
                   <td key={`credit-${p.name}`} className="text-center">
                     {p.credit}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.formats}</td>
                 {plans.map((p) => (
                   <td key={`format-${p.name}`} className="text-center">
                     {p.format}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.remove_bg}</td>
                 {plans.map((p) => (
                   <td key={`remove_bg-${p.name}`} className="text-center">
                     {renderBool(p.remove_bg)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.change_bg_color}</td>
                 {plans.map((p) => (
                   <td
                     key={`change_bg_color-${p.name}`}
                     className="text-center"
                   >
                     {renderBool(p.change_bg_color)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td
                   className="font-medium"
                   dangerouslySetInnerHTML={{
                     __html: lang.tools.replace(/\n/g, "<br/>"),
                   }}
                 >
                   
                 </td>
                 {plans.map((p) => (
                   <td key={`tools_qt-${p.name}`} className="text-center">
                     {p.tools_qt}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.model_IA_ressource}</td>
                 {plans.map((p) => (
                   <td key={`model-${p.name}`} className="text-center">
                     {p.model_IA_ressource}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.gomme_magique}</td>
                 {plans.map((p) => (
                   <td key={`gomme-${p.name}`} className="text-center">
                     {renderBool(p.gomme_magique)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.img_pexels}</td>
                 {plans.map((p) => (
                   <td key={`pexels-${p.name}`} className="text-center">
                     {renderBool(p.img_pexels)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.delay_improved}</td>
                 {plans.map((p) => (
                   <td key={`delay-${p.name}`} className="text-center">
                     {renderBool(p.delay_improved)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.bg_IA_generation}</td>
                 {plans.map((p) => (
                   <td key={`bg-${p.name}`} className="text-center">
                     {renderBool(p.bg_IA_generation)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.bundle}</td>
                 {plans.map((p) => (
                   <td key={`bundle-${p.name}`} className="text-center">
                     {renderBool(p.bundle)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.api}</td>
                 {plans.map((p) => (
                   <td key={`api-${p.name}`} className="text-center">
                     {renderBool(p.api)}
                   </td>
                 ))}
               </tr>
               <tr className="hover:bg-base-200/40">
                 <td className="font-medium">{lang.api_external}</td>
                 {plans.map((p) => (
                   <td key={`api_ext-${p.name}`} className="text-center">
                     {renderBool(p.api_external)}
                   </td>
                 ))}
               </tr>
             </tbody>
           </table>
         </div>
       </div>
     </section>
   );
};

export { PricingComparisonTable };

