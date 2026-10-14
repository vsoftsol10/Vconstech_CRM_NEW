import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ERP_API_BASE_URL } from "../../config/api";
import MessagePanel from "./MessagePanel";
import RegistrationForm from "./RegistrationForm";
import { normalizePackage } from "./registrationValidation";

const ERP_API_URL = ERP_API_BASE_URL;

const InvitationRegistration = () => {
  const { invitationId } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadInvitation = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${ERP_API_URL}/registration/invitations/${encodeURIComponent(invitationId)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "This invitation is invalid or no longer available.");
        }

        if (mounted) setInvitation(data.invitation || data.data?.invitation || data.data || data);
      } catch (err) {
        if (mounted) setError(err.message || "Unable to validate this invitation.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInvitation();

    return () => {
      mounted = false;
    };
  }, [invitationId]);

  const initialData = useMemo(() => {
    const customer = invitation?.customer || {};
    const customPlan = invitation?.customPlan || customer.customPlan || {};
    return {
    name: customer.name || invitation?.name || "",
    email: customer.email || invitation?.email || "",
    phoneNumber: customer.phone || invitation?.phone || "",
    companyName: customer.companyName || invitation?.companyName || "",
    crmLeadId: invitation?.crmLeadId || "",
    crmCustomerId: invitation?.crmCustomerId || "",
    role: "Admin",
    package: normalizePackage(customer.subscriptionPlan || invitation?.subscriptionPlan || invitation?.plan),
    customMembers: customer.customMembers ?? customPlan.customMembers ?? invitation?.customMembers ?? "",
    customProjectLimit: customer.customProjectLimit ?? customPlan.customProjectLimit ?? invitation?.customProjectLimit ?? "",
    customTemplateLimit: customer.customTemplateLimit ?? customPlan.customTemplateLimit ?? invitation?.customTemplateLimit ?? "",
    customPrice: customer.customPrice ?? customPlan.customPrice ?? invitation?.customPrice ?? "",
    city: customer.location || customer.city || invitation?.location || invitation?.city || "",
    address: customer.address || invitation?.address || "",
    password: "",
    confirmPassword: "",
  };
  }, [invitation]);

  const handleRegistrationSubmit = async (formData) => {
    const registerResponse = await fetch(`${ERP_API_URL}/registration/invitations/${encodeURIComponent(invitationId)}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        companyName: formData.companyName,
        phoneNumber: formData.phoneNumber,
        city: formData.city,
        address: formData.address,
        package: formData.package,
        customMembers: formData.package === "Advanced" ? formData.customMembers : null,
        customProjectLimit: formData.package === "Advanced" ? formData.customProjectLimit : null,
        customTemplateLimit: formData.package === "Advanced" ? formData.customTemplateLimit : null,
        customPrice: formData.package === "Advanced" ? formData.customPrice : null,
      }),
    });

    const registerData = await registerResponse.json();
    if (!registerResponse.ok || !registerData.success) {
      const validationMessage = registerData.errors
        ? Object.values(registerData.errors).filter(Boolean).join(". ")
        : "";
      throw new Error(validationMessage || registerData.error || "Registration failed.");
    }

    const trialResponse = await fetch(`${ERP_API_URL}/subscription-sync/invitations/${encodeURIComponent(invitationId)}/start-trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: registerData.registration?.user?.id,
        crmCustomerId: invitation?.crmCustomerId,
        crmLeadId: invitation?.crmLeadId,
        erpCustomerId: registerData.registration?.customer?.id || registerData.registration?.user?.erpCustomerId,
        erpClientId: registerData.registration?.user?.clientId,
        plan: formData.package,
        customMembers: formData.package === "Advanced" ? Number(formData.customMembers) : null,
        customProjectLimit: formData.package === "Advanced" ? Number(formData.customProjectLimit) : null,
        customTemplateLimit: formData.package === "Advanced" ? Number(formData.customTemplateLimit) : null,
        customPrice: formData.package === "Advanced" ? Number(formData.customPrice) : null,
      }),
    });

    const trialData = await trialResponse.json();
    if (!trialResponse.ok || !trialData.success) {
      throw new Error(trialData.error || "Registration completed, but trial activation failed.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbfdfc] flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="pointer-events-none absolute -bottom-28 left-0 h-72 w-[42rem] rounded-[50%] border-t border-emerald-100/70 opacity-80" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-[42rem] rounded-[50%] border-t border-emerald-100/70 opacity-60" />
      <div className="pointer-events-none absolute -bottom-20 left-16 h-72 w-[42rem] rounded-[50%] border-t border-emerald-100/70 opacity-40" />

      <div className="relative z-10 flex w-full justify-center">
        {loading && (
          <div className="bg-white rounded-3xl shadow-xl px-6 py-5 font-bold text-gray-900">
            Validating invitation...
          </div>
        )}

        {!loading && error && (
          <MessagePanel
            title="Invitation unavailable"
            message={error}
          />
        )}

        {!loading && !error && success && (
          <MessagePanel
            type="success"
            title="Registration complete"
            message="Your ERP account has been created and your Plan has started.Please check your email for your login credentials."
          />
        )}

        {!loading && !error && !success && invitation && (
          <RegistrationForm
            initialData={initialData}
            onSubmit={handleRegistrationSubmit}
            onSuccess={() => setSuccess(true)}
          />
        )}
      </div>
    </div>
  );
};

export default InvitationRegistration;
