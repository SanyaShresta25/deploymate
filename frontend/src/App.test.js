import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import axios from "axios";

jest.mock("axios");

test("renders service data and summary", async () => {
  axios.get
    .mockResolvedValueOnce({
      data: {
        frontend: { status: "running", last_deployed: null },
      },
    })
    .mockResolvedValueOnce({
      data: { total: 1, running: 1, degraded: 0 },
    });

  render(<App />);

  expect(screen.getByText(/DeployMate/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/frontend/i)).toBeInTheDocument();
    expect(screen.getByText(/Total: 1/i)).toBeInTheDocument();
  });
});
