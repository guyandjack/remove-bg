
//import  des librairies et des types preact
import { LocationProvider, Router, ErrorBoundary, Route } from "preact-iso";

//import des types
// Types are inferred; no explicit JSX.Element return type needed

//import des pages
import { HomePage } from "./src/pages/homePage";
import { UploadPage } from "./src/pages/uploadPage";
import { AuthPage } from "./src/pages/authPage";
import { PricePage } from "./src/pages/pricePage";
import { ContactPage} from "./src/pages/contactPage";
import { CguPage} from "./src/pages/cguPage";
import { PrivacyPage} from "./src/pages/privacyPage";
import { Page404} from "./src/pages/404Page";

//import des composants
import { NavBar } from "./src/components/navBar";
import { Footer } from "./src/components/footer/Footer";

export function App() {
  

  return (
    <div>
      <header>
        <NavBar />
        
      </header>

      <main>
        <LocationProvider>
          <ErrorBoundary onError={(e) => console.log(e)}>
            <Router>
              <Route path="/" component={HomePage} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/pricing" component={PricePage} />
              <Route path="/auth" component={AuthPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/cgu" component={CguPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="*/*" component={Page404} />
            </Router>
          </ErrorBoundary>
        </LocationProvider>
      </main>

      <Footer/ >
    </div>
  );
}
