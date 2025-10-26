
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
            </Router>
          </ErrorBoundary>
        </LocationProvider>
      </main>

      <Footer/ >
    </div>
  );
}
