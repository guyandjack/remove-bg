import type { AuthDTO } from "../backend/middelware/chekDataUser/checkDataUser";
import type { ContactDTO } from "../backend/middelware/checkDataFormContact/checkDataFormContact";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userValidated?: AuthDTO;
      contactValidated?: ContactDTO;
      verificationLink?: string;
    }
  }
}

export {};
