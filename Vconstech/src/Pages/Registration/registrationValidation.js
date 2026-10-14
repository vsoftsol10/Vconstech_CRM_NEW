export const normalizePackage = (plan) => {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized.includes("advanced")) return "Advanced";
  if (normalized.includes("premium")) return "Premium";
  if (normalized.includes("basic")) return "Basic";
  return "Free";
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  return "";
};

export const validatePhone = (phone) => {
  if (!phone) return "Phone number is required";
  if (!/^\d+$/.test(phone)) return "Phone number must contain only digits";
  if (phone.length !== 10) return "Phone number must be exactly 10 digits";
  return "";
};

export const validateName = (name) => {
  if (!name) return "Name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 100) return "Name must be less than 100 characters";
  return "";
};

export const validateCompanyName = (companyName) => {
  if (!companyName) return "Company name is required";
  if (companyName.length < 2) return "Company name must be at least 2 characters";
  return "";
};

export const validateCity = (city) => {
  if (!city) return "City is required";
  if (city.length < 2) return "City name must be at least 2 characters";
  return "";
};

export const validateCustomMembers = (members) => {
  if (!members) return "Number of site engineers is required";
  const num = parseInt(members);
  if (Number.isNaN(num) || num < 1) return "Must be at least 1";
  if (num > 1000) return "Must be less than 1000";
  return "";
};

export const validateRegistrationForm = (userData) => {
  const errors = {
    name: validateName(userData.name),
    email: validateEmail(userData.email),
    phoneNumber: validatePhone(userData.phoneNumber),
    companyName: validateCompanyName(userData.companyName),
    city: validateCity(userData.city),
    address: "",
    password: "",
    confirmPassword: "",
  };

  if (!userData.password) errors.password = "Password is required";
  else if (userData.password.length < 8) errors.password = "Password must be at least 8 characters";
  else if (userData.password.length > 50) errors.password = "Password must be less than 50 characters";
  if (!userData.confirmPassword) errors.confirmPassword = "Please confirm your password";
  else if (userData.password !== userData.confirmPassword) errors.confirmPassword = "Passwords do not match";
  if (!userData.address) errors.address = "Address is required";
  else if (userData.address.length < 10) errors.address = "Please enter a complete address";
  if (!userData.role) errors.role = "Please select a role";
  if (!userData.package) errors.package = "Please select a package";
  if (userData.package === "Advanced") {
    errors.customMembers = validateCustomMembers(userData.customMembers);
    for (const [field, label] of [["customProjectLimit", "Project limit"], ["customTemplateLimit", "Template limit"]]) {
      const value = Number(userData[field]);
      if (!Number.isInteger(value) || value < 1 || (field === "customTemplateLimit" && value > 10)) errors[field] = `${label} is missing or invalid`;
    }
    if (!Number.isFinite(Number(userData.customPrice)) || Number(userData.customPrice) <= 0) errors.customPrice = "Annual price is missing or invalid";
  }

  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value !== ""));
};
