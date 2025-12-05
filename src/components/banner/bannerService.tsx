
const BannerService = () => {
  return (

          
  <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-6"> 
   
    <div
      className="mt-16 w-full max-w-[1300px] flex flex-col justify-start items-center gap-y-5 lg:flex-row lg:justify-evenly lg:gap-x-15">
              <a
      href={"/upload"}
                  className="w-[250px] lg:w-[300px] group relative bg-component transition hover:z-[1] hover:shadow-2xl  hover:shadow-gray-600/10">
        <div className="relative space-y-8 py-12 p-8">
          <img src="https://www.svgrepo.com/show/164986/logo.svg" loading="lazy" width="200" height="200"className="w-12 h-12 rounded-full" style="color:transparent"/>
          <div className="space-y-2">
            <h5 className="text-xl font-semibold transition group-hover:text-primary">Social media</h5>
            <p className="">Converti et formate des images pour tes réseaux prefereés</p>
          </div>
        </div>
      </a>
              <a
      href={"/upload"}
                  className="w-[250px] lg:w-[300px] group relative bg-component transition hover:z-[1] hover:shadow-2xl hover:shadow-gray-600/10">
        <div className="relative space-y-8 py-12 p-8">
          <img src="https://www.svgrepo.com/show/120853/logo.svg" loading="lazy" width="200" height="200"className="w-12 h-12 rounded-full" style="color:transparent" />
          <div className="space-y-2">
            <h5 className="text-xl font-semibold transition group-hover:text-primary">Showcase product</h5>
            <p className="">Met en situation les produits que tu souhaites vendre.</p>
          </div>
        </div>
      </a>
      <a
      href={"/upload"}
      className="w-[250px] lg:w-[300px] group relative bg-component transition hover:z-[1] hover:shadow-2xl hover:shadow-gray-600/10">
        <div className="relative space-y-8 py-12 p-8">
          <img src="https://www.svgrepo.com/show/120852/logo.svg" loading="lazy" width="200" height="200"className="w-12 h-12 rounded-full" style="color:transparent" />
          <div className="space-y-2">
            <h5 className="text-xl font-semibold transition group-hover:text-primary">Convert images</h5>
            <p className="">Converti tout type d'image au format et l'extension desirée.</p>
          </div>
        </div>
      </a>
      {/* <a
      href={"/upload"}
      className="group relative bg-component transition hover:z-[1] hover:shadow-2xl hover:shadow-gray-600/10">
        <div className="relative space-y-8 py-12 p-8">
          <img src="https://www.svgrepo.com/show/120850/logo.svg" loading="lazy" width="200" height="200"className="w-12 h-12 rounded-full" style="color:transparent" />
          <div className="space-y-2">
            <h5 className="text-xl font-semibold transition group-hover:text-primary"></h5>
            <p className="">Chrome Extension that lets you add ChatGPT on any website</p>
          </div>
        </div>
      </a> */}
    </div>
  </div>

  )
}

export { BannerService }

