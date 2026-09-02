/* Bootstrap the client with one query cache and one themed shell so every route shares the same app state. */
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme, localStorageColorSchemeManager } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { queryClient } from "./lib/query-client";
import "./styles.css";

const theme = createTheme({
  fontFamily: "Manrope, Inter, sans-serif",
  primaryColor: "teal",
  colors: {
    teal: [
      "#eefcf9",
      "#d6f5ee",
      "#ace8db",
      "#7ad8c4",
      "#53cbb2",
      "#3dc2a7",
      "#2bbf9f",
      "#16a98b",
      "#009579",
      "#007f67",
    ],
  },
});

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme-value",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
