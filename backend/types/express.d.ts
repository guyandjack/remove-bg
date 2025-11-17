import type { AuthDTO } from "../middelware/chekDataUser/checkDataUser";
import type { ContactDTO } from "../middelware/checkDataFormContact/checkDataFormContact";

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
