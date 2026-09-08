// import { useEffect, useState } from "react";
// import axios from "axios";
// import { FiSend } from "react-icons/fi";
// import { API_BASE_URL } from "../config/api";

// const formatTime = (value) => (value ? new Date(value).toLocaleString() : "");

// export default function LeadInbox() {
//   const [conversations, setConversations] = useState([]);
//   const [selected, setSelected] = useState(null);
//   const [messages, setMessages] = useState([]);
//   const [draft, setDraft] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [sending, setSending] = useState(false);
//   const [error, setError] = useState("");

//   const loadConversations = async () => {
//     setLoading(true);
//     try {
//       const { data } = await axios.get(`${API_BASE_URL}/api/meta/conversations`);
//       setConversations(data);
//       setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
//     } catch (requestError) {
//       setError(requestError.response?.data?.message || "Could not load the Meta inbox.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { loadConversations(); }, []);

//   useEffect(() => {
//     if (!selected) {
//       setMessages([]);
//       return;
//     }
//     axios.get(`${API_BASE_URL}/api/meta/conversations/${selected.id}/messages`)
//       .then(({ data }) => setMessages(data))
//       .catch((requestError) => setError(requestError.response?.data?.message || "Could not load messages."));
//   }, [selected?.id]);

//   const sendReply = async () => {
//     const text = draft.trim();
//     if (!text || !selected || sending) return;
//     setSending(true);
//     setError("");
//     try {
//       const { data } = await axios.post(`${API_BASE_URL}/api/meta/conversations/${selected.id}/replies`, { text });
//       setMessages((current) => [...current, data.message]);
//       setDraft("");
//       loadConversations();
//     } catch (requestError) {
//       setError(requestError.response?.data?.message || "Reply could not be sent.");
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     <div className="h-[calc(100vh-96px)] min-h-[580px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
//       <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
//         <aside className="overflow-y-auto border-b border-gray-200 lg:border-b-0 lg:border-r">
//           <div className="sticky top-0 border-b border-gray-200 bg-white px-5 py-4">
//             <h1 className="text-lg font-bold text-gray-900">Meta Inbox</h1>
//             <p className="mt-1 text-sm text-gray-500">WhatsApp, Facebook, and Instagram</p>
//           </div>
//           {loading && <p className="px-5 py-4 text-sm text-gray-500">Loading conversations...</p>}
//           {!loading && conversations.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">No conversations yet.</p>}
//           {conversations.map((conversation) => (
//             <button
//               key={conversation.id}
//               type="button"
//               onClick={() => setSelected(conversation)}
//               className={`block w-full border-b border-gray-100 px-5 py-4 text-left transition-colors ${selected?.id === conversation.id ? "bg-[#fff9e0]" : "hover:bg-gray-50"}`}
//             >
//               <div className="flex items-start justify-between gap-3">
//                 <span className="truncate font-semibold text-gray-900">{conversation.fullName || "Unknown"}</span>
//                 <span className="shrink-0 text-xs text-gray-400">{formatTime(conversation.lastMessageAt).split(",")[0]}</span>
//               </div>
//               <p className="mt-1 text-xs font-medium text-[#b18400]">{conversation.channel}</p>
//               <p className="mt-1 truncate text-sm text-gray-500">{conversation.lastMessage || "No messages"}</p>
//             </button>
//           ))}
//         </aside>

//         <section className="flex min-h-0 flex-col">
//           {!selected ? (
//             <div className="m-auto text-sm text-gray-500">Select a conversation to view messages.</div>
//           ) : (
//             <>
//               <header className="border-b border-gray-200 px-5 py-4">
//                 <h2 className="font-semibold text-gray-900">{selected.fullName || "Unknown"}</h2>
//                 <p className="mt-1 text-sm text-gray-500">{selected.channel} {selected.registrationStatus === "completed" ? "- Registered" : "- Registration pending"}</p>
//               </header>
//               <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-5 py-5">
//                 {messages.map((message) => (
//                   <div key={message.id} className={`mb-3 flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}>
//                     <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${message.direction === "out" ? "bg-[#f5c518] text-gray-900" : "bg-white text-gray-700 shadow-sm"}`}>
//                       <p className="whitespace-pre-wrap">{message.text}</p>
//                       <p className="mt-1 text-right text-[11px] opacity-60">{formatTime(message.at)}</p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="border-t border-gray-200 bg-white p-4">
//                 {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
//                 <div className="flex gap-3">
//                   <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendReply(); } }} rows={2} placeholder="Write a reply..." className="min-h-[48px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#d6a800]" />
//                   <button type="button" onClick={sendReply} disabled={sending || !draft.trim()} title="Send reply" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f5c518] text-gray-900 transition-colors hover:bg-[#dfb000] disabled:cursor-not-allowed disabled:opacity-50"><FiSend /></button>
//                 </div>
//               </div>
//             </>
//           )}
//         </section>
//       </div>
//     </div>
//   );
// }

import { useEffect, useState } from "react";
import axios from "axios";
import { FiSend } from "react-icons/fi";
import { API_BASE_URL } from "../config/api";

const formatTime = (value) => (value ? new Date(value).toLocaleString() : "");

export default function LeadInbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/meta/conversations`);
      setConversations(data);
      setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load the Meta inbox.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    axios.get(`${API_BASE_URL}/api/meta/conversations/${selected.id}/messages`)
      .then(({ data }) => setMessages(data))
      .catch((requestError) => setError(requestError.response?.data?.message || "Could not load messages."));
  }, [selected?.id]);

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/meta/conversations/${selected.id}/replies`, { text });
      setMessages((current) => [...current, data.message]);
      setDraft("");
      loadConversations();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Reply could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-96px)] min-h-[580px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b border-gray-200 lg:border-b-0 lg:border-r">
          <div className="sticky top-0 border-b border-gray-200 bg-white px-5 py-4">
            <h1 className="text-lg font-bold text-gray-900">Meta Inbox</h1>
            <p className="mt-1 text-sm text-gray-500">WhatsApp, Facebook, and Instagram</p>
          </div>
          {loading && <p className="px-5 py-4 text-sm text-gray-500">Loading conversations...</p>}
          {!loading && conversations.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">No conversations yet.</p>}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelected(conversation)}
              className={`block w-full border-b border-gray-100 px-5 py-4 text-left transition-colors ${selected?.id === conversation.id ? "bg-[#e7f0ff]" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="truncate font-semibold text-gray-900">{conversation.fullName || "Unknown"}</span>
                <span className="shrink-0 text-xs text-gray-400">{formatTime(conversation.lastMessageAt).split(",")[0]}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-[#0866FF]">{conversation.channel}</p>
              <p className="mt-1 truncate text-sm text-gray-500">{conversation.lastMessage || "No messages"}</p>
            </button>
          ))}
        </aside>

        <section className="flex min-h-0 flex-col">
          {!selected ? (
            <div className="m-auto text-sm text-gray-500">Select a conversation to view messages.</div>
          ) : (
            <>
              <header className="border-b border-gray-200 px-5 py-4">
                <h2 className="font-semibold text-gray-900">{selected.fullName || "Unknown"}</h2>
                <p className="mt-1 text-sm text-gray-500">{selected.channel} {selected.registrationStatus === "completed" ? "- Registered" : "- Registration pending"}</p>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-5 py-5">
                {messages.map((message) => (
                  <div key={message.id} className={`mb-3 flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${message.direction === "out" ? "bg-[#0866FF] text-white" : "bg-white text-gray-700 shadow-sm"}`}>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p className={`mt-1 text-right text-[11px] ${message.direction === "out" ? "text-white/70" : "opacity-60"}`}>{formatTime(message.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 bg-white p-4">
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendReply(); } }} rows={2} placeholder="Write a reply..." className="min-h-[48px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0866FF]" />
                  <button type="button" onClick={sendReply} disabled={sending || !draft.trim()} title="Send reply" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0866FF] text-white transition-colors hover:bg-[#075CE0] disabled:cursor-not-allowed disabled:opacity-50"><FiSend /></button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}