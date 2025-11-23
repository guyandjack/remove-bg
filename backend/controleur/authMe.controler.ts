import type { Request, Response } from "express";

const authMe = (req: Request, res: Response) => {

    const email = (req as any).payload || null;
    
    if (!email) {
        return res.status(500).json({ status: "error", message: "User unknow", errorCode: "auth1" });
    }

  const user = {
       email: email,
       authentified: true,
      
     };

     return res.status(200).json({
       status: "success",
       user: user,
     });
};

export { authMe };
