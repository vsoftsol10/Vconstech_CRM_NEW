import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import SubscriptionStats from "../components/subscription/stats/SubscriptionStats";
import SearchBar from "../components/subscription/filters/SearchBar";
import FilterChips from "../components/subscription/filters/FilterChips";
import SubscriptionTable from "../components/subscription/table/SubscriptionTable";
import SubscriptionMobileCards from "../components/subscription/table/SubscriptionMobileCards";
import { API_BASE_URL, unwrapCustomerList } from "../config/api";

import { EMPTY_FILTERS } from "../constants/subscriptionConstants";
import { parseExpire } from "../utils/subscriptionUtils";

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function formatPlanLabel(plan) {
  const value = String(plan || "").trim();
  if (!value) return "";
  if (value.toLowerCase() === "trail") return "Trial";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isActiveSubscription(customer, renewalDate) {
  const expiry = parseExpire(renewalDate);
  const status = String(
    pickFirst(customer.subscription_status, customer.subscriptionStatus, customer.payment_status, customer.paymentStatus, customer.accountStatus, customer.status, "")
  ).toLowerCase();

  if (expiry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today && !/(expired|inactive|cancelled|canceled)/.test(status);
  }

  if (/(expired|inactive|cancelled|canceled)/.test(status)) return false;
  if (/(active|paid)/.test(status)) return true;
  return Boolean(customer.active ?? customer.isActive);
}

function normalizeErpSubscription(customer) {
  const plan = pickFirst(customer.subscription_plan, customer.subscriptionPlan, customer.plan, customer.package);
  const renewalDate = pickFirst(
    customer.renewal_date,
    customer.renewalDate,
    customer.subscription_end_date,
    customer.subscriptionEndDate,
    customer.trialEndDate,
    customer.expire,
    customer.expires_at
  );
  const startDate = pickFirst(
    customer.start_date,
    customer.startDate,
    customer.subscription_start_date,
    customer.subscriptionStartedAt,
    customer.subscriptionStartDate,
    customer.trialStartDate,
    customer.createdAt
  );
  const history = customer.subscription_history || customer.subscriptionHistory || customer.history || [];

  return {
    ...customer,
    id: customer.id,
    source: "erp",
    customer_name: customer.customer_name || customer.name || customer.userName || "",
    name: customer.customer_name || customer.name || customer.userName || "",
    email: customer.email || customer.userEmail || customer.clientEmail || "",
    phone: customer.phone || customer.phoneNumber || customer.clientPhone || "",
    subscription_plan: formatPlanLabel(plan),
    plan: formatPlanLabel(plan),
    payment_status: pickFirst(customer.payment_status, customer.paymentStatus, customer.subscription_status, customer.subscriptionStatus, customer.accountStatus),
    subscription_status: pickFirst(customer.subscription_status, customer.subscriptionStatus, customer.accountStatus, customer.status),
    billing_cycle: pickFirst(customer.billing_cycle, customer.billingCycle, customer.renewal_cycle, customer.cycle, customer.packageDuration),
    start_date: startDate || "",
    renewal_date: renewalDate || "",
    renewal_date_raw: renewalDate || "",
    expire: renewalDate || "",
    created_at: pickFirst(customer.created_at, customer.createdAt, customer.userCreatedAt, startDate),
    active: isActiveSubscription(customer, renewalDate),
    has_renewed: Boolean(customer.has_renewed || customer.hasRenewed || customer.renewed || history.length > 0),
    reminder_sent: Boolean(customer.reminder_sent || customer.reminderSent),
    reminder_sent_date: customer.reminder_sent_date || customer.reminderSentOn || "",
  };
}

export default function SubscriptionPage() {
  const [tableSearch, setTableSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);
  const navigate = useNavigate();
  const filterBtnRef = useRef(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const hasDateFilter = activeFilters.expireFrom || activeFilters.expireTo;

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/customers?source=erp`);
        setSubscriptions(unwrapCustomerList(res.data).map(normalizeErpSubscription));
      } catch (err) {
        console.log("API error:", err);
      }
    };

    loadCustomers();
  }, []);

  const activeCount =
    activeFilters.plans.length +
    activeFilters.statuses.length +
    (hasDateFilter ? 1 : 0);

  const filtered = subscriptions.filter((s) => {
    const name = (s.customer_name || "").toLowerCase();
    const plan = (s.subscription_plan || "").toLowerCase();
    const search = tableSearch.toLowerCase();
    const matchSearch =
      name.includes(search) ||
      plan.includes(search);
    const matchPlan =
      activeFilters.plans.length === 0 ||
      activeFilters.plans.includes(s.subscription_plan || s.plan);

    const matchStatus =
      activeFilters.statuses.length === 0 ||
      activeFilters.statuses.includes(s.active ? "Active" : "Expiring");

    let matchDate = true;

    if (activeFilters.expireFrom || activeFilters.expireTo) {
      const exp = parseExpire(s.renewal_date || s.expire);
      if (!exp || Number.isNaN(exp.getTime())) return false;

      if (activeFilters.expireFrom)
        matchDate =
          matchDate &&
          exp >= new Date(activeFilters.expireFrom);

      if (activeFilters.expireTo)
        matchDate =
          matchDate &&
          exp <= new Date(activeFilters.expireTo);
    }

    return (
      matchSearch &&
      matchPlan &&
      matchStatus &&
      matchDate
    );
  });

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 p-4 md:p-1">

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[22px] font-bold text-[#111111] sm:text-[28px] md:text-[32px]">
            Subscription
          </h1>

          <button
            onClick={() => navigate("/SubscriptionPlans")}
            className="h-10 rounded-xl bg-yellow-400 px-4 text-sm font-semibold text-black shadow-md shadow-yellow-200 transition-all hover:scale-[1.02] hover:bg-yellow-500 active:scale-95"
          >
            Plans
          </button>
        </div>

        <SubscriptionStats customers={subscriptions} />

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

          <SearchBar
            tableSearch={tableSearch}
            setTableSearch={setTableSearch}
            activeCount={activeCount}
            showFilter={showFilter}
            setShowFilter={setShowFilter}
            filterBtnRef={filterBtnRef}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
          />

          <FilterChips
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            activeCount={activeCount}
          />

          <SubscriptionTable
            filtered={filtered}
            onReminderSent={(updatedRow) =>
              setSubscriptions((prev) =>
                prev.map((item) =>
                  item.id === updatedRow.id ? { ...item, ...updatedRow } : item
                )
              )
            }
            onRenewed={(updatedRow) =>
              setSubscriptions((prev) =>
                prev.map((item) =>
                  String(item.id) === String(updatedRow.id) ? { ...item, ...updatedRow } : item
                )
              )
            }
          />
          <SubscriptionMobileCards
            filtered={filtered}
            onReminderSent={(updatedRow) =>
              setSubscriptions((prev) =>
                prev.map((item) =>
                  item.id === updatedRow.id ? { ...item, ...updatedRow } : item
                )
              )
            }
          />

        </div>
      </main>
    </div>
  );
}
