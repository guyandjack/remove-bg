import type { Request, Response, NextFunction } from "express";

import { planOption } from "../data/planOption";

const getPlanOption = (req: Request, res: Response) => {

    if (!planOption) {
        
        return res.status(500).json({
            status: "error",
            message: "plan option unvailable",
            code: "plan_1"
          });
    }

   return res.status(200).json({
       status: "success",
       plans: planOption,

     });
};

export { getPlanOption };