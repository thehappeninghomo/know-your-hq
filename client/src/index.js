import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LeaderboardDisplay from "./LeaderboardDisplay";

const isDisplay = window.location.pathname === "/leaderboard";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {isDisplay ? <LeaderboardDisplay /> : <App />}
  </React.StrictMode>
);
