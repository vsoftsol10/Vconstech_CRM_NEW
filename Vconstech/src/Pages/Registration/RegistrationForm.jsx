
import { useEffect, useState } from "react";
import {
  Building,
  Eye,
  EyeOff,
  Home,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  User,
  UserCog,
  UserPlus,
  Users,
  AlertCircle,
} from "lucide-react";
import InputField from "./InputField";
import SelectField from "./SelectField";
import Toast from "./Toast";
import { INITIAL_FORM, ROLES, PACKAGES } from "./registrationConstants";
import { validateRegistrationForm } from "./registrationValidation";

const RegistrationForm = ({ initialData, onSubmit, onSuccess }) => {
  const [userData, setUserData] = useState({ ...INITIAL_FORM, ...initialData });
  const [isFocused, setIsFocused] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setUserData({ ...INITIAL_FORM, ...initialData });
  }, [initialData]);

  const handleFocus = (field, focused) => setIsFocused((prev) => ({ ...prev, [field]: focused }));

  const handleFieldChange = (field, value) => {
    setUserData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setError("");
    const errors = validateRegistrationForm(userData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fix all validation errors before submitting");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(userData);
      setToast("Registration complete. Your trial has started.");
      setFieldErrors({});
      onSuccess?.();
    } catch (err) {
      setError(err.message || "An error occurred while creating the user");
    } finally {
      setLoading(false);
    }
  };

  // All fields are locked/read-only except password + confirmPassword
  const fieldsDisabled = true;

  return (
    <>
      <form onSubmit={handleSubmit} className="relative bg-white rounded-3xl shadow-xl border border-gray-200/80 w-full max-w-5xl flex flex-col overflow-hidden">
        <div className="relative flex items-center justify-between px-5 sm:px-8 py-5 sm:py-8 border-b border-gray-100 bg-white rounded-t-3xl shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#fff4d7] flex items-center justify-center shadow-sm">
              <User className="w-8 h-8 sm:w-10 sm:h-10 text-gray-950" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-950">Complete ERP Registration</h2>
              <p className="text-gray-500 text-sm sm:text-base mt-1">Confirm your details and create your account</p>

            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 sm:px-8 py-6 sm:py-8">
         <p className="text-red-500 text-sm sm:text-base mt-2 mb-4 text-center font-bold">
  Please Fill out the Password Only
</p>
          {error && (
            <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl flex items-start shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <p className="ml-3 text-sm font-bold text-red-900 self-center">{error}</p>
            </div>
          )}
          

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            
            <InputField
              field="name"
              label="Client Name"
              placeholder="Enter full name"
              icon={User}
              value={userData.name}
              isFocused={isFocused.name}
              error={fieldErrors.name}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <InputField
              field="email"
              label="Email"
              type="email"
              placeholder="Enter email address"
              icon={Mail}
              value={userData.email}
              isFocused={isFocused.email}
              error={fieldErrors.email}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <InputField
              field="phoneNumber"
              label="Contact Number"
              type="tel"
              placeholder="Enter 10-digit phone number"
              icon={Phone}
              value={userData.phoneNumber}
              isFocused={isFocused.phoneNumber}
              error={fieldErrors.phoneNumber}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <SelectField
              field="role"
              label="Role"
              icon={UserCog}
              value={userData.role}
              options={ROLES}
              placeholder="Select role"
              isFocused={isFocused.role}
              error={fieldErrors.role}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <InputField
              field="companyName"
              label="Company Name"
              placeholder="Enter company name"
              icon={Building}
              value={userData.companyName}
              isFocused={isFocused.companyName}
              error={fieldErrors.companyName}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <InputField
              field="city"
              label="City"
              placeholder="Enter city name"
              icon={MapPin}
              value={userData.city}
              isFocused={isFocused.city}
              error={fieldErrors.city}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            <SelectField
              field="package"
              label="Package"
              icon={Package}
              value={userData.package}
              options={PACKAGES}
              placeholder="Select package"
              isFocused={isFocused.package}
              error={fieldErrors.package}
              onChange={(field, value) => {
                handleFieldChange(field, value);
                setUserData((prev) => ({ ...prev, package: value, customMembers: "" }));
              }}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
            />

            {userData.package === "Advanced" && (
              <>
                {[["customMembers", "Number of Site Engineers"], ["customProjectLimit", "Number of Projects"], ["customTemplateLimit", "Number of Templates"], ["customPrice", "Custom Annual Price (Rs.)"]].map(([field, label]) => (
                  <InputField
                    key={field}
                    field={field}
                    label={label}
                    type="number"
                    placeholder="Set by CRM sales during conversion"
                    icon={Users}
                    value={userData[field]}
                    isFocused={isFocused[field]}
                    error={fieldErrors[field]}
                    onChange={handleFieldChange}
                    onFocus={handleFocus}
                    onBlur={handleFocus}
                    disabled={fieldsDisabled}
                    className="bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                ))}
              </>
            )}

            <InputField
              field="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 characters"
              icon={Lock}
              value={userData.password}
              isFocused={isFocused.password}
              error={fieldErrors.password}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={loading}
            >
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </InputField>

            <InputField
              field="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter password"
              icon={Lock}
              value={userData.confirmPassword}
              isFocused={isFocused.confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={loading}
            >
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </InputField>
          </div>

          <div className="mt-5">
            <InputField
              field="address"
              label="Address"
              placeholder="Enter full address"
              icon={Home}
              value={userData.address}
              isFocused={isFocused.address}
              error={fieldErrors.address}
              onChange={handleFieldChange}
              onFocus={handleFocus}
              onBlur={handleFocus}
              disabled={fieldsDisabled}
              className="bg-gray-100 text-gray-500 cursor-not-allowed"
              isTextarea
              rows={4}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 sm:px-8 py-5 sm:py-6 border-t border-gray-100 bg-white rounded-b-3xl shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-3 bg-[#ffbe2a] text-black font-bold py-3.5 sm:py-4 rounded-xl hover:shadow-xl shadow-[#ffbe2a]/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
          >
            {!loading && <UserPlus className="w-5 h-5" />}
            {loading ? "Registering..." : "Create Account"}
          </button>
          <p className="flex items-center justify-center gap-2 text-sm text-gray-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            Your data is safe and secure with us.
          </p>
        </div>
      </form>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </>
  );
};

export default RegistrationForm;
