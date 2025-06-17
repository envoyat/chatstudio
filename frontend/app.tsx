import { BrowserRouter, Routes, Route } from "react-router-dom"
import ChatLayout from "./ChatLayout"
import Home from "./routes/Home"
import Thread from "./routes/Thread"
import Settings from "./routes/Settings"
import AttachmentsPage from "./routes/AttachmentsPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatLayout />}>
          <Route index element={<Home />} />
          <Route path="chat" element={<Home />} />
          <Route path="chat/:id" element={<Thread />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
        <Route path="/attachments" element={<AttachmentsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
