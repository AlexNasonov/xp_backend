const nodemailer = require('nodemailer');
const config = require('../modules/config');
const settings = config.get('mailer');
const transporter = nodemailer.createTransport(settings);

module.exports = class MailerController {
  /**
   * Send custom email message
   * @param {String} to  - email of the addressee
   * @param {String} subject - email subject
   * @param {String} text - email body text
   * @return {Promise<boolean>}
   */
  static async sendMail(to, subject, text) {

    const mailOptions = {
      from: settings.auth.user,
      to: to,
      subject: subject,
      text: text,
    };

    return transporter.sendMail(mailOptions);
  }
};
