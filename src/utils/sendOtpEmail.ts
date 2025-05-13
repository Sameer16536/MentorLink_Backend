import nodemailer from 'nodemailer';


export const sendOtpEmail = async({to,otp,name = "User"}:{to:string,otp:string,name?:string}) => {
    const transporter = nodemailer.createTransport({
        host : process.env.SMTP_HOST,
        port : Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
})

 const mailOptions = {
    from: `"MentorLink Support" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your OTP for Password Reset",
    html: `
      <div style="font-family:sans-serif;">
        <h2>Hello ${name},</h2>
        <p>You recently requested to reset your password.</p>
        <p><strong>Your OTP is:</strong></p>
        <h1 style="color: #2e86de;">${otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <br/>
        <p>Regards,<br/>MentorLink Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions)
}