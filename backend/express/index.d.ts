// types/express/index.d.ts
import "express";
declare global {
  namespace Express {
    interface Request {
      validated?: { email: string; password: string };
    }
  }
}
export { };
  
  

