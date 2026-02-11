import { betterAuth } from "better-auth";
import { emailOTP, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "./generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import nodemailer from "nodemailer";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_AUTH_URL,
});

const prisma = new PrismaClient({ adapter });

async function sendDeforgeEmail(to, subject, htmlBody) {
  const smtpConfig = {
    host: process.env.AUTH_SMTP_HOST,
    port: process.env.AUTH_SMTP_PORT,
    user: process.env.AUTH_SMTP_USER,
    pass: process.env.AUTH_SMTP_PASSWORD,
    secure: process.env.AUTH_SMTP_SECURE === "true",
  };

  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    console.error("DEFORGE SMTP: Missing configuration credentials.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port || "587"),
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Deforge Auth" <${smtpConfig.user}>`,
      to: to,
      subject: subject,
      html: htmlBody,
    });
    console.log(`DEFORGE SMTP: Sent OTP to ${to}`);
  } catch (error) {
    console.error(`DEFORGE SMTP ERROR: ${error.message}`);
  }
}

function getOtpTemplate(otp, companyName) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0;">${companyName}</h2>
      </div>
      <div style="color: #555; font-size: 16px; line-height: 1.5; text-align: center;">
        <p>Hello,</p>
        <p>Use the following One-Time Password (OTP) to sign in to your account. This code is valid for 5 minutes.</p>
        
        <div style="margin: 30px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #000; padding: 10px 20px; background-color: #f4f4f4; border-radius: 6px; border: 1px dashed #ccc;">
            ${otp}
          </span>
        </div>

        <p style="font-size: 14px; color: #888;">If you didn't request this email, you can safely ignore it.</p>
      </div>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa;">
         Powered by <b>Deforge</b> <br/> &copy; 2026 Deforge Corp. All rights reserved.
      </div>
    </div>
  `;
}

export const sendMail = async (email, companyName) => {
  const auth = betterAuth({
    baseURL: "https://deforge.io",
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailVerification: {
      enabled: true,
    },
    plugins: [
      bearer({}),
      emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") {
            const subject = `${companyName}: Sign In Code`;
            const html = getOtpTemplate(otp, companyName);

            await sendDeforgeEmail(email, subject, html);
          }
        },
      }),
    ],
  });

  await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });
};
