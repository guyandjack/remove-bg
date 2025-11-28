
//import  des librairies et des types preact
import { LocationProvider, Router, ErrorBoundary, Route } from "preact-iso";

//import des types
// Types are inferred; no explicit JSX.Element return type needed

//import des pages
import { HomePage } from "./src/pages/homePage";
import { UploadPage } from "./src/pages/uploadPage";
import { SignUpPage } from "./src/pages/signUpPage";
import { PricePage } from "./src/pages/pricePage";
import { ContactPage} from "./src/pages/contactPage";
import { TermsPage} from "./src/pages/termsPage";
import { PrivacyPage} from "./src/pages/privacyPage";
import { LegalPage} from "./src/pages/LegalPage";
import { LoginPage} from "./src/pages/loginPage";
import { CgvPage} from "./src/pages/cgvPage";
import { DashboardPage } from "./src/pages/dashboardPage";
//import { CguPage} from "./src/pages/cguPage";
import { Page404} from "./src/pages/404Page";

//import des composants
import { NavBar } from "./src/components/navBar";
import { Footer } from "./src/components/footer/Footer";

export function App() {
  

  return (
    <div>
      <header className="sticky top-0 z-100 ">
        <NavBar />
      </header>

      <main>
        <LocationProvider>
          <ErrorBoundary onError={(e) => console.log(e)}>
            <Router>
              <Route path="/" component={HomePage} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/pricing" component={PricePage} />
              <Route path="/pricing/signup" component={PricePage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/signup" component={SignUpPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/legal" component={LegalPage} />
              <Route path="/cgv" component={CgvPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="*/*" component={Page404} />
            </Router>
          </ErrorBoundary>
        </LocationProvider>
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  );
}
