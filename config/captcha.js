const axios = require("axios");

exports.verifyCaptcha = async (token) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const response = await axios.post(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
  );

  return response.data.success;
};
