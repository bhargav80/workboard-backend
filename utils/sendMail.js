const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendMail = async ({ email, subject, message }) => {
  await resend.emails.send({
    from: "WorkBoard Support <onboarding@resend.dev>",
    to: email,
    subject,
    html: message
  });
};

module.exports = sendMail;
