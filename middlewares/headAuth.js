const headAuth = (req, res, next) => {
  const secret = req.headers["x-head-secret"];

 if (!secret) {
  return res.status(401).json({
    success: false,
    message: "Key missing. Ask permission from Admin."
  });
}

if (secret !== process.env.HEAD_SECRET_KEY) {
  return res.status(403).json({
    success: false,
    message: "Invalid key. Ask permission from Admin."
  });
}

next();

};

module.exports = headAuth;
