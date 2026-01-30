const headAuth = (req, res, next) => {
  const secret = req.headers["x-head-secret"];

  if (!secret) {
    return res.status(401).json({
      success: false,
      message: "Secret key required"
    });
  }

  if (secret !== process.env.HEAD_SECRET_KEY) {
    return res.status(403).json({
      success: false,
      message: "Only Head can edit marks"
    });
  }

  next();
};

module.exports = headAuth;
