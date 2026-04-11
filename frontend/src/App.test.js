import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import axios from "axios";

jest.mock("axios");

test("renders dashboard heading", async () => {
  axios.get.mockResolvedValueOnce({
    data: {
      frontend: { status: "running", last_deployed: null },
    },
  });

  render(<App />);

  expect(screen.getByText(/DeployMate Dashboard/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/frontend/i)).toBeInTheDocument();
  });
});
