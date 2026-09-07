import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Pages/Dashboard";
import Subscription from "./Pages/SubscriptionPage";
import CustomerPage from "./Pages/CustomerPage";
import LeadPage from "./Pages/LeadSales";
import DashboardLayout from "./components/layout/DashboardLayout";
import Sales from "./Pages/department/SalesPage";
import Support from "./Pages/department/SupportPage";
import Tehnical from "./Pages/department/TechnicalPage";
import Marketing from "./Pages/department/MarketingPage";
import TeamMembers from "./Pages/TeamMembers";
import ForgotPassword from "./components/Authentication/ForgotPassword";
import ResetPassword from "./components/Authentication/ResetPassword";
import { SubscriptionPlans } from "./components/subscription/subscriptionplans";
import EditLeadPage from "./components/leads/EditLeadPage";
import LeadViewPage from "./components/leads/LeadsViewPage";
import Login from "./components/Authentication/Login";
import CustomerFormPage from "./components/customer/Customerform";
import ProfilePage from "./components/Employee/Profile";
import TicketPage from "./components/Employee/Ticket";
import WorkspacePage from "./Pages/Workspacepage"
;
import CreateTicketPage from "./components/tickets/CreateTicket";
import EditTicketPage from "./components/tickets/EditTicket";
import Department from "./Pages/Department";
import InvitationRegistration from "./Pages/Registration/InvitationRegistration";
import LeadInbox from "./Pages/LeadInbox";
function ProtectedRoute({ children }) {
  const employee = localStorage.getItem("employee");
  if (!employee) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/registration/invitations/:invitationId" element={<InvitationRegistration />} />
      <Route path="/invitations/:invitationId" element={<InvitationRegistration />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/customer" element={<CustomerPage />} />
                <Route path="/lead-sales" element={<LeadPage />} />
                <Route path="/lead-inbox" element={<LeadInbox />} />
                <Route path="/department/sales" element={<Sales />} />
                <Route path="/department/support" element={<Support />} />
                <Route path="/department/marketing" element={<Marketing />} />
                <Route path="/department/technical" element={<Tehnical />} />
                <Route path="/team-members" element={<TeamMembers />} />
                <Route path="/SubscriptionPlans" element={<SubscriptionPlans />} />
                <Route path="/leads/edit/:id" element={<EditLeadPage />} />
                <Route path="/leads/view/:id" element={<LeadViewPage />} />
                <Route path="/customers/new" element={<CustomerFormPage isNew={true} />} />
                <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/Tickets" element={<TicketPage />} />
                {/* <Route path="/ticket" element={<TicketPage />} /> */}
                <Route path="/ticket" element={<WorkspacePage />} />
                <Route path="/create-ticket" element={<CreateTicketPage />} />
                <Route path="/ticket/create" element={<CreateTicketPage />} />
                <Route path="/ticket/:id" element={<EditTicketPage />} />
        <Route path="/department"  element={<Department />} />
       

              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
