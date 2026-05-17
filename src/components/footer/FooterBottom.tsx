const FooterBottom = () => {
  return (
    <div class="p-2 flex flex-col justify-center items-center gap-3 text-sm bg-base-100 sm:flex-row justify-evenly sm:p-1 text-base">
      <aside>
        <p>Wizard of pixels © {new Date().getFullYear()} - All rights reserved</p>
      </aside>
      
      <div className={"relative z-10"}>
        <a class="hover:text-primary" href="https://helveclick.ch" target={"_blank"}>
          Powered by Helveclick
        </a>
      </div>
    </div>
  );
};

export { FooterBottom };
