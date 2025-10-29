import type { Request, Response, NextFunction } from "express";

//import des fonctions
import { setCookieOptionsObject } from "../function/createToken";

const logOut = (req: Request, res: Response) => {
  const options = setCookieOptionsObject();

  try {
    res.clearCookie("refresh_token", options);
  } catch {
    res
      .status(500)
      .json({
        status: "error",
        message: "Impossible de suprimer la session",
        errorCode: "out1",
      });
  }

    res.status(200).json({
      status: "success",
      email: "",
      token: "",
      credit: "",
      authentified: false,
    });
};

export { logOut };
