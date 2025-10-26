const Hero = () => {
    return (
<div className="hero bg-base-200 ">
  <div className="hero-content flex-col lg:flex-row-reverse">
    <img
      src="https://img.daisyui.com/images/stock/photo-1635805737707-575885ab0820.webp"
      className="max-w-sm rounded-lg shadow-2xl"
    />
    <div>
      <h2 className="text-3xl font-bold">Détourer automatiquement l'arriere plan de vos images, grace a IA</h2>
      <p className="py-6">
        Pour les professionnels ou les amateurs de retouche photo, faite le choix de la simplicité.
      </p>
      <button className="btn btn-primary">Get Started</button>
    </div>
  </div>
</div>
        
    )
}

export {Hero}

