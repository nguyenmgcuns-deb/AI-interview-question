import "../styles/globals.css"
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";
import { Setup } from "./components/practice/Setup";
import { Fit } from "./components/practice/Fit";
import { Practice } from "./components/practice/Practice";
import { SummaryPage } from "./components/practice/Summary";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Practice flow: upload -> fit check -> practice chat -> summary (Groq) */}
        <Route path="/" element={<Setup />} />
        <Route path="/fit" element={<Fit />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/summary" element={<SummaryPage />} />

        {/* Original live voice interview (needs OpenAI, Deepgram and Postgres) */}
        <Route path="/interview/:interviewId" element={<Interview />} />
        <Route path="/result/:interviewId" element={<Result />} />
      </Routes>
      <Toaster position="bottom-left" theme="dark" duration={3000} />
    </BrowserRouter>
  );
}

export default App;
