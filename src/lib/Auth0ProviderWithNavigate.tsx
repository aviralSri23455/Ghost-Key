import { ReactNode } from "react";
import { Auth0Provider, AppState } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export function Auth0ProviderWithNavigate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const authorizationParams = {
    redirect_uri: `${window.location.origin}`,
    scope: "openid profile email offline_access",
    ...(audience ? { audience } : {}),
  };

  if (!domain || !clientId) {
    throw new Error("Missing VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID in the frontend environment.");
  }

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo || "/app");
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={authorizationParams}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
}
