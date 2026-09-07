const isGreeting = (text) => /^(hi|hello|hey|good\s+(morning|afternoon|evening))\W*$/i.test(text.trim());

const customerConfirmedInterest = (messages) => {
  const inboundIndex = [...messages].map((message) => message.direction).lastIndexOf("in");
  if (inboundIndex < 1) return false;

  const latestText = String(messages[inboundIndex].text || "").trim();
  const previousOutbound = [...messages.slice(0, inboundIndex)]
    .reverse()
    .find((message) => message.direction === "out");
  const previousText = String(previousOutbound?.text || "");
  const isErpQuestion = /\berp\b/i.test(previousText) && /\?/i.test(previousText);
  const isNegative = /^(no|nope|not now|not interested)\b/i.test(latestText);
  const isAffirmative = /^(yes|yeah|yep|sure|okay|ok|interested|i am|i do)\b/i.test(latestText);
  const namesRequirement = /\b(challenges?|need|requirement|area|help)\b/i.test(previousText) && latestText.length > 2;

  return isErpQuestion && !isNegative && (isAffirmative || namesRequirement);
};

const fallbackReply = (messages) => {
  const latestInbound = [...messages].reverse().find((message) => message.direction === "in");
  const latestText = String(latestInbound?.text || "");

  if (customerConfirmedInterest(messages)) {
    return { reply: "Thanks for confirming your ERP requirement. I am sending the registration form now.", wantsRegistration: true };
  }

  if (isGreeting(latestText)) {
    return { reply: "Hello! Welcome. Are you looking for an ERP solution for your business?", wantsRegistration: false };
  }

  return { reply: "Thanks for sharing that. Are you looking for an ERP solution, a demo, or pricing for your business?", wantsRegistration: false };
};

const generateSalesReply = async (messages) => fallbackReply(messages);

module.exports = { fallbackReply, generateSalesReply };
