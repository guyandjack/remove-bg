import type { AuthDTO } from "../middelware/chekDataUser/checkDataUser.js";
import type { ContactDTO } from "../middelware/checkDataFormContact/checkDataFormContact.js";

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
