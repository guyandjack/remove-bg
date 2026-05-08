import { describe, expect, it, vi, beforeEach } from "vitest";

type MockRes = {
  status: (code: number) => MockRes;
  send: (body: any) => void;
  statusCode: number | null;
  sent: any;
};

const createMockRes = (): MockRes => {
  const res: MockRes = {
    statusCode: null,
    sent: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: any) {
      res.sent = body;
    },
  };
  return res;
};

vi.mock("../../DB/queriesSQL/queriesSQL.js", () => {
  return {
    tryMarkWebhookEventReceived: vi.fn(async () => ({ shouldProcess: true })),
    markWebhookEventProcessed: vi.fn(async () => undefined),
    markStripeCheckoutSessionFailed: vi.fn(async () => true),
    markStripeCheckoutSessionLastError: vi.fn(async () => true),
    getActiveSubscription: vi.fn(async () => null),
    getPlanByStripePriceId: vi.fn(async () => null),
    getPlanByCode: vi.fn(async () => null),
    switchPlan: vi.fn(async () => true),
  };
});

vi.mock("../../services/stripe/finalizeCheckoutSession.js", () => {
  class CheckoutSessionPendingError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CheckoutSessionPendingError";
    }
  }
  return {
    CheckoutSessionPendingError,
    finalizeCheckoutSessionFromStripeSession: vi.fn(async () => ({})),
  };
});

vi.mock("stripe", () => {
  class StripeMock {
    webhooks = {
      constructEvent: vi.fn((_payload: Buffer, _sig: string, _secret: string) => {
        return {
          id: "evt_123",
          type: "checkout.session.completed",
          data: { object: { id: "cs_123" } },
        };
      }),
    };
    constructor(_secretKey: string, _opts: any) {}
  }
  return { default: StripeMock };
});

describe("stripeWebhook controller", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.STRIPE_MODE = "test";
    process.env.STRIPE_SECRET_KEY_TEST = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
  });

  it("verifies signature and processes checkout.session.completed", async () => {
    const { stripeWebhook } = await import("./stripeWebhook.controler.ts");
    const req: any = {
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: Buffer.from("{}", "utf8"),
    };
    const res = createMockRes();

    await stripeWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.sent).toBe("ok");

    const { finalizeCheckoutSessionFromStripeSession } = await import(
      "../../services/stripe/finalizeCheckoutSession.js"
    );
    expect(finalizeCheckoutSessionFromStripeSession).toHaveBeenCalledTimes(1);
  });

  it("ignores already-processed duplicate events", async () => {
    const db = await import("../../DB/queriesSQL/queriesSQL.js");
    (db.tryMarkWebhookEventReceived as any).mockResolvedValueOnce({ shouldProcess: false });

    const { stripeWebhook } = await import("./stripeWebhook.controler.ts");
    const req: any = {
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: Buffer.from("{}", "utf8"),
    };
    const res = createMockRes();

    await stripeWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.sent).toBe("ok");

    const { finalizeCheckoutSessionFromStripeSession } = await import(
      "../../services/stripe/finalizeCheckoutSession.js"
    );
    expect(finalizeCheckoutSessionFromStripeSession).not.toHaveBeenCalled();
  });

  it("returns 500 to trigger Stripe retry when provisioning is pending", async () => {
    const service = await import("../../services/stripe/finalizeCheckoutSession.js");
    const pendingErr = new (service as any).CheckoutSessionPendingError("pending");
    (service.finalizeCheckoutSessionFromStripeSession as any).mockRejectedValueOnce(pendingErr);

    const { stripeWebhook } = await import("./stripeWebhook.controler.ts");
    const req: any = {
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: Buffer.from("{}", "utf8"),
    };
    const res = createMockRes();

    await stripeWebhook(req, res as any);

    expect(res.statusCode).toBe(500);
    expect(res.sent).toBe("pending");
  });
});

