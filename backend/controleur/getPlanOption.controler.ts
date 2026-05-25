import type { Request, Response, NextFunction } from "express";

import { planOption } from "../data/planOption.js";
import { logger } from "../logger.js";

const getPlanOption = (req: Request, res: Response) => {
    const httpRequestId = (req as any).requestId;

    if (!planOption) {
        logger.error("getPlanOption::missing_plan_option_config", {
            code: "ctrl_getPlanOption_err1",
            requestId: httpRequestId,
            method: req.method,
            path: req.originalUrl || req.url,
        });
        
        return res.status(500).json({
            status: "error",
            message: "plan option unvailable",
            code: "ctrl_getPlanOption_err1",
            requestId: httpRequestId,
          });
    }

   return res.status(200).json({
       status: "success",
       plans: planOption,

     });
};

export { getPlanOption };
