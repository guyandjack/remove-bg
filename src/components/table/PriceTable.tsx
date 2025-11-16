const PricingComparisonTable = () => {
  return (
    <section className="mt-12 hidden lg:block">
      <h2 className="mb-4 text-2xl font-semibold text-base-content">
        Comparatif des abonnements
      </h2>

      <div className="overflow-x-auto">
        <div className="rounded-2xl border border-base-300/70 bg-base-100/80 shadow-xl backdrop-blur">
          <table className="table w-full text-sm lg:text-base">
            <thead className="bg-base-200/80">
              <tr>
                <th className="text-base-content/70">Fonctionnalités</th>
                <th className="text-center font-semibold">Free</th>
                <th className="text-center font-semibold">Hobby</th>
                <th className="text-center font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Suppression d’arrière-plan</td>
                <td className="text-center">Basique</td>
                <td className="text-center">Standard</td>
                <td className="text-center">Avancée</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Résolution maximale</td>
                <td className="text-center">1 024 px</td>
                <td className="text-center">3 000 px</td>
                <td className="text-center">8 000 px</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">
                  Formats export (PNG / JPG / WebP)
                </td>
                <td className="text-center">PNG</td>
                <td className="text-center">PNG · JPG</td>
                <td className="text-center">PNG · JPG · WebP</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Crédits / jour</td>
                <td className="text-center">2</td>
                <td className="text-center">8</td>
                <td className="text-center">20</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Traitement par lot</td>
                <td className="text-center text-base-content/50">—</td>
                <td className="text-center">Jusqu’à 20 images</td>
                <td className="text-center">Jusqu’à 200 images</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Téléversement maximum / image</td>
                <td className="text-center">2 Mo</td>
                <td className="text-center">10 Mo</td>
                <td className="text-center">20 Mo</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">File d’attente prioritaire</td>
                <td className="text-center text-base-content/50">—</td>
                <td className="text-center">Standard</td>
                <td className="text-center font-semibold">Prioritaire</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Support e-mail</td>
                <td className="text-center">Sous 72 h</td>
                <td className="text-center">Sous 24 h</td>
                <td className="text-center">Sous 12 h</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Utilisation commerciale</td>
                <td className="text-center text-base-content/50">—</td>
                <td className="text-center">Limitée</td>
                <td className="text-center font-semibold">Oui</td>
              </tr>

              <tr className="hover:bg-base-200/40">
                <td className="font-medium">Accès aux nouveautés</td>
                <td className="text-center">Basique</td>
                <td className="text-center">Accès anticipé</td>
                <td className="text-center">Accès bêta</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-base-content/60">
          * Un usage « illimité » est soumis à une politique d’utilisation
          raisonnable.
        </p>
      </div>
    </section>
  );
};

export { PricingComparisonTable };
