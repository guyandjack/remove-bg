//import  des librairies et des types preact
import { LocationProvider, Router, ErrorBoundary, Route, useLocation } from "preact-iso";

//import des types
// Types are inferred; no explicit JSX.Element return type needed

//import des pages
import { HomePage } from "./src/pages/homePage";
import { ServicesPage } from "./src/pages/servicesPage";
import { SignUpPage } from "./src/pages/signUpPage";
import { PricePage } from "./src/pages/pricePage";
import { ContactPage } from "./src/pages/contactPage";
import { TermsPage } from "./src/pages/termsPage";
import { PrivacyPage } from "./src/pages/privacyPage";
import { LegalPage } from "./src/pages/LegalPage";
import { LoginPage } from "./src/pages/loginPage";
import { CgvPage } from "./src/pages/cgvPage";
import { DashboardPage } from "./src/pages/dashboardPage";
//import { CguPage} from "./src/pages/cguPage";
import { Page404 } from "./src/pages/404Page";

//import des composants
import { NavBar } from "./src/components/navBar";
import { Footer } from "./src/components/footer/Footer";

export function App() {

  
  const RoutedServicesPage = () => {
    const { url } = useLocation();
    return <ServicesPage routeKey={url}  />;
  }
  const RoutedHomePage = () => {
    const { url } = useLocation();
    return <HomePage routeKey={url}  />;
  }
  const RoutedPricePage = () => {
    const { url, path } = useLocation();
    return <PricePage routeKey={url} isSignup={path.includes("signup")} />;
  };
  
  const RoutedLoginPage = () => {
    const { url } = useLocation();
    return <LoginPage routeKey={url}  />;
  }
  
  const RoutedSignUpPage = () => {
    const { url } = useLocation();
    return <SignUpPage routeKey={url}  />;
  }
  const RoutedContactPage = () => {
    const { url } = useLocation();
    return <ContactPage routeKey={url}  />;
  }
  const RoutedTermsPage = () => {
    const { url } = useLocation();
    return <TermsPage routeKey={url}  />;
  }
  const RoutedPrivacyPage = () => {
    const { url } = useLocation();
    return <PrivacyPage routeKey={url}  />;
  }
  const RoutedLegalPage = () => {
    const { url } = useLocation();
    return <LegalPage routeKey={url}  />;
  }
  const RoutedCgvPage = () => {
    const { url } = useLocation();
    return <CgvPage routeKey={url}  />;
  }
  const RoutedDashboardPage = () => {
    const { url } = useLocation();
    return <DashboardPage routeKey={url}  />;
  }
  const RoutedPage404 = () => {
    const { url } = useLocation();
    return <Page404 routeKey={url}  />;
  }
  

  return (
    <div>
      <header className="sticky top-0 z-100 ">
        <NavBar />
      </header>

      <main>
        <LocationProvider>
          <ErrorBoundary onError={(e) => console.log(e)}>
            <Router>
              <Route path="/" component={RoutedHomePage} />
              <Route path="/services" component={RoutedServicesPage} />
              <Route path="/pricing" component={RoutedPricePage} />
              <Route path="/pricing/signup" component={RoutedPricePage} />
              <Route path="/login" component={RoutedLoginPage} />
              <Route path="/signup" component={RoutedSignUpPage} />
              <Route path="/contact" component={RoutedContactPage} />
              <Route path="/terms" component={RoutedTermsPage} />
              <Route path="/privacy" component={RoutedPrivacyPage} />
              <Route path="/legal" component={RoutedLegalPage} />
              <Route path="/cgv" component={RoutedCgvPage} />
              <Route path="/dashboard" component={RoutedDashboardPage} />
              <Route path="*/*" component={RoutedPage404} />
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
