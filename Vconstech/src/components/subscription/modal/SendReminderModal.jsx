import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, ChevronRight, Mail, MessageCircle, X } from "lucide-react";
import { API_BASE_URL, customerApiFetch } from "../../../config/api";

const YELLOW = "#F5A500";
const YELLOW_LIGHT = "#FFF8DC";

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.26, ease: "easeOut" } },
  exit: (dir) => ({
    x: dir > 0 ? -50 : 50,
    opacity: 0,
    transition: { duration: 0.18, ease: "easeIn" },
  }),
};

function Stepper({ step }) {
  const steps = ["Channel", "Compose", "Sent"];

  return (
    <div className="flex items-center border-b border-gray-100 px-6 py-4">
      {steps.map((label, index) => {
        const num = index + 1;
        const isReached = step >= num;
        const isCurrent = step === num;

        return (
          <div
            key={label}
            className={`flex items-center ${index < steps.length - 1 ? "flex-1" : "shrink-0"}`}
          >
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isReached ? "bg-[#F5A500] text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {num}
              </span>
              <span
                className={`text-[13px] transition-colors ${
                  isReached ? "text-gray-900" : "text-gray-400"
                } ${isCurrent ? "font-semibold" : "font-normal"}`}
              >
                {label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <span
                className={`mx-3 h-px flex-1 transition-colors ${
                  step > num ? "bg-[#F5A500]" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChannelCard({ icon: Icon, title, subtitle, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col gap-3 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
        selected
          ? "border-[#F5A500] bg-[#FFF8DC]"
          : "border-gray-200 bg-white hover:border-yellow-300 hover:bg-yellow-50/40"
      }`}
    >
      <Icon size={32} strokeWidth={1.6} className="text-gray-900" />
      <span>
        <span className="block text-[15px] font-bold text-gray-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-gray-400">{subtitle}</span>
      </span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border-0 bg-gray-100 px-3.5 py-3 text-sm text-gray-700 outline-none transition-colors focus:bg-gray-50 focus:ring-2 focus:ring-yellow-300";

export default function SendReminderModal({
  row = {},
  onClose = () => {},
  onReminderSent = () => {},
}) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("");
  const [dir, setDir] = useState(1);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    to: row.email || "",
    phone: row.phone || row.phoneno || "",
    subject: "Subscription renewal reminder",
    message: `Hi ${row.customer_name || row.name || "Customer"}, this is a reminder about your subscription renewal.`,
  });

  const customerName = row.customer_name || row.name || "Customer";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const goNext = () => {
    setDir(1);
    setStep((current) => current + 1);
  };

  const goBack = () => {
    setDir(-1);
    setStep((current) => current - 1);
  };

  const sendReminder = async () => {
    if (!row.id) {
      alert("Customer id is missing");
      return;
    }

    try {
      setSending(true);
      const res = await customerApiFetch(`${API_BASE_URL}/api/customers/${row.id}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          subject: form.subject,
          message: form.message,
          to: form.to,
          phone: form.phone,
          customerName: row.customer_name || row.name,
          email: row.email,
          companyName: row.company_name || row.company,
          plan: row.subscription_plan || row.plan,
          renewalDate: row.renewal_date || row.expire || row.expires_at,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        alert(data.message || "Failed to send reminder");
        return;
      }

      onReminderSent(data.customer || { ...row, reminder_sent: true });
      goNext();
    } catch (err) {
      console.log(err);
      alert("Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  const modal = (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close reminder modal"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[calc(100vh-48px)] w-full max-w-[580px] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/30"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: YELLOW_LIGHT, color: "#B8860B" }}
            >
              <Bell size={18} strokeWidth={2.1} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Send Reminder</h2>
              <p className="mt-0.5 text-xs text-gray-400">To {customerName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <Stepper step={step} />

        <div className="min-h-[280px] p-6">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 1 && (
              <motion.div
                key="channel"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={dir}
              >
                <p className="mb-4 text-sm text-gray-600">Choose how you'd like to reach out</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ChannelCard
                    icon={Mail}
                    title="Email"
                    subtitle="Send a template reminder"
                    selected={channel === "email"}
                    onClick={() => setChannel("email")}
                  />
                  <ChannelCard
                    icon={MessageCircle}
                    title="WhatsApp"
                    subtitle="Send a WhatsApp reminder"
                    selected={channel === "whatsapp"}
                    onClick={() => setChannel("whatsapp")}
                  />
                </div>

                <div className="mt-7 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-xl border border-[#F5A500] bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-yellow-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!channel}
                    onClick={goNext}
                    className="flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                    style={{ background: channel ? YELLOW : undefined }}
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && channel === "email" && (
              <motion.div
                key="email"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={dir}
              >
                <div className="space-y-4">
                  <Field label="Email ID">
                    <input
                      type="email"
                      value={form.to}
                      onChange={(e) => setForm((current) => ({ ...current, to: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Subject">
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Message">
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="h-10 rounded-xl border border-[#F5A500] bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-yellow-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={sendReminder}
                    disabled={sending}
                    className="h-10 rounded-xl bg-[#F5A500] px-6 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sending ? "Sending..." : "Send Reminder"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && channel === "whatsapp" && (
              <motion.div
                key="whatsapp"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={dir}
              >
                <div className="space-y-4">
                  <Field label="Mobile Number">
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Message">
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="h-10 rounded-xl border border-[#F5A500] bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-yellow-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={sendReminder}
                    disabled={sending}
                    className="h-10 rounded-xl bg-[#F5A500] px-6 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="sent"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={dir}
                className="py-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="mb-4 flex justify-center"
                >
                  <CheckCircle size={44} strokeWidth={1.8} color={YELLOW} />
                </motion.div>
                <h3 className="text-[17px] font-bold text-gray-900">Reminder Sent</h3>
                <p className="mt-1 text-[13px] text-gray-400">
                  {channel === "email"
                    ? `Email delivered to ${customerName}.`
                    : `Message sent to ${customerName}.`}
                </p>
                <div className="mt-9 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-xl border border-[#F5A500] bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-yellow-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-xl bg-[#F5A500] px-6 text-sm font-bold text-white transition-all active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}
