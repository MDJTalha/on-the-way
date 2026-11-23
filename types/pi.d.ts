export {};

declare global {
  type PiAuthResult = {
    accessToken: string;
    user: { uid: string; username: string };
  };

  interface Window {
    Pi?: {
      init(options: { version: "2.0"; sandbox: boolean }): void;
      authenticate(
        scopes: Array<"username" | "payments" | "wallet_address" | "in_app_notifications">,
        onIncompletePaymentFound: (payment: { identifier: string }) => void,
      ): Promise<PiAuthResult>;
    };
  }
}
